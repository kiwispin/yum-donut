const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, request } = require('./paidCareFixture');
const { createSavedGameCallables } = require('../src/yumpals/savedGameCallables');
class HttpsError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}
async function fixture() {
  const f = setup({ needs: { hunger: 2, happiness: 0, cleanliness: 2, health: 2 } });
  f.refs.game = (uid, id) => `fixture/games/${uid}/${id}`;
  f.refs.gameTurn = (uid, id) => `fixture/gameTurns/${uid}/${id}`;
  await f.service.purchase(f.purchaseRequest('game', 'paid-game'));
  const dependencies = { db: f.db, refs: f.refs, HttpsError, ready: () => true,
    now: () => Date.parse('2026-09-07T00:00:00Z'), chooseTarget: () => 'left' };
  return { ...f, dependencies, api: createSavedGameCallables(dependencies) };
}
const read = () => request('student-a', { gameId: 'paid-game' });
const choose = round => request('student-a', { gameId: 'paid-game', operationId: `choice-${round}`, round, choice: 'left' });
test('callable read and three rounds preserve wallet and replay the original outcome', async () => {
  const f = await fixture(); const wallet = f.db.read('fixture/wallets/student-a');
  const receipt = f.db.read(f.refs.receipt('student-a', 'paid-game'));
  assert.equal((await f.api.getGame(read())).round, 0);
  for (let round = 0; round < 3; round++) {
    const original = await f.api.choose(choose(round));
    assert.equal(original.duplicate, false);
    assert.deepEqual(await f.api.choose(choose(round)), { ...original, duplicate: true });
  }
  assert.equal((await f.api.getGame(read())).complete, true);
  assert.deepEqual(f.db.read('fixture/wallets/student-a'), wallet);
  assert.deepEqual(f.db.read(f.refs.receipt('student-a', 'paid-game')), receipt);
});
test('authentication and default-closed readiness prevent database access', async () => {
  const f = await fixture(); let reads = 0;
  const db = { runTransaction() { reads++; throw new Error('private database detail'); } };
  const api = createSavedGameCallables({ ...f.dependencies, db, ready: undefined });
  for (const method of ['getGame', 'choose']) {
    await assert.rejects(api[method]({ data: {} }), { code: 'unauthenticated', details: { reason: 'UNAUTHENTICATED' } });
    await assert.rejects(api[method](read()), { code: 'failed-precondition', details: { reason: 'ROLLOUT_NOT_READY' } });
  }
  assert.equal(reads, 0);
});
test('invalid inputs and stale rounds are sanitized without losing their safe reason', async () => {
  const f = await fixture();
  await assert.rejects(f.api.getGame(request('student-a', { gameId: '../private' })), {
    code: 'invalid-argument', details: { reason: 'INVALID_REQUEST' },
  });
  await assert.rejects(f.api.choose(choose(1)), {
    code: 'failed-precondition', details: { reason: 'GAME_ROUND_CONFLICT' },
  });
});
test('unexpected database errors expose neither database messages nor internal codes', async () => {
  const f = await fixture();
  const api = createSavedGameCallables({ ...f.dependencies, db: { runTransaction() {
    throw Object.assign(new Error('secret student record'), { code: 'PRIVATE_DATABASE_PATH' });
  } } });
  await assert.rejects(api.getGame(read()), error => error.code === 'unavailable'
    && error.details.reason === 'UNAVAILABLE' && !error.message.includes('secret'));
});
