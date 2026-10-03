const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { setup, request } = require('./paidCareFixture');
const { createSavedGameService } = require('../src/yumpals/savedGameService');

test('game transaction overlaps independent reads but preserves receipts, audit and wallet', async t => {
  const f = setup({ needs: { hunger: 2, happiness: 0, cleanliness: 2, health: 2 } });
  f.refs.game = (uid, id) => `games/${uid}/${id}`; f.refs.gameTurn = (uid, id) => `turns/${uid}/${id}`;
  await f.service.purchase(f.purchaseRequest('game', 'game-1'));
  const wallet = f.db.read('fixture/wallets/student-a');
  let inFlight = 0; let peak = 0;
  const db = { runTransaction: fn => f.db.runTransaction(tx => fn({ ...tx, get: async ref => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 40));
    try { return await tx.get(ref); } finally { inFlight--; }
  } })) };
  const game = createSavedGameService({ db, refs: f.refs, ready: () => true, now: () => Date.parse('2026-09-07T00:00:00Z'), chooseTarget: () => 'left' });
  const at = performance.now();
  const result = await game.choose(request('student-a', { gameId: 'game-1', operationId: 'guess-1', round: 0, choice: 'left' }));
  assert.equal(peak, 5); assert.equal(result.duplicate, false); assert.equal(result.outcome.correct, true);
  assert.deepEqual(f.db.read('fixture/wallets/student-a'), wallet);
  assert.deepEqual(f.db.read(f.refs.gameTurn('student-a', 'guess-1')), result.outcome);
  t.diagnostic(`40ms per independent database read: first round ${Math.round(performance.now() - at)}ms; five reads overlap, none removed.`);
});

test('YumPals startup retains all endpoints without loading unused Teams SDK', () => {
  const result = execFileSync(process.execPath, ['-e', `
    const endpoints = require('./index.js');
    console.log(JSON.stringify({ endpoints: Object.keys(endpoints),
      teamsLoaded: Object.keys(require.cache).some(path => /\\/botbuilder\\//.test(path)) }));
  `], { cwd: __dirname + '/..', env: { ...process.env, GCLOUD_PROJECT: 'demo-speed' }, encoding: 'utf8' });
  const report = JSON.parse(result);
  for (const name of ['teamsBot', 'yumpalsGetPaidCareState', 'yumpalsPurchaseCare', 'yumpalsGetSavedGame', 'yumpalsChooseSavedGame']) assert.ok(report.endpoints.includes(name));
  assert.equal(report.teamsLoaded, false);
});
