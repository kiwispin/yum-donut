import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPaidCareController } from './paidCareClient.js';
const require = createRequire(import.meta.url);
const { setup } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');

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

test('the real server visit gift passes the app checks end to end', async () => {
  const view = await savedView({ visits: true });
  assert.equal(view.visit.date, view.aucklandDate);
  assert.equal(view.visit.welcomeBack, false);
  assert.equal(Object.values(view.visit.gains).reduce((a, b) => a + b, 0), 1);
  const without = await savedView();
  assert.equal(Object.hasOwn(without, 'visit'), false, 'older replies unchanged');
});
