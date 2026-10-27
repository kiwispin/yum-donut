import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPaidCareController, validateHandheldView } from './paidCareClient.js';
import { claimOnce, visitAnimation, visitMessage } from './givingCheer.js';
const require = createRequire(import.meta.url);
const { setup } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');

const none = { hunger: 0, happiness: 0, cleanliness: 0, health: 0 };

async function savedView({ visits = false } = {}) {
  const f = setup({ balance: 30, pet: true, needs: { hunger: 1, happiness: 3, cleanliness: 2, health: 4 } });
  f.refs.refusal = (uid, id) => `fixture/refusals/${uid}/${id}`;
  if (visits) f.refs.visit = (uid, date) => `fixture/visits/${uid}/${date}`;
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

test('well-formed visits are accepted; malformed ones are rejected', async () => {
  const view = await savedView();
  const ok = { date: view.aucklandDate, welcomeBack: false, gains: { ...none, hunger: 1 } };
  assert.deepEqual(validateHandheldView({ ...view, visit: ok }, 'student-a').visit, ok);
  assert.ok(validateHandheldView({ ...view, visit: { ...ok, welcomeBack: true, gains: { hunger: 1, happiness: 1, cleanliness: 1, health: 1 } } }, 'student-a'));
  const bad = [
    { ...ok, date: '2026-01-01' },
    { ...ok, gains: { ...none, hunger: 2 } },
    { ...ok, gains: { hunger: 1, happiness: 1, cleanliness: 0, health: 0 } },
    { ...ok, gains: { hunger: 1 } },
    { ...ok, welcomeBack: 'yes' },
    { ...ok, extra: 1 },
    null,
  ];
  for (const visit of bad) assert.throws(() => validateHandheldView({ ...view, visit }, 'student-a'), JSON.stringify(visit));
  assert.throws(() => validateHandheldView({ ...view, pet: null, visit: ok }, 'student-a'), 'no gift without a pal');
  assert.ok(validateHandheldView({ ...view, visit: ok, cheer: { date: view.aucklandDate, gain: 1 } }, 'student-a'), 'both together');
});

test('messages and animations match the gift', () => {
  const daily = gains => ({ date: '2026-10-28', welcomeBack: false, gains: { ...none, ...gains } });
  assert.equal(visitMessage(daily({ hunger: 1 }), 'Fizzgig'), 'Fizzgig loves your visit! Food +1.');
  assert.equal(visitMessage(daily({ cleanliness: 1 }), 'Fizzgig'), 'Fizzgig loves your visit! Clean +1.');
  assert.equal(visitMessage(daily({}), 'Fizzgig'), 'Fizzgig loves your visit!');
  assert.equal(visitMessage({ ...daily({ health: 1, hunger: 1 }), welcomeBack: true }, 'Fizzgig'), 'Welcome back! Every heart +1.');
  assert.equal(visitMessage({ ...daily({}), welcomeBack: true }, 'Fizzgig'), 'Welcome back! Fizzgig missed you.');
  assert.deepEqual(['hunger', 'happiness', 'cleanliness', 'health'].map(k => visitAnimation(daily({ [k]: 1 }))), ['feed', 'pat', 'clean', 'medicine']);
  assert.equal(visitAnimation({ ...daily({ hunger: 1 }), welcomeBack: true }), 'wake');
  assert.equal(visitAnimation(daily({})), 'pat');
});

test('visits and cheers each play once per owner and date, independently', () => {
  const entries = new Map();
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v) };
  assert.equal(claimOnce('visit', 'visit-a', '2026-10-28', storage), true);
  assert.equal(claimOnce('visit', 'visit-a', '2026-10-28', storage), false);
  assert.equal(claimOnce('cheer', 'visit-a', '2026-10-28', storage), true, 'cheer is separate');
  assert.ok(entries.has('yumpals_cheer_shown_visit-a_2026-10-28'), 'cheer keeps its earlier storage key');
});
