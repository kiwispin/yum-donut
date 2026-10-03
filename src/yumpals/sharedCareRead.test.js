import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaidCareTransport } from './paidCareTransport.js';

function fixture() {
  let release; let firstActive = true; let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  let user = { uid: 'student-a', isAnonymous: false, getIdToken: async () => 'synthetic' };
  const t = createPaidCareTransport({ projectId: 'demo-speed', enabled: true, getCurrentUser: () => user,
    fetchImpl: async () => { calls++; await gate; return { ok: true, json: async () => ({ result: { ownerUid: 'student-a', values: [1] } }) }; } });
  return { t, release, calls: () => calls, cancel: () => { firstActive = false; }, switchUser: () => { user = { ...user, uid: 'student-b' }; },
    first: { ownerUid: 'student-a', isActive: () => firstActive }, second: { ownerUid: 'student-a', isActive: () => true } };
}
test('overlapping visibility/focus/mount reads share one request with independent result objects', async () => {
  const f = fixture(); const a = f.t('yumpalsGetPaidCareState', {}, f.first); const b = f.t('yumpalsGetPaidCareState', {}, f.second);
  f.release(); const [one, two] = await Promise.all([a, b]); assert.equal(f.calls(), 1);
  one.values.push(2); assert.deepEqual(two.values, [1]);
});
test('cancelled first consumer does not cancel another active consumer, including StrictMode remount', async () => {
  const f = fixture(); const a = f.t('yumpalsGetPaidCareState', {}, f.first); f.cancel();
  const b = f.t('yumpalsGetPaidCareState', {}, f.second); f.release();
  const results = await Promise.allSettled([a, b]);
  assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled'); assert.equal(f.calls(), 1);
});
test('account switch and malformed read never reuse another consumer’s response', async () => {
  const f = fixture(); const a = f.t('yumpalsGetPaidCareState', {}, f.first); f.switchUser();
  const b = f.t('yumpalsGetPaidCareState', {}, f.second); f.release();
  assert.ok((await Promise.allSettled([a, b])).every(v => v.status === 'rejected'));
  const g = fixture(); const good = g.t('yumpalsGetPaidCareState', {}, g.first);
  const malformed = g.t('yumpalsGetPaidCareState', { extra: true }, g.second); g.release();
  assert.equal((await Promise.allSettled([good, malformed]))[1].status, 'rejected'); assert.equal(g.calls(), 1);
});
test('a purchase invalidates read-sharing so a later read cannot join a pre-purchase snapshot', async () => {
  const f = fixture(); const a = f.t('yumpalsGetPaidCareState', {}, f.first);
  const purchase = f.t('yumpalsPurchaseCare', { operationId: 'paid', action: 'meal', expectedConfigVersion: 'v1', expectedConfigHash: 'a'.repeat(64) }, f.second);
  const b = f.t('yumpalsGetPaidCareState', {}, f.second); f.release();
  await Promise.all([a, purchase, b]); assert.equal(f.calls(), 3);
});
