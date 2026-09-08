const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, request, legacy } = require('./paidCareFixture');
const { createPaidCareService } = require('../src/yumpals/paidCareService');
const { fail } = require('../src/yumpals/paidCareEngine');
const { createPaidCareCallables } = require('../src/yumpals/paidCareCallables');
const { createUidWalletAdapter } = require('../src/yumpals/uidWalletAdapter');

function connected(options) {
  const f = setup(options);
  f.refs.refusal = (uid, id) => `fixture/refusals/${uid}/${id}`;
  f.service = createPaidCareService({ ...f, now: () => Date.parse('2026-09-09T00:00:00Z') });
  return f;
}
test('handheld projection preserves stored extras and reads wallet before advancement; unknown is not zero', async () => {
  const f = connected({ balance: 30.5 });
  const path = f.refs.pet('student-a');
  const pet = f.db.read(path); pet.paidCare.needs.secret = 'private'; f.db.seed(path, pet);
  const view = await f.service.getHandheldState(request());
  assert.deepEqual(view.wallet, { available: true, balance: 30.5 });
  assert.equal(view.aucklandDate, '2026-09-09');
  assert.equal(view.pet.needs.secret, undefined);
  assert.equal(view.pet.unknown, undefined);
  assert.deepEqual(f.db.read(path).unknown, pet.unknown);
  assert.equal(f.db.read(path).paidCare.needs.secret, 'private');
  f.walletAdapter.read = async () => fail('WALLET_BALANCE_CONFLICT');
  assert.deepEqual((await f.service.getHandheldState(request())).wallet, { available: false });
  f.walletAdapter.read = async () => { throw new Error('DATABASE_OFFLINE'); };
  const saved = [...f.db.values];
  await assert.rejects(f.service.getHandheldState(request()), /DATABASE_OFFLINE/);
  assert.deepEqual([...f.db.values], saved);
});
test('strict empty inputs and explicit legacy migration refusal without mutations', async () => {
  const f = connected();
  for (const method of ['getState', 'migrate', 'getHandheldState']) {
    for (const data of [null, false, true, 0, 1, '', 'x', [], new Date()]) {
      await assert.rejects(f.service[method](request('student-a', data)), { code: 'INVALID_REQUEST' });
    }
  }
  f.db.seed(f.refs.pet('student-a'), legacy());
  await assert.rejects(f.service.getHandheldState(request()), { code: 'MIGRATION_REQUIRED' });
  assert.equal(f.db.read(f.refs.pet('student-a')).paidCare, undefined);
});
test('terminal insufficient refusal replays after a gift without charging; edited request conflicts', async () => {
  const f = connected({ balance: 0 }); const req = f.purchaseRequest('meal');
  const result = await f.service.purchase(req);
  assert.equal(result.refusal.reason, 'INSUFFICIENT_FUNDS');
  f.db.seed('fixture/wallets/student-a', { ownerUid: 'student-a', balance: 20 });
  const before = [...f.db.values];
  assert.equal((await f.service.purchase(req)).duplicate, true);
  assert.deepEqual([...f.db.values], before);
  await assert.rejects(f.service.purchase({ ...req, data: { ...req.data, action: 'snack' } }), { code: 'OPERATION_CONFLICT' });
});
test('held old purchase retries into terminal refusal after wallet changes, rather than charging', async () => {
  const f = connected({ balance: 2 });
  let release; let reached;
  const held = new Promise(resolve => { release = resolve; });
  const barrier = new Promise(resolve => { reached = resolve; });
  const read = f.walletAdapter.read; let first = true;
  f.walletAdapter.read = async (...args) => {
    const wallet = await read(...args);
    if (first) { first = false; reached(); await held; }
    return wallet;
  };
  const req = f.purchaseRequest('meal');
  const original = f.service.purchase(req); await barrier;
  f.db.seed('fixture/wallets/student-a', { ownerUid: 'student-a', balance: 0 });
  assert.equal((await f.service.purchase(req)).refusal.reason, 'INSUFFICIENT_FUNDS');
  f.db.seed('fixture/wallets/student-a', { ownerUid: 'student-a', balance: 2 });
  release();
  assert.equal((await original).refusal.reason, 'INSUFFICIENT_FUNDS');
  assert.ok(f.db.conflicts > 0);
  assert.equal(f.db.read('fixture/wallets/student-a').balance, 2);
  assert.equal(f.db.read(f.refs.receipt('student-a', req.data.operationId)), undefined);
});
test('refusal commit failure and paid staging failure never leave terminal outcomes', async () => {
  const f = connected({ balance: 0 }); const req = f.purchaseRequest('meal');
  f.db.failCommit = true;
  await assert.rejects(f.service.purchase(req), /COMMIT_FAILURE/);
  assert.equal(f.db.read(f.refs.refusal('student-a', req.data.operationId)), undefined);
  f.db.seed('fixture/wallets/student-a', { ownerUid: 'student-a', balance: 20 });
  const debit = f.walletAdapter.debit;
  f.walletAdapter.debit = async (...args) => { debit(...args); throw new Error('STAGING_FAILURE'); };
  const before = [...f.db.values];
  await assert.rejects(f.service.purchase(req), /STAGING_FAILURE/);
  assert.deepEqual([...f.db.values], before);
});
test('wrapper authenticates before strict readiness and database access; rejects forged inputs', async () => {
  const f = connected(); let reads = 0;
  const run = f.db.runTransaction.bind(f.db); f.db.runTransaction = (...args) => { reads++; return run(...args); };
  class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
  for (const ready of [undefined, () => false, () => null, () => 'true']) {
    const api = createPaidCareCallables({ ...f, HttpsError, ready });
    for (const method of ['getState', 'purchase']) {
      await assert.rejects(api[method]({ data: {} }), { details: { reason: 'UNAUTHENTICATED' } });
      await assert.rejects(api[method](request()), { details: { reason: 'ROLLOUT_NOT_READY' } });
    }
  }
  assert.equal(reads, 0);
  const api = createPaidCareCallables({ ...f, HttpsError, ready: () => true });
  for (const key of ['auth', 'uid', 'now', 'cost']) {
    const req = f.purchaseRequest('meal'); req.data[key] = 'forged';
    await assert.rejects(api.purchase(req), { details: { reason: 'INVALID_REQUEST' } });
  }
  assert.equal(reads, 0);
});
test('disabled view does not write and config map extras are not projected', async () => {
  const f = connected(); const path = f.refs.config('student-a'); const cfg = f.db.read(path);
  cfg.enabled = false; cfg.prices.secret = { private: true }; cfg.restores.secret = 'hidden'; f.db.seed(path, cfg);
  const before = [...f.db.values]; const v = await f.service.getHandheldState(request());
  assert.equal(v.prices.secret, undefined); assert.equal(v.restores.secret, undefined);
  assert.deepEqual([...f.db.values], before);
});
test('refusal aliases, malformed/dual outcomes fail closed; map-order replay remains valid', async () => {
  const f = connected({ balance: 0 }); const req = f.purchaseRequest('meal'); await f.service.purchase(req);
  const path = f.refs.refusal('student-a', req.data.operationId); const original = f.db.read(path);
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  reordered.request = Object.fromEntries(Object.entries(original.request).reverse()); f.db.seed(path, reordered);
  assert.equal((await f.service.purchase(req)).duplicate, true);
  for (const change of [{ extra: true }, { committedAtMs: 253402214400001 }, { binding: 'wrong' }, { ownerUid: 'student-b' }]) {
    f.db.seed(path, { ...original, ...change }); await assert.rejects(f.service.purchase(req));
  }
  f.db.seed(path, original); f.db.seed(f.refs.receipt('student-a', req.data.operationId), { bogus: true });
  await assert.rejects(f.service.purchase(req), { code: 'CORRUPT_REFUSAL' });
  const alias = createPaidCareService({ ...f, refs: { ...f.refs, refusal: f.refs.receipt } });
  await assert.rejects(alias.purchase(req), { code: 'INVALID_REFUSAL_REFS' });
});
test('real adapter supports reused raw transaction across gift-conflict retries for purchase and handheld view', async () => {
  for (const method of ['purchase', 'getHandheldState']) {
    const f = connected();
    const refs = { mapping: uid => `mapping/${uid}`, publicProfile: id => `public/${id}`, privateProfile: uid => `private/${uid}` };
    f.db.seed(refs.mapping('student-a'), { schemaVersion: 1, ownerUid: 'student-a', publicProfileId: 'record-a' });
    const paths = [refs.publicProfile('record-a'), refs.privateProfile('student-a')];
    for (const path of paths) f.db.seed(path, { ownerUid: 'student-a', balance: 30.5, bank_balance: 20, opaque: { keep: true } });
    let target; let attempts = 0;
    // One proxy per run, deliberately reused for each FakeDb callback attempt.
    const stable = { get: (...args) => target.get(...args), set: (...args) => target.set(...args) };
    const db = { runTransaction: cb => f.db.runTransaction(t => { target = t; attempts++; return cb(stable); }) };
    const real = createUidWalletAdapter({ refs }); let first = true; const facades = [];
    const walletAdapter = { debit: real.debit, read: async (t, uid) => {
      facades.push(t); const wallet = await real.read(t, uid);
      if (first) { first = false; for (const path of paths) f.db.seed(path, { ...f.db.read(path), balance: 33.5 }); }
      return wallet;
    } };
    const service = createPaidCareService({ ...f, db, walletAdapter, now: () => Date.parse('2026-09-09T00:00:00Z') });
    const result = await service[method](method === 'purchase' ? f.purchaseRequest('meal') : request());
    assert.equal(attempts, 2); assert.equal(f.db.conflicts, 1); assert.notEqual(facades[0], facades[1]);
    assert.equal(method === 'purchase' ? result.receipt.walletAfter : result.wallet.balance, method === 'purchase' ? 31.5 : 33.5);
    for (const path of paths) assert.deepEqual(f.db.read(path), { ownerUid: 'student-a', balance: method === 'purchase' ? 31.5 : 33.5, bank_balance: 20, opaque: { keep: true } });
    await assert.rejects(real.read(facades[1], 'student-a'), { code: 'WALLET_ALREADY_READ' });
  }
});
