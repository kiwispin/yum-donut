const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, request } = require('./paidCareFixture');
const { createSavedGameService } = require('../src/yumpals/savedGameService');
const NOW = Date.parse('2026-09-07T00:00:00Z');
async function fixture() {
  const f = setup({ balance: 30.5, needs: { hunger: 2, happiness: 0, cleanliness: 2, health: 2 } });
  f.refs.game = (uid, id) => `fixture/games/${uid}/${id}`;
  f.refs.gameTurn = (uid, id) => `fixture/gameTurns/${uid}/${id}`;
  const paid = await f.service.purchase(f.purchaseRequest('game', 'game-1'));
  let draws = 0;
  const deps = { db: f.db, refs: f.refs, ready: () => true, now: () => NOW,
    chooseTarget: () => (++draws % 2 ? 'left' : 'right') };
  return { ...f, deps, paid, game: createSavedGameService(deps), draws: () => draws,
    read: (uid = 'student-a', gameId = 'game-1') => request(uid, { gameId }),
    turn: (round, extra = {}) => request('student-a', { gameId: 'game-1', operationId: `turn-${round}`, round, choice: 'left', ...extra }) };
}
const snapshot = f => [...f.db.values].map(([key, value]) => [key, structuredClone(value)]);
test('read never starts a game; three turns finish once without wallet, benefit or receipt changes', async () => {
  const f = await fixture(); const before = snapshot(f);
  assert.deepEqual(await f.game.getGame(f.read()), { schemaVersion: 1, ownerUid: 'student-a', gameId: 'game-1', enabled: true, round: 0, complete: false, score: 0, turns: [] });
  assert.deepEqual(snapshot(f), before); assert.equal(f.draws(), 0);
  const petBefore = f.db.read(f.refs.pet('student-a'));
  for (let round = 0; round < 3; round++) {
    const result = await f.game.choose(f.turn(round));
    assert.equal(result.duplicate, false); assert.equal(result.outcome.round, round);
    assert.equal((await f.game.getGame(f.read())).round, round + 1);
    assert.equal(f.db.read('fixture/wallets/student-a').balance, 28.5);
    assert.deepEqual(f.db.read(f.refs.receipt('student-a', 'game-1')), f.paid.receipt);
  }
  assert.deepEqual(f.db.read(f.refs.pet('student-a')), { ...petBefore, paidCare: { ...petBefore.paidCare, game: null } });
  const view = await f.game.getGame(f.read()); assert.equal(view.complete, true); assert.equal(view.score, 2);
  assert.equal(f.draws(), 3);
  const final = snapshot(f);
  for (let round = 0; round < 3; round++) assert.equal((await f.game.choose(f.turn(round))).duplicate, true);
  assert.deepEqual(snapshot(f), final); assert.equal(f.draws(), 3);
});
test('strict authentication/readiness and exact input fail before mutation or random draw', async () => {
  const f = await fixture(); const before = snapshot(f);
  for (const auth of [undefined, { uid: 'student-a' }, { uid: 'student-a', token: { firebase: { sign_in_provider: 'anonymous' } } }]) {
    await assert.rejects(f.game.getGame({ auth, data: { gameId: 'game-1' } }), { code: 'UNAUTHENTICATED' });
  }
  for (const ready of [undefined, () => false, () => 'true']) {
    const game = createSavedGameService({ ...f.deps, ready, db: { runTransaction: () => { throw new Error('MUST_NOT_READ'); } } });
    await assert.rejects(game.getGame(f.read()), { code: 'ROLLOUT_NOT_READY' });
  }
  for (const data of [null, [], false, {}, { gameId: 'game-1', uid: 'student-a' }, { gameId: '../other' }]) {
    await assert.rejects(f.game.getGame(request('student-a', data)), { code: 'INVALID_REQUEST' });
  }
  for (const extra of [{ round: -1 }, { round: 3 }, { round: 0.5 }, { choice: 'LEFT' }, { operationId: '../bad' }, { target: 'left' }]) {
    await assert.rejects(f.game.choose(f.turn(0, extra)), { code: 'INVALID_REQUEST' });
  }
  assert.deepEqual(snapshot(f), before); assert.equal(f.draws(), 0);
});
test('purchase proof, owner and active entitlement are required; normal care receipts cannot open a game', async () => {
  const f = await fixture();
  await assert.rejects(f.game.getGame(f.read('student-b')), { code: 'GAME_PURCHASE_REQUIRED' });
  await f.service.purchase(f.purchaseRequest('meal', 'meal-1'));
  const before = snapshot(f);
  await assert.rejects(f.game.getGame(f.read('student-a', 'meal-1')), { code: 'GAME_PURCHASE_REQUIRED' });
  assert.deepEqual(snapshot(f), before);
  const pet = f.db.read(f.refs.pet('student-a')); pet.paidCare.game = null; f.db.seed(f.refs.pet('student-a'), pet);
  await assert.rejects(f.game.getGame(f.read()), { code: 'GAME_ENTITLEMENT_MISSING' });
});
test('same request races converge; changed binding and skipped/stale rounds cannot advance', async () => {
  const f = await fixture();
  const results = await Promise.all([f.game.choose(f.turn(0)), f.game.choose(f.turn(0))]);
  assert.deepEqual(results.map(r => r.duplicate).sort(), [false, true]);
  assert.deepEqual(results[0].outcome, results[1].outcome);
  assert.equal((await f.game.getGame(f.read())).round, 1);
  const before = snapshot(f);
  await assert.rejects(f.game.choose(f.turn(0, { choice: 'right' })), { code: 'OPERATION_CONFLICT' });
  await assert.rejects(f.game.choose(f.turn(0, { operationId: 'other' })), { code: 'GAME_ROUND_CONFLICT' });
  await assert.rejects(f.game.choose(f.turn(2)), { code: 'GAME_ROUND_CONFLICT' });
  assert.deepEqual(snapshot(f), before);
});
test('pause preserves progress and permits historical replay; resuming continues the next turn', async () => {
  const f = await fixture(); const original = await f.game.choose(f.turn(0));
  f.db.seed(f.refs.config('student-a'), { ...f.config, enabled: false }); const before = snapshot(f);
  assert.equal((await f.game.getGame(f.read())).enabled, false);
  assert.deepEqual((await f.game.choose(f.turn(0))).outcome, original.outcome);
  await assert.rejects(f.game.choose(f.turn(1)), { code: 'DISABLED' });
  assert.deepEqual(snapshot(f), before);
  f.db.seed(f.refs.config('student-a'), f.config);
  await f.game.choose(f.turn(1)); assert.equal((await f.game.getGame(f.read())).round, 2);
});
test('every completion staging failure and commit failure rolls back game, audit and pet', async () => {
  for (const failAt of [1, 2, 3, 'commit']) {
    const f = await fixture(); await f.game.choose(f.turn(0)); await f.game.choose(f.turn(1));
    const before = snapshot(f); let staged = 0;
    const db = { runTransaction: cb => f.db.runTransaction(t => cb({ ...t, set: (...args) => {
      t.set(...args); if (++staged === failAt) throw new Error('STAGED_FAILURE');
    } })) };
    if (failAt === 'commit') f.db.failCommit = true;
    await assert.rejects(createSavedGameService({ ...f.deps, db }).choose(f.turn(2)), /STAGED_FAILURE|COMMIT_FAILURE/);
    assert.deepEqual(snapshot(f), before);
  }
});
test('unrelated concurrent pet progress and wallet gift survive completion retry', async () => {
  const f = await fixture(); await f.game.choose(f.turn(0)); await f.game.choose(f.turn(1));
  let first = true; let release; let reached;
  const gate = new Promise(resolve => { release = resolve; }); const barrier = new Promise(resolve => { reached = resolve; });
  const db = { runTransaction: cb => f.db.runTransaction(t => cb({ ...t, get: async ref => {
    const value = await t.get(ref);
    if (ref === f.refs.pet('student-a') && first) { first = false; reached(); await gate; }
    return value;
  } })) };
  const work = createSavedGameService({ ...f.deps, db }).choose(f.turn(2)); await barrier;
  const pet = f.db.read(f.refs.pet('student-a')); pet.possessions.push('new-hat'); f.db.seed(f.refs.pet('student-a'), pet);
  const wallet = f.db.read('fixture/wallets/student-a'); wallet.balance += 3; f.db.seed('fixture/wallets/student-a', wallet);
  release(); await work;
  assert.ok(f.db.conflicts >= 1); assert.deepEqual(f.db.read('fixture/wallets/student-a'), wallet);
  assert.deepEqual(f.db.read(f.refs.pet('student-a')), { ...pet, paidCare: { ...pet.paidCare, game: null } });
  assert.deepEqual(f.db.read(f.refs.receipt('student-a', 'game-1')), f.paid.receipt);
});
test('corrupt sessions/audits, reversed clock and invalid target are refused without repair', async () => {
  const f = await fixture();
  await assert.rejects(createSavedGameService({ ...f.deps, now: () => NOW - 1 }).choose(f.turn(0)), { code: 'CLOCK_REVERSED' });
  await assert.rejects(createSavedGameService({ ...f.deps, chooseTarget: () => 'bad' }).choose(f.turn(0)), { code: 'INVALID_GAME_TARGET' });
  await f.game.choose(f.turn(0));
  const auditPath = f.refs.gameTurn('student-a', 'turn-0'); const audit = f.db.read(auditPath);
  f.db.seed(auditPath, { ...audit, correct: !audit.correct }); const before = snapshot(f);
  await assert.rejects(f.game.choose(f.turn(0)), { code: 'CORRUPT_GAME_TURN' }); assert.deepEqual(snapshot(f), before);
  f.db.seed(auditPath, audit);
  const gamePath = f.refs.game('student-a', 'game-1'); const session = f.db.read(gamePath);
  f.db.seed(gamePath, { ...session, complete: true });
  await assert.rejects(f.game.getGame(f.read()), { code: 'CORRUPT_GAME' });
});
test('each saved turn must match its immutable audit before further play or read', async () => {
  const f = await fixture(); await f.game.choose(f.turn(0));
  const path = f.refs.game('student-a', 'game-1'); const session = f.db.read(path);
  session.turns[0].choice = 'right'; session.turns[0].correct = false;
  f.db.seed(path, session); const before = snapshot(f);
  await assert.rejects(f.game.getGame(f.read()), { code: 'CORRUPT_GAME_TURN' });
  await assert.rejects(f.game.choose(f.turn(1)), { code: 'CORRUPT_GAME_TURN' });
  assert.deepEqual(snapshot(f), before);
});
test('completed old-game replay cannot clear or regrant a newer paid game', async () => {
  const f = await fixture();
  for (let round = 0; round < 3; round++) await f.game.choose(f.turn(round));
  await f.service.purchase(f.purchaseRequest('game', 'game-2'));
  const before = snapshot(f);
  assert.equal((await f.game.choose(f.turn(2))).duplicate, true);
  assert.equal((await f.game.getGame(f.read())).complete, true);
  assert.equal((await f.game.getGame(f.read('student-a', 'game-2'))).round, 0);
  assert.deepEqual(snapshot(f), before);
  assert.equal(f.db.read(f.refs.pet('student-a')).paidCare.game.id, 'game-2');
});
