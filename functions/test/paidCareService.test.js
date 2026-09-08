const test = require('node:test');
const assert = require('node:assert/strict');
const { createPaidCareService } = require('../src/yumpals/paidCareService');
const { setup, legacy, request } = require('./paidCareFixture');
const UID = 'student-a';
const EMPTY = { hunger: 0, happiness: 0, cleanliness: 0, health: 0 };
const walletPath = `fixture/wallets/${UID}`;
const snapshot = (db) => structuredClone([...db.values]);

test('saved request key order is immaterial to legacy binding, including adoption; replay never rewrites', async () => {
  for (const action of ['adoption', 'snack']) {
    const f = setup({ pet: action !== 'adoption', needs: EMPTY, balance: 30.5 });
    const extra = action === 'adoption' ? { adoption: { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878' } } : {};
    const req = f.purchaseRequest(action, 'ordered', UID, extra);
    const result = await f.service.purchase(req);
    const reordered = structuredClone(result.receipt);
    const reverse = (object) => Object.fromEntries(Object.entries(object).reverse());
    reordered.request = reverse(reordered.request);
    if (action === 'adoption') reordered.request.adoption = reverse(reordered.request.adoption);
    const path = f.refs.receipt(UID, 'ordered');
    f.db.seed(path, reordered);
    const before = snapshot(f.db);
    const replay = await f.service.purchase(req);
    assert.equal(replay.duplicate, true); assert.equal(replay.receipt.binding, result.receipt.binding);
    assert.deepEqual(replay.receipt, reordered); assert.deepEqual(snapshot(f.db), before);
  }
});

test('saved request semantic edits, unknown keys and missing/null fields always report corrupt receipt', async () => {
  for (const action of ['adoption', 'snack']) {
    const f = setup({ pet: action !== 'adoption', needs: EMPTY });
    const extra = action === 'adoption' ? { adoption: { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878' } } : {};
    const req = f.purchaseRequest(action, 'malformed', UID, extra);
    const { receipt } = await f.service.purchase(req);
    const changes = [
      (r) => { r.request.extra = true; },
      (r) => { r.request.action = 'pat'; },
      (r) => { r.request.expectedConfigVersion = 'changed'; },
      (r) => { r.request = null; },
    ];
    for (const key of Object.keys(receipt.request)) {
      changes.push((r) => { delete r.request[key]; });
      if (key !== 'adoption' || action === 'adoption') changes.push((r) => { r.request[key] = null; });
    }
    if (action === 'adoption') {
      changes.push((r) => { r.request.adoption.name = 'Changed'; });
      changes.push((r) => { r.request.adoption.extra = true; });
      for (const key of Object.keys(receipt.request.adoption)) {
        changes.push((r) => { delete r.request.adoption[key]; });
        changes.push((r) => { r.request.adoption[key] = null; });
      }
    } else changes.push((r) => { r.request.adoption = {}; });
    for (const change of changes) {
      const malformed = structuredClone(receipt); change(malformed);
      f.db.seed(f.refs.receipt(UID, 'malformed'), malformed);
      const before = snapshot(f.db);
      await assert.rejects(f.service.purchase(req), { code: 'CORRUPT_RECEIPT' });
      assert.deepEqual(snapshot(f.db), before);
    }
  }
});

test('atomic payment preserves wallet savings, giving, lifetime and metadata while delivering exactly once', async () => {
  const { db, service, refs, purchaseRequest } = setup({ needs: EMPTY });
  const before = db.read(walletPath);
  const req = purchaseRequest('meal');
  const first = await service.purchase(req);
  assert.equal(first.receipt.amount, 2);
  assert.deepEqual(db.read(walletPath), { ...before, balance: 28 });
  assert.equal(db.read(refs.pet(UID)).paidCare.needs.hunger, 2);
  assert.deepEqual(db.read(refs.receipt(UID, 'purchase-1')), first.receipt);
  const after = snapshot(db);
  const replay = await service.purchase(req);
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.receipt, first.receipt);
  assert.deepEqual(snapshot(db), after);
});

test('concurrent same-ID retries converge; different-ID debits conflict/retry without losing effects', async () => {
  const { db, service, refs, purchaseRequest } = setup({ needs: EMPTY });
  const req = purchaseRequest('meal', 'same');
  const results = await Promise.all([service.purchase(req), service.purchase(req), service.purchase(req)]);
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  assert.equal(db.read(walletPath).balance, 28);
  assert.ok(db.conflicts > 0);
  await Promise.all([service.purchase(purchaseRequest('snack', 'snack-a')), service.purchase(purchaseRequest('snack', 'snack-b'))]);
  assert.equal(db.read(walletPath).balance, 26);
  assert.equal(db.read(refs.pet(UID)).paidCare.needs.hunger, 4);
});

test('concurrent different purchases cannot overdraw a one-donut wallet', async () => {
  const { db, service, purchaseRequest } = setup({ needs: EMPTY, balance: 1 });
  const results = await Promise.allSettled([service.purchase(purchaseRequest('snack', 'a')), service.purchase(purchaseRequest('pat', 'b'))]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(db.read(walletPath).balance, 0);
  assert.equal([...db.values.keys()].filter((path) => path.startsWith(`fixture/receipts/${UID}/`)).length, 1);
});

test('failed commit and asynchronous adapter rejection roll back every staged document', async () => {
  const fixture = setup({ needs: EMPTY });
  const { db, service, refs, purchaseRequest, walletAdapter } = fixture;
  const before = snapshot(db);
  db.failCommit = true;
  await assert.rejects(service.purchase(purchaseRequest('meal')), /COMMIT_FAILURE/u);
  assert.deepEqual(snapshot(db), before);
  const rejecting = createPaidCareService({ db, refs, now: () => Date.parse('2026-09-07T00:00:00Z'), walletAdapter: {
    read: walletAdapter.read,
    debit: async (tx, wallet, amount) => { walletAdapter.debit(tx, wallet, amount); await Promise.resolve(); throw new Error('ADAPTER_FAILURE'); },
  } });
  await assert.rejects(rejecting.purchase(purchaseRequest('meal')), /ADAPTER_FAILURE/u);
  assert.deepEqual(snapshot(db), before);
  await service.purchase(purchaseRequest('meal'));
  assert.equal(db.read(walletPath).balance, 28);
});

test('payload/config binding rejects changed request; old committed receipt survives new config and next day', async () => {
  const { db, refs, service, purchaseRequest, setNow } = setup({ needs: EMPTY });
  const original = purchaseRequest('meal');
  const first = await service.purchase(original);
  await assert.rejects(service.purchase({ ...original, data: { ...original.data, action: 'snack' } }), { code: 'OPERATION_CONFLICT' });
  const config = db.read(refs.config(UID));
  db.seed(refs.config(UID), { ...config, version: 'trial-v2', prices: { ...config.prices, meal: 3 } });
  await assert.rejects(service.purchase({ ...original, data: { ...original.data, operationId: 'new' } }), { code: 'RECONFIRM_CONFIG' });
  setNow('2026-09-10T00:00:00Z');
  const replay = await service.purchase(original);
  assert.deepEqual(replay.receipt, first.receipt);
  assert.equal(db.read(walletPath).balance, 28);
  await assert.rejects(service.purchase(purchaseRequest('meal')), { code: 'OPERATION_CONFLICT' });
  const newer = purchaseRequest('meal', 'new-price');
  // Even editing contents without incrementing version requires a fresh quote hash.
  const changed = db.read(refs.config(UID));
  db.seed(refs.config(UID), { ...changed, prices: { ...changed.prices, meal: 4 } });
  await assert.rejects(service.purchase(newer), { code: 'RECONFIRM_CONFIG' });
});

test('non-anonymous UID is required; supplied identity/time/price and legacy public mapping cannot authorize', async () => {
  const { db, service, refs, purchaseRequest } = setup({ needs: EMPTY });
  for (const auth of [undefined, { uid: '' }, { uid: UID, token: { firebase: { sign_in_provider: 'anonymous' } } }, { uid: UID }]) {
    await assert.rejects(service.purchase({ ...purchaseRequest('meal'), auth }), { code: 'UNAUTHENTICATED' });
  }
  for (const extra of [{ uid: 'student-b' }, { price: 0 }, { nowMs: 0 }, { isAdmin: true }]) {
    await assert.rejects(service.purchase(purchaseRequest('meal', 'forged', UID, extra)), { code: 'INVALID_REQUEST' });
  }
  await service.purchase(purchaseRequest('meal', 'same', 'student-b'));
  assert.equal(db.read(walletPath).balance, 30);
  assert.equal(db.read(refs.pet(UID)).paidCare.needs.hunger, 0);
  db.values.delete(`fixture/trustedMapping/${UID}`);
  db.seed('legacy/public/Niblet', { uid: UID, balance: 100 });
  await assert.rejects(service.purchase(purchaseRequest('meal')), /TRUSTED_MAPPING_REQUIRED/u);
});

test('missing/corrupt/conflicting wallet identity and full/insufficient/capped care never debit or write success', async () => {
  for (const value of [undefined, -1, NaN, Infinity, '30', Number.MAX_SAFE_INTEGER + 1]) {
    const { db, service, purchaseRequest } = setup({ needs: EMPTY });
    db.seed(walletPath, { ownerUid: UID, balance: value });
    const before = snapshot(db);
    await assert.rejects(service.purchase(purchaseRequest('meal')), { code: 'CORRUPT_WALLET' });
    assert.deepEqual(snapshot(db), before);
  }
  for (const code of ['NO_EFFECT', 'INSUFFICIENT_FUNDS', 'CARE_CAP', 'CORRUPT_WALLET']) {
    const { db, refs, service, purchaseRequest } = setup({ needs: code === 'NO_EFFECT' ? undefined : EMPTY, balance: code === 'INSUFFICIENT_FUNDS' ? 0 : 30 });
    if (code === 'CARE_CAP') { const pet = db.read(refs.pet(UID)); pet.paidCare.daily.spent = 24; db.seed(refs.pet(UID), pet); }
    if (code === 'CORRUPT_WALLET') db.seed(walletPath, { ownerUid: 'student-b', balance: 30 });
    const before = snapshot(db);
    await assert.rejects(service.purchase(purchaseRequest('meal')), { code });
    assert.deepEqual(snapshot(db), before);
  }
});

test('getState transaction persists completed dates once; failed reads and disabled reads do not write', async () => {
  const { db, refs, service, setNow } = setup();
  setNow('2026-09-10T00:00:00Z');
  db.failCommit = true;
  const before = snapshot(db);
  await assert.rejects(service.getState(request()), /COMMIT_FAILURE/u);
  assert.deepEqual(snapshot(db), before);
  const state = await service.getState(request());
  assert.equal(state.pet.paidCare.checkpoint, '2026-09-09');
  assert.equal(state.pet.paidCare.needs.hunger, 2);
  const commits = db.commits;
  await service.getState(request());
  assert.equal(db.commits, commits);
  db.seed(refs.config(UID), { ...db.read(refs.config(UID)), enabled: false });
  setNow('2026-09-20T00:00:00Z');
  const disabledBefore = snapshot(db);
  assert.equal((await service.getState(request())).enabled, false);
  assert.deepEqual(snapshot(db), disabledBefore);
});

test('purchase receipt separates saved needs from post-decay pre-care needs and exact gain', async () => {
  const { db, refs, service, purchaseRequest, setNow } = setup();
  setNow('2026-09-10T00:00:00Z');
  const { receipt } = await service.purchase(purchaseRequest('snack'));
  assert.equal(receipt.savedNeedsBefore.hunger, 4);
  assert.equal(receipt.needsBefore.hunger, 2);
  assert.equal(receipt.needsAfter.hunger, 3);
  assert.equal(receipt.benefit.amount, 1);
  assert.equal(db.read(refs.pet(UID)).paidCare.checkpoint, '2026-09-09');
});

test('corrupted replay receipts fail closed for bounds, benefit, owner, checkpoint or binding', async () => {
  for (const mutate of [(r) => { r.needsAfter.health = 5; }, (r) => { r.benefit.amount = 4; },
    (r) => { r.needsBefore = null; }, (r) => { r.ownerUid = 'other'; }, (r) => { r.checkpoint = '2099-01-01'; },
    (r) => { r.binding = 'broken'; }, (r) => { r.walletAfter = 999; }]) {
    const { db, refs, service, purchaseRequest } = setup({ needs: EMPTY });
    const req = purchaseRequest('meal');
    await service.purchase(req);
    const path = refs.receipt(UID, 'purchase-1');
    const receipt = db.read(path); mutate(receipt); db.seed(path, receipt);
    const before = snapshot(db);
    await assert.rejects(service.purchase(req), { code: 'CORRUPT_RECEIPT' });
    assert.deepEqual(snapshot(db), before);
  }
});

test('explicit migration has no wallet access/charge and preserves unknown fields; adoption is a distinct purchase', async () => {
  const { db, refs, service, purchaseRequest } = setup({ pet: false });
  db.seed(refs.pet(UID), legacy());
  await assert.rejects(service.getState(request()), { code: 'CORRUPT_STATE' });
  const walletBefore = db.read(walletPath);
  const migrated = await service.migrate(request());
  assert.equal(migrated.duplicate, false);
  assert.deepEqual(migrated.pet.possessions, ['old-hat']);
  assert.equal(migrated.pet.careDays, 12);
  assert.deepEqual(db.read(walletPath), walletBefore);
  assert.equal(db.read(refs.migration(UID)).amount, 0);
  assert.equal((await service.migrate(request())).duplicate, true);
  const adoption = { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878' };
  const req = purchaseRequest('adoption', 'adopt', 'student-b', { adoption });
  await service.purchase(req);
  assert.equal(db.read('fixture/wallets/student-b').balance, 25);
  assert.equal((await service.purchase(req)).duplicate, true);
  assert.deepEqual(db.read(refs.pet('student-b')).paidCare.needs, { hunger: 4, happiness: 4, cleanliness: 4, health: 4 });
});

test('paid game entitlement and its single benefit survive reads, day advance and retries; no payout', async () => {
  const { db, refs, service, purchaseRequest, setNow } = setup({ needs: EMPTY });
  const req = purchaseRequest('game');
  await service.purchase(req);
  const session = db.read(refs.pet(UID)).paidCare.game;
  setNow('2026-09-10T00:00:00Z');
  await service.getState(request());
  assert.deepEqual(db.read(refs.pet(UID)).paidCare.game, session);
  assert.equal(db.read(refs.pet(UID)).paidCare.needs.happiness, 0);
  await service.purchase(req);
  assert.equal(db.read(walletPath).balance, 28);
  assert.equal(db.read(refs.pet(UID)).paidCare.needs.happiness, 0);
  await assert.rejects(service.purchase(purchaseRequest('game', 'second')), { code: 'GAME_ACTIVE' });
});

test('missing wallets/config and migration commit failure leave every stored document unchanged', async () => {
  for (const missing of ['wallet', 'config']) {
    const { db, refs, service, purchaseRequest } = setup({ needs: EMPTY });
    const req = purchaseRequest('meal');
    db.values.delete(missing === 'wallet' ? walletPath : refs.config(UID));
    const before = snapshot(db);
    await assert.rejects(service.purchase(req), new RegExp(missing === 'wallet' ? 'WALLET_MISSING' : 'CONFIG_MISSING', 'u'));
    assert.deepEqual(snapshot(db), before);
  }
  const { db, refs, service } = setup();
  db.seed(refs.pet(UID), legacy());
  const before = snapshot(db);
  db.failCommit = true;
  await assert.rejects(service.migrate(request()), /COMMIT_FAILURE/u);
  assert.deepEqual(snapshot(db), before);
});

test('disabled purchase and corrupt future daily dates never reset spending or advance pet', async () => {
  const { db, refs, service, purchaseRequest } = setup({ needs: EMPTY });
  db.seed(refs.config(UID), { ...db.read(refs.config(UID)), enabled: false });
  let before = snapshot(db);
  await assert.rejects(service.purchase(purchaseRequest('meal')), { code: 'DISABLED' });
  assert.deepEqual(snapshot(db), before);
  const pet = db.read(refs.pet(UID));
  pet.paidCare.daily.date = '2027-01-01';
  pet.paidCare.daily.spent = 24;
  db.seed(refs.pet(UID), pet);
  before = snapshot(db);
  await assert.rejects(service.getState(request()), { code: 'CLOCK_REVERSED' });
  assert.deepEqual(snapshot(db), before);
});
