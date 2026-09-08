import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSavedGameController } from './savedGameClient.js';
import { createSavedGameTransport } from './savedGameTransport.js';
import { validSavedGameView } from './savedGameProtocol.js';
const require = createRequire(import.meta.url);
const { setup, request } = require('../../functions/test/paidCareFixture');
const { createSavedGameService } = require('../../functions/src/yumpals/savedGameService');
async function fixture() {
  const f = setup({ needs: { hunger: 2, happiness: 0, cleanliness: 2, health: 2 } });
  f.refs.game = (uid, id) => `games/${uid}/${id}`; f.refs.gameTurn = (uid, id) => `turns/${uid}/${id}`;
  await f.service.purchase(f.purchaseRequest('game', 'game-1'));
  const service = createSavedGameService({ db: f.db, refs: f.refs, ready: () => true,
    now: () => Date.parse('2026-09-07T00:00:00Z'), chooseTarget: () => 'left' });
  const items = new Map(); let identity = { uid: 'student-a', isAnonymous: false }; let drop = false; let sends = 0; let reveals = 0; let sequence = 0;
  const storage = { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, v), removeItem: k => items.delete(k) };
  const options = { ownerUid: 'student-a', projectId: 'demo-yumpals', enabled: true, storage,
    getIdentity: () => identity, operationId: () => `guess-${++sequence}`, onReveal: () => reveals++,
    transport: async (name, data) => {
      if (name === 'yumpalsGetSavedGame') return service.getGame(request('student-a', data));
      sends++; const result = await service.choose(request('student-a', data));
      if (drop) { drop = false; throw new Error('lost response'); } return result;
    } };
  return { ...f, service, options, items, create: () => createSavedGameController(options),
    drop: () => { drop = true; }, switch: () => { identity = { uid: 'student-b', isAnonymous: false }; },
    counts: () => ({ sends, reveals }) };
}
test('three explicit guesses complete with no extra charge, one reveal each and no journal', async () => {
  const f = await fixture(); const wallet = f.db.read('fixture/wallets/student-a');
  const c = f.create(); await c.start(); assert.deepEqual(f.counts(), { sends: 0, reveals: 0 });
  await c.open('game-1');
  for (let i = 0; i < 3; i++) await c.choose('left');
  assert.equal(c.getState().game.complete, true); assert.equal(f.items.size, 0);
  assert.deepEqual(f.counts(), { sends: 3, reveals: 3 });
  assert.deepEqual(f.db.read('fixture/wallets/student-a'), wallet);
});
test('lost reply survives remount; start only reads; retry uses exact request without reveal', async () => {
  const f = await fixture(); let c = f.create(); await c.start(); await c.open('game-1');
  f.drop(); await c.choose('right'); assert.equal(c.getState().pending, true);
  const raw = [...f.items.values()][0]; c.dispose(); c = f.create(); await c.start();
  assert.equal(c.getState().game.round, 1); assert.equal(f.counts().sends, 1);
  assert.equal([...f.items.values()][0], raw); await c.retry();
  assert.deepEqual(f.counts(), { sends: 2, reveals: 0 }); assert.equal(f.items.size, 0);
});
test('account change blocks further choices; corrupt storage is retained and blocks sending', async () => {
  const f = await fixture(); const c = f.create(); await c.start(); await c.open('game-1'); f.switch(); await c.choose('left');
  assert.equal(f.counts().sends, 0);
  const g = await fixture(); g.items.set('yumpals-saved-guess-v1:demo-yumpals:student-a', '{broken');
  const d = g.create(); await d.start(); await d.open('game-1'); await d.choose('left');
  assert.equal(d.getState().storageBlocked, true); assert.equal(g.items.size, 1); assert.equal(g.counts().sends, 0);
});
test('explicit retry reconciles a round finished elsewhere without replay animation', async () => {
  const f = await fixture(); const c = f.create(); await c.start(); await c.open('game-1');
  await f.service.choose(request('student-a', { gameId: 'game-1', operationId: 'other-device', round: 0, choice: 'right' }));
  await c.choose('left'); assert.equal(c.getState().pending, true);
  await c.retry(); assert.equal(c.getState().pending, false); assert.equal(c.getState().game.round, 1);
  assert.equal(f.counts().reveals, 0);
});
test('view validator refuses wrong owner, fake score and extra fields', async () => {
  const f = await fixture(); const view = await f.service.getGame(request('student-a', { gameId: 'game-1' }));
  assert.equal(validSavedGameView(view, 'student-a', 'game-1'), true);
  for (const change of [{ ownerUid: 'student-b' }, { score: 3 }, { balance: 0 }, { complete: true }]) {
    assert.equal(validSavedGameView({ ...view, ...change }, 'student-a', 'game-1'), false);
  }
});
test('transport pins endpoint, snapshots request before token wait, and rejects changed account', async () => {
  let resolve; let calls = 0; let sent;
  let user = { uid: 'student-a', isAnonymous: false, getIdToken: () => new Promise(r => { resolve = r; }) };
  const t = createSavedGameTransport({ projectId: 'demo-yumpals', enabled: true, getCurrentUser: () => user,
    fetchImpl: async (url, options) => { calls++; sent = { url, options }; return { ok: true, json: async () => ({ result: {} }) }; } });
  const context = { ownerUid: 'student-a', isActive: () => true };
  const data = { gameId: 'game-1', operationId: 'guess-1', round: 0, choice: 'left' };
  const pending = t('yumpalsChooseSavedGame', data, context); data.choice = 'right'; resolve('token'); await pending;
  assert.equal(sent.url, 'https://us-central1-demo-yumpals.cloudfunctions.net/yumpalsChooseSavedGame');
  assert.equal(JSON.parse(sent.options.body).data.choice, 'left'); assert.equal(sent.options.redirect, 'error');
  await assert.rejects(t('constructor', {}, context));
  const changed = t('yumpalsGetSavedGame', { gameId: 'game-1' }, context); user = { ...user }; resolve('token');
  await assert.rejects(changed); assert.equal(calls, 1);
});
