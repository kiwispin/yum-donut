import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createPaidCareController } from './paidCareClient.js';
import { GIFT_STASHED_EVENT, readStashedGifts, stashGifts } from './giftStash.js';
const require = createRequire(import.meta.url);
const { setup } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');

const memory = () => { const m = new Map(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const target = () => { const events = []; return { events, dispatchEvent: e => events.push(e.type) }; };
const none = { hunger: 0, happiness: 0, cleanliness: 0, health: 0 };

async function reply() {
  const f = setup({ balance: 30, pet: true });
  f.refs.refusal = (uid, id) => `fixture/refusals/${uid}/${id}`;
  class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
  const api = createPaidCareCallables({ ...f, HttpsError, ready: () => true, now: () => Date.parse('2026-09-09T00:00:00Z') });
  const entries = new Map();
  const c = createPaidCareController({ ownerUid: 'student-a', projectId: 'demo-paid-care', enabled: true,
    getIdentity: () => ({ uid: 'student-a', isAnonymous: false, sandbox: false }),
    transport: (name, data) => api.getState({ data, auth: { uid: 'student-a', token: { firebase: { sign_in_provider: 'password' } } } }),
    storage: { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) },
    locks: { request: (_n, _o, callback) => callback() }, operationId: () => 'operation-1' });
  await c.start();
  return c.getState().quote;
}

test('a background reply carrying a gift is kept for today and read back', async () => {
  const view = await reply();
  const visit = { date: view.aucklandDate, welcomeBack: false, gains: { ...none, hunger: 1 } };
  const storage = memory(); const t = target();
  assert.equal(stashGifts('student-a', { ...view, visit }, storage, t), true);
  assert.deepEqual(t.events, [GIFT_STASHED_EVENT]);
  assert.deepEqual(readStashedGifts('student-a', view.aucklandDate, storage), { visit, cheer: null });
  // A later read the same day adds the cheer without losing the visit.
  stashGifts('student-a', { ...view, cheer: { date: view.aucklandDate, gain: 1 } }, storage, t);
  assert.deepEqual(readStashedGifts('student-a', view.aucklandDate, storage), { visit, cheer: { date: view.aucklandDate, gain: 1 } });
  assert.equal(readStashedGifts('student-a', '2026-12-25', storage), null, 'only for that day');
});

test('replies without gifts, for another student, or malformed are never kept', async () => {
  const view = await reply();
  const storage = memory();
  assert.equal(stashGifts('student-a', view, storage, target()), false, 'no gift');
  assert.equal(stashGifts('student-b', { ...view, cheer: { date: view.aucklandDate, gain: 1 } }, storage, target()), false, 'other student');
  assert.equal(stashGifts('student-a', { ...view, cheer: { date: view.aucklandDate, gain: 7 } }, storage, target()), false, 'malformed');
  assert.equal(storage.m.size, 0);
});

test('tampered or broken stored gifts are ignored, and blocked storage never throws', () => {
  const storage = memory();
  storage.setItem('yumpals_pending_gifts_student-a', JSON.stringify({ date: '2026-10-28', visit: { date: '2026-10-28', welcomeBack: false, gains: { hunger: 9 } }, cheer: { date: '2026-10-28', gain: 1 } }));
  assert.deepEqual(readStashedGifts('student-a', '2026-10-28', storage), { visit: null, cheer: { date: '2026-10-28', gain: 1 } });
  storage.setItem('yumpals_pending_gifts_student-a', '{not json');
  assert.equal(readStashedGifts('student-a', '2026-10-28', storage), null);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readStashedGifts('student-a', '2026-10-28', broken), null);
});

test('the tab visibility check keeps gifts and the handheld shows kept gifts', () => {
  const hook = readFileSync(new URL('./useSavedVisibility.js', import.meta.url), 'utf8');
  assert.match(hook, /stashGifts\(uid, result\)/u);
  const handheld = readFileSync(new URL('./YumPalsSavedHandheld.jsx', import.meta.url), 'utf8');
  assert.match(handheld, /quote\.visit \|\| stashed\?\.visit/u);
  assert.match(handheld, /quote\.cheer \|\| stashed\?\.cheer/u);
  assert.match(handheld, /GIFT_STASHED_EVENT/u);
});
