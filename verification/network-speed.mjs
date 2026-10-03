import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] || '.');
const require = createRequire(root + '/functions/package.json');
const { setup, request } = require('./test/paidCareFixture');
const { createAppWalletAdapter, emailCandidates } = require('./src/yumpals/appWalletAdapter');
const { createPaidCareService } = require('./src/yumpals/paidCareService');
const { createSavedGameService } = require('./src/yumpals/savedGameService');
const delayMs = 35;
const delay = () => new Promise(resolve => setTimeout(resolve, delayMs));
function fixture() {
  const f = setup({ needs: { hunger: 0, happiness: 0, cleanliness: 0, health: 2 } });
  Object.assign(f.refs, { refusal: (uid, id) => `refusals/${uid}/${id}`,
    game: (uid, id) => `games/${uid}/${id}`, gameTurn: (uid, id) => `turns/${uid}/${id}`,
    holidayGlobal: () => 'holiday/global', holidayHistory: () => 'holiday/history' });
  f.db.seed('holiday/global', { holiday_mode: false });
  f.db.seed('holiday/history', { enabled: false, periods: [] });
  f.db.seed('public/synthetic', { uid: 'student-a', claimed: true, name: 'Synthetic', balance: 30, bank_balance: 100, lifetime_given: 50 });
  f.db.seed('private/student-a', { uid: 'student-a', balance: 30, bank_balance: 100 });
  const calls = []; const docs = [];
  const db = { runTransaction: callback => f.db.runTransaction(t => {
    let first = null;
    const fetchDoc = async ref => {
      if (ref?.queryUid) {
        docs.push('public/synthetic');
        return { docs: [{ ...await t.get('public/synthetic'), ref: { path: 'public/synthetic' } }] };
      }
      docs.push(ref.path || ref); return t.get(ref.path || ref);
    };
    const read = (kind, refs) => {
      const prior = first;
      const result = (async () => {
        if (prior) await prior;
        calls.push(kind); await delay();
        return Promise.all(refs.map(fetchDoc));
      })();
      if (!first) first = result;
      return result;
    };
    return callback({ get: async ref => (await read('get', [ref]))[0],
      getAll: (...refs) => read('getAll', refs), set: (ref, data) => t.set(ref.path || ref, data) });
  }) };
  const walletAdapter = createAppWalletAdapter({ authAdmin: { getUser: async uid => {
    calls.push('auth'); await delay();
    return { uid, disabled: false, email: emailCandidates('Synthetic')[0], providerData: [{ providerId: 'password' }] };
  } }, publicProfiles: () => ({ where: (_field, _op, uid) => ({ limit: () => ({ queryUid: uid }) }) }),
  privateProfile: uid => ({ path: `private/${uid}` }) });
  const deps = { db, refs: f.refs, walletAdapter, now: () => Date.parse('2026-09-07T00:00:00Z') };
  return { ...f, calls, docs, care: createPaidCareService(deps),
    game: createSavedGameService({ ...deps, ready: () => true, chooseTarget: () => 'left' }) };
}
const results = [];
for (const scenario of ['open', 'purchase', 'replay', 'game-first', 'game-next']) {
  const f = fixture();
  // Config binding includes the trusted holiday projection, as it does live.
  const view = await f.care.getHandheldState(request());
  const purchase = action => request('student-a', { action, operationId: 'paid-1', expectedConfigVersion: view.configVersion,
    expectedConfigHash: view.configHash, includeState: true });
  if (scenario === 'replay') await f.care.purchase(purchase('meal'));
  if (scenario.startsWith('game')) await f.care.purchase(purchase('game'));
  if (scenario === 'game-next') await f.game.choose(request('student-a', { gameId: 'paid-1', operationId: 'round-0', round: 0, choice: 'left' }));
  f.calls.length = 0; f.docs.length = 0;
  const before = performance.now();
  const result = scenario === 'open' ? await f.care.getHandheldState(request())
    : ['purchase', 'replay'].includes(scenario) ? await f.care.purchase(purchase('meal'))
      : await f.game.choose(request('student-a', { gameId: 'paid-1', operationId: 'guess', round: scenario === 'game-next' ? 1 : 0, choice: 'left' }));
  const ms = Math.round(performance.now() - before);
  if (scenario === 'open') assert.equal(result.wallet.balance, 30);
  else if (['purchase', 'replay'].includes(scenario)) { assert.equal(result.receipt.walletAfter, 28); assert.equal(result.duplicate, scenario === 'replay'); }
  else assert.equal(result.outcome.correct, true);
  assert.equal(f.db.read('public/synthetic').balance, scenario === 'open' ? 30 : 28);
  assert.equal(f.db.read('private/student-a').balance, scenario === 'open' ? 30 : 28);
  assert.equal(f.db.read('public/synthetic').bank_balance, 100);
  results.push({ scenario, ms, requests: f.calls, documents: [...f.docs].sort() });
}
console.log(JSON.stringify({ root, delayMs, transactionFirstReadGate: true, results }, null, 2));
