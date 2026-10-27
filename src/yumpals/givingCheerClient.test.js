import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPaidCareController, validateHandheldView } from './paidCareClient.js';
import { claimCheerDisplay, cheerMessage } from './givingCheer.js';
const require = createRequire(import.meta.url);
const { setup } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');

async function savedView() {
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

test('a reply without cheer is still accepted exactly as before', async () => {
  const view = await savedView();
  assert.equal(Object.hasOwn(view, 'cheer'), false);
  assert.deepEqual(validateHandheldView(view, 'student-a'), view);
});

test('a well-formed cheer for today is accepted', async () => {
  const view = await savedView();
  for (const gain of [0, 1]) {
    const cheered = { ...view, cheer: { date: view.aucklandDate, gain } };
    assert.deepEqual(validateHandheldView(cheered, 'student-a').cheer, { date: view.aucklandDate, gain });
  }
});

test('malformed cheers are rejected rather than trusted', async () => {
  const view = await savedView();
  const bad = [
    { date: '2026-01-01', gain: 1 },
    { date: view.aucklandDate, gain: 2 },
    { date: view.aucklandDate, gain: -1 },
    { date: view.aucklandDate },
    { date: view.aucklandDate, gain: 1, extra: true },
    null,
  ];
  for (const cheer of bad) assert.throws(() => validateHandheldView({ ...view, cheer }, 'student-a'), `${JSON.stringify(cheer)} rejected`);
  assert.throws(() => validateHandheldView({ ...view, pet: null, cheer: { date: view.aucklandDate, gain: 1 } }, 'student-a'), 'no cheer without a pal');
});

test('each owner sees a cheer once per date, even when storage fails', () => {
  const entries = new Map();
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v) };
  assert.equal(claimCheerDisplay('cheer-a', '2026-10-28', storage), true);
  assert.equal(claimCheerDisplay('cheer-a', '2026-10-28', storage), false, 'same session');
  assert.equal(claimCheerDisplay('cheer-b', '2026-10-28', storage), true, 'another student');
  assert.equal(claimCheerDisplay('cheer-a', '2026-10-29', storage), true, 'next day');
  entries.set('yumpals_cheer_shown_cheer-c_2026-10-28', '1');
  assert.equal(claimCheerDisplay('cheer-c', '2026-10-28', storage), false, 'already shown in an earlier visit');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(claimCheerDisplay('cheer-d', '2026-10-28', broken), true);
  assert.equal(claimCheerDisplay('cheer-d', '2026-10-28', broken), false, 'memory still prevents a replay');
});

test('weekend gifts explain that cheers are for school days', () => {
  assert.equal(cheerMessage('REST_DAY'), 'Giving cheers happen on school days.');
  assert.equal(cheerMessage('OK', 'Fizzgig'), 'Fizzgig heard you gave a donut! Happy +1.');
});
