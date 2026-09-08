// Invoked only by the existing guarded local ownership verifier.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSavedGameService } = require('../../functions/src/yumpals/savedGameService.js');
const { createPaidCareService } = require('../../functions/src/yumpals/paidCareService.js');
const { createUidWalletAdapter } = require('../../functions/src/yumpals/uidWalletAdapter.js');
export async function verifySavedGame({ db, careRefs, walletRefs, pass }) {
  const uid = 'synthetic-b'; const gameId = 'sdk-saved-game';
  const now = () => Date.parse('2026-09-16T00:00:00Z');
  const auth = { uid, token: { firebase: { sign_in_provider: 'password' } } };
  const refs = { ...careRefs, game: (owner, id) => db.doc(`ownershipFixture/main/games/${owner}_${id}`),
    gameTurn: (owner, id) => db.doc(`ownershipFixture/main/gameTurns/${owner}_${id}`) };
  const data = async ref => { const snapshot = await ref.get(); return snapshot.exists ? snapshot.data() : null; };
  // Explicit synthetic eligibility setup, not offline progression evidence.
  await refs.pet(uid).update({ 'paidCare.needs.happiness': 2 });
  const paid = createPaidCareService({ db, refs, now, walletAdapter: createUidWalletAdapter({ refs: walletRefs }) });
  const quote = await paid.getHandheldState({ auth, data: {} });
  const purchase = await paid.purchase({ auth, data: { operationId: gameId, action: 'game', expectedConfigVersion: quote.configVersion, expectedConfigHash: quote.configHash } });
  assert.equal(purchase.receipt.amount, 2);
  let draws = 0;
  const deps = { db, refs, now, ready: () => true, chooseTarget: () => (++draws % 2 ? 'left' : 'right') };
  const game = createSavedGameService(deps);
  const viewRequest = { auth, data: { gameId } };
  const turn = round => ({ auth, data: { gameId, operationId: `sdk-guess-${round}`, round, choice: 'left' } });
  const protectedRefs = [walletRefs.publicProfile('record-b'), walletRefs.privateProfile(uid), refs.receipt(uid, gameId)];
  const protectedBefore = await Promise.all(protectedRefs.map(data));
  const petBefore = await data(refs.pet(uid));
  assert.equal((await game.getGame(viewRequest)).round, 0);
  assert.equal(await data(refs.game(uid, gameId)), null);
  const pair = await Promise.all([game.choose(turn(0)), game.choose(turn(0))]);
  assert.deepEqual(pair.map(result => result.duplicate).sort(), [false, true]);
  assert.deepEqual(pair[0].outcome, pair[1].outcome);
  assert.equal((await game.getGame(viewRequest)).round, 1);
  assert.deepEqual(await Promise.all(protectedRefs.map(data)), protectedBefore);
  pass('real SDK paid game read is noninitializing and concurrent same-ID first turns converge without another charge');
  await game.choose(turn(1));
  const beforeFinal = [await data(refs.game(uid, gameId)), await data(refs.pet(uid))];
  const abortDb = { runTransaction: callback => db.runTransaction(t => callback({ get: ref => t.get(ref), set: (ref, value) => {
    t.set(ref, value); if (ref.path === refs.pet(uid).path) throw new Error('Intentional game completion abort');
  } })) };
  await assert.rejects(createSavedGameService({ ...deps, db: abortDb }).choose(turn(2)), /Intentional game completion abort/u);
  assert.deepEqual([await data(refs.game(uid, gameId)), await data(refs.pet(uid))], beforeFinal);
  assert.equal(await data(refs.gameTurn(uid, 'sdk-guess-2')), null);
  await game.choose(turn(2));
  const final = await game.getGame(viewRequest);
  assert.equal(final.complete, true); assert.equal(final.round, 3);
  for (let round = 0; round < 3; round++) assert.equal((await game.choose(turn(round))).duplicate, true);
  assert.deepEqual(await data(refs.pet(uid)), { ...petBefore, paidCare: { ...petBefore.paidCare, game: null } });
  assert.deepEqual(await Promise.all(protectedRefs.map(data)), protectedBefore);
  pass('real SDK final-round abort rolls back; completion/replays preserve full payment receipt, wallets, benefit and opaque pet progress');
}
