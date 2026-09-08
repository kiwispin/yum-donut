// Invoked only by the existing guarded demo-project emulator runner.
import assert from 'node:assert/strict';
import { createSavedGameController } from '../../src/yumpals/savedGameClient.js';
import { createSavedGameTransport } from '../../src/yumpals/savedGameTransport.js';
const PROJECT = 'demo-yumpals-ownership';
const GET = 'yumpalsGetSavedGame'; const CHOOSE = 'yumpalsChooseSavedGame';
export function routeSavedGameUrl(url) {
  const prefix = `https://us-central1-${PROJECT}.cloudfunctions.net/`;
  assert.ok([`${prefix}${GET}`, `${prefix}${CHOOSE}`].includes(url), 'Refusing non-exact saved-game fixture route');
  return `http://127.0.0.1:5101/${PROJECT}/us-central1/${url.slice(prefix.length)}`;
}
export async function verifySavedGameHttp({ careRefs, walletRefs, anonymous, password, localFetch, pass }) {
  async function token() {
    const response = await localFetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-only', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'synthetic-b@example.test', password, returnSecureToken: true }),
    });
    assert.equal(response.status, 200); return (await response.json()).idToken;
  }
  const credential = await token();
  async function call(name, data, auth = credential) {
    assert.ok([GET, CHOOSE, 'yumpalsGetPaidCareState', 'yumpalsPurchaseCare'].includes(name));
    const response = await localFetch(`http://127.0.0.1:5101/${PROJECT}/us-central1/${name}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify({ data }),
    });
    return { status: response.status, body: await response.json() };
  }
  const refs = [walletRefs.publicProfile('record-b'), walletRefs.privateProfile('synthetic-b'), careRefs.pet('synthetic-b')];
  const snapshot = () => Promise.all(refs.map(async ref => (await ref.get()).data()));
  const before = await snapshot();
  for (const auth of [null, 'bad-token', anonymous.idToken]) {
    for (const name of [GET, CHOOSE]) assert.equal((await call(name, {}, auth)).status, 401);
  }
  for (const name of [GET, CHOOSE]) {
    assert.equal((await call(name, { gameId: '../bad' })).status, 400);
    assert.equal((await call(name, { gameId: 'sdk-saved-game', ownerUid: 'synthetic-a' })).status, 400);
  }
  assert.deepEqual(await snapshot(), before);
  pass('saved-game HTTP auth and exact-input guards preserve wallets and pet');
  // Explicit synthetic eligibility setup, not student repair or offline decay evidence.
  await careRefs.pet('synthetic-b').update({ 'paidCare.needs.happiness': 2 });
  const quote = (await call('yumpalsGetPaidCareState', {})).body.result;
  const gameId = 'http-saved-game';
  const purchase = await call('yumpalsPurchaseCare', { operationId: gameId, action: 'game', expectedConfigVersion: quote.configVersion, expectedConfigHash: quote.configHash });
  assert.equal(purchase.status, 200); assert.equal(purchase.body.result.outcome.status, 'COMMITTED');
  const afterPurchase = await snapshot(); const receipt = (await careRefs.receipt('synthetic-b', gameId).get()).data();
  const user = { uid: 'synthetic-b', isAnonymous: false, getIdToken: token };
  let drop = true; let sends = 0; let reveals = 0; let sequence = 0;
  const transport = createSavedGameTransport({ projectId: PROJECT, enabled: true, getCurrentUser: () => user,
    fetchImpl: async (url, options) => {
      const response = await localFetch(routeSavedGameUrl(url), options);
      if (url.endsWith(CHOOSE)) {
        sends++;
        if (drop && response.ok) { drop = false; await response.json(); throw new Error('Intentional lost game reply'); }
      }
      return response;
    } });
  const entries = new Map();
  const options = { ownerUid: user.uid, projectId: PROJECT, enabled: true, transport,
    getIdentity: () => ({ uid: user.uid, isAnonymous: false, sandbox: false }),
    storage: { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) },
    operationId: () => `http-guess-${++sequence}`, onReveal: () => reveals++ };
  let client = createSavedGameController(options); await client.start(); await client.open(gameId);
  assert.equal(client.getState().game.round, 0); assert.equal(sends, 0);
  await client.choose('left'); assert.equal(client.getState().pending, true);
  const journal = [...entries.values()][0];
  client.dispose(); client = createSavedGameController(options); await client.start();
  assert.equal(sends, 1); assert.equal(client.getState().game.round, 1); assert.equal([...entries.values()][0], journal);
  await client.retry(); assert.equal(client.getState().pending, false); assert.equal(reveals, 0);
  await client.choose('right'); await client.choose('left');
  assert.equal(client.getState().game.complete, true); assert.equal(reveals, 2); assert.equal(entries.size, 0);
  const after = await snapshot();
  assert.deepEqual(after.slice(0, 2), afterPurchase.slice(0, 2));
  assert.deepEqual(after[2], { ...afterPurchase[2], paidCare: { ...afterPurchase[2].paidCare, game: null } });
  assert.deepEqual((await careRefs.receipt('synthetic-b', gameId).get()).data(), receipt);
  client.dispose();
  pass('actual game transport/controller HTTP lost-reply/remount/retry completes once with unchanged wallets, benefit and receipt');
}
