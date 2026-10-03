const test = require('node:test');
const assert = require('node:assert/strict');
const { onCall } = require('firebase-functions/v2/https');
const { withPreflightCache } = require('../src/yumpals/preflightCache');
const { readDocuments } = require('../src/yumpals/readDocuments');
const { createPaidCareService } = require('../src/yumpals/paidCareService');
const { createSavedGameService } = require('../src/yumpals/savedGameService');
const { setup, request } = require('./paidCareFixture');

test('preflight wrapper preserves all callable deployment descriptors and only sets an OPTIONS policy header', async () => {
  const calls = []; const receiver = {};
  function original(...args) { calls.push({ receiver: this, args }); return Promise.resolve('unchanged'); }
  const endpoint = onCall({ region: 'us-central1' }, () => 'ok');
  Object.defineProperties(original, Object.getOwnPropertyDescriptors(endpoint));
  const wrapped = withPreflightCache(original);
  assert.deepEqual(Object.getOwnPropertyDescriptors(wrapped), Object.getOwnPropertyDescriptors(original));
  assert.equal(wrapped.__endpoint, original.__endpoint); assert.equal(wrapped.run, original.run);
  for (const method of ['OPTIONS', 'POST', 'GET']) {
    const headers = []; const req = { method }; const res = { setHeader: (...args) => headers.push(args) };
    assert.equal(await wrapped.call(receiver, req, res), 'unchanged');
    assert.deepEqual(headers, method === 'OPTIONS' ? [['Access-Control-Max-Age', '600']] : []);
    assert.equal(calls.at(-1).receiver, receiver); assert.deepEqual(calls.at(-1).args, [req, res]);
  }
});

test('batch document reader keeps ordering, all fields and failures; no empty RPC', async () => {
  const batches = [];
  const t = { getAll: async (...refs) => { batches.push(refs); return refs.map(ref => ({ ref })); }, get: () => assert.fail('unbatched') };
  assert.deepEqual(await readDocuments(t, []), []); assert.equal(batches.length, 0);
  assert.deepEqual(await readDocuments(t, ['a', 'b']), [{ ref: 'a' }, { ref: 'b' }]);
  assert.deepEqual(batches, [['a', 'b']]);
  await assert.rejects(readDocuments({ getAll: async () => { throw new Error('READ_FAILURE'); } }, ['a']), /READ_FAILURE/);
});

function fixture() {
  const f = setup({ needs: { hunger: 0, happiness: 0, cleanliness: 0, health: 2 } });
  Object.assign(f.refs, { refusal: (uid, id) => `refusal/${uid}/${id}`, game: (uid, id) => `game/${uid}/${id}`,
    gameTurn: (uid, id) => `turn/${uid}/${id}`, holidayGlobal: () => 'holiday/global', holidayHistory: () => 'holiday/history' });
  f.db.seed('holiday/global', { holiday_mode: false });
  f.db.seed('holiday/history', { enabled: false, periods: [] });
  const batches = []; let running = 0;
  const db = { runTransaction: cb => f.db.runTransaction(t => cb({ ...t,
    getAll: async (...refs) => { batches.push(refs); running++; try { return await Promise.all(refs.map(ref => t.get(ref))); } finally { running--; } },
    set: (...args) => { assert.equal(running, 0, 'no writes before the batch settles'); return t.set(...args); },
  })) };
  const deps = { ...f, db, now: () => Date.parse('2026-09-07T00:00:00Z') };
  const care = createPaidCareService(deps);
  return { ...f, care, batches, game: createSavedGameService({ ...deps, ready: () => true, chooseTarget: () => 'left' }),
    purchase: async (action, operationId = 'purchase') => {
      const view = await care.getHandheldState(request());
      return request('student-a', { action, operationId, expectedConfigVersion: view.configVersion, expectedConfigHash: view.configHash, includeState: true });
    } };
}

test('batch purchase retains exact documents, atomic balances and receipt-only recovery after account/config removal', async () => {
  const f = fixture(); const req = await f.purchase('meal'); f.batches.length = 0;
  const result = await f.care.purchase(req);
  assert.deepEqual(f.batches, [
    [f.refs.receipt('student-a', 'purchase'), f.refs.refusal('student-a', 'purchase')],
    [f.refs.config('student-a'), f.refs.pet('student-a'), 'holiday/global', 'holiday/history'],
  ]);
  assert.equal(result.receipt.walletAfter, 28); assert.equal(result.state.wallet.balance, 28);
  f.db.values.delete(f.refs.config('student-a')); f.db.values.delete('fixture/trustedMapping/student-a');
  f.batches.length = 0;
  const replay = await f.care.purchase(req);
  assert.deepEqual(replay.receipt, result.receipt); assert.equal(replay.duplicate, true); assert.equal(f.batches.length, 1);
  assert.equal(f.db.read('fixture/wallets/student-a').balance, 28);
});

test('batch reads still fail closed for holiday mismatch and malformed live records', async () => {
  for (const damage of ['holiday', 'pet', 'config', 'wallet', 'commit']) {
    const f = fixture(); const req = await f.purchase('meal');
    if (damage === 'holiday') f.db.seed('holiday/global', { holiday_mode: true });
    if (damage === 'pet') f.db.seed(f.refs.pet('student-a'), { ownerUid: 'other' });
    if (damage === 'config') f.db.values.delete(f.refs.config('student-a'));
    if (damage === 'wallet') f.db.values.delete('fixture/wallets/student-a');
    if (damage === 'commit') f.db.failCommit = true;
    const before = f.db.read('fixture/wallets/student-a');
    if (damage === 'holiday') assert.equal((await f.care.purchase(req)).refusal.reason, 'RECONFIRM_CONFIG');
    else await assert.rejects(f.care.purchase(req));
    assert.deepEqual(f.db.read('fixture/wallets/student-a'), before);
    assert.equal(f.db.read(f.refs.receipt('student-a', 'purchase')), undefined);
  }
});

test('all game documents are batched; previous immutable audits remain checked every turn', async () => {
  const f = fixture(); await f.care.purchase(await f.purchase('game'));
  const choose = round => request('student-a', { gameId: 'purchase', operationId: `guess-${round}`, round, choice: 'left' });
  f.batches.length = 0;
  await f.game.choose(choose(0)); assert.equal(f.batches.length, 1); assert.equal(f.batches[0].length, 7);
  f.batches.length = 0;
  await f.game.choose(choose(1)); assert.equal(f.batches.length, 2);
  assert.deepEqual(f.batches[1], [f.refs.gameTurn('student-a', 'guess-0')]);
  f.db.values.delete(f.refs.gameTurn('student-a', 'guess-0'));
  await assert.rejects(f.game.choose(choose(2)), { code: 'CORRUPT_GAME_TURN' });
  assert.equal(f.db.read(f.refs.gameTurn('student-a', 'guess-2')), undefined);
  assert.equal(f.db.read('fixture/wallets/student-a').balance, 28);
});

test('concurrent batched replays debit only once and refused requests stay refused', async () => {
  const f = fixture(); const req = await f.purchase('meal');
  const results = await Promise.all(Array.from({ length: 12 }, () => f.care.purchase(req)));
  assert.equal(results.filter(result => !result.duplicate).length, 1);
  assert.equal(f.db.read('fixture/wallets/student-a').balance, 28);
  assert.ok(f.db.conflicts > 0);
  const empty = fixture(); const declined = await empty.purchase('meal');
  empty.db.seed('fixture/wallets/student-a', { ownerUid: 'student-a', balance: 0 });
  assert.equal((await empty.care.purchase(declined)).refusal.reason, 'INSUFFICIENT_FUNDS');
  empty.db.values.delete(empty.refs.config('student-a'));
  const replay = await empty.care.purchase(declined);
  assert.equal(replay.duplicate, true); assert.equal(replay.refusal.reason, 'INSUFFICIENT_FUNDS');
  assert.equal(empty.db.read('fixture/wallets/student-a').balance, 0);
});
