import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaidSettingsTransport } from './paidSettingsTransport.js';
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function fixture(options = {}) {
  const f = { tokens: 0, requests: [], active: true };
  f.user = { uid: 'a', isAnonymous: false, getIdToken: async () => { f.tokens++; return 'synthetic-token'; } };
  f.fetch = async (...args) => { f.requests.push(args); return reply({ result: { checked: true } }); };
  f.transport = createPaidSettingsTransport({ projectId: 'demo-settings-fixture', enabled: true, getCurrentUser: () => f.user, fetchImpl: (...args) => f.fetch(...args), ...options });
  f.context = { ownerUid: 'a', isActive: () => f.active };
  return f;
}
test('pinned token subject and active identity are rechecked after delayed token, before fetch', async () => {
  for (const change of [f => { f.user = null; }, f => { f.user = { ...f.user, uid: 'b' }; }, f => { f.user = { ...f.user }; }, f => { f.active = false; }]) {
    const f = fixture(); const token = deferred(); const captured = f.user;
    captured.getIdToken = () => { assert.equal(f.user, captured); return token.promise; };
    const sending = f.transport('yumpalsGetPaidSettings', {}, f.context);
    change(f); token.resolve('old-owner-token'); await assert.rejects(sending);
    assert.equal(f.requests.length, 0);
  }
});
test('gate, anonymous/mismatched owner, bad target/payload and denied token never fetch', async () => {
  for (const enabled of [false, null, 'enabled']) {
    const f = fixture({ enabled }); await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context)); assert.equal(f.tokens, 0);
  }
  const f = fixture();
  for (const [name, data, context] of [['yumpalsCare', {}, f.context], ['yumpalsGetPaidSettings', { uid: 'b' }, f.context], ['yumpalsGetPaidSettings', {}, { ...f.context, ownerUid: 'b' }]]) await assert.rejects(f.transport(name, data, context));
  assert.equal(f.tokens, 0);
  f.user.isAnonymous = true; await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context)); assert.equal(f.tokens, 0);
  f.user.isAnonymous = false; f.user.getIdToken = async () => { throw new Error('TOKEN SECRET'); };
  await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context), e => !e.message.includes('SECRET')); assert.equal(f.requests.length, 0);
});
test('transport uses fixed callable POST envelope, redirect refusal and sanitized error statuses/reasons', async () => {
  const f = fixture(); assert.deepEqual(await f.transport('yumpalsGetPaidSettings', {}, f.context), { checked: true });
  const [url, options] = f.requests[0];
  assert.equal(url, 'https://us-central1-demo-settings-fixture.cloudfunctions.net/yumpalsGetPaidSettings');
  assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
  assert.equal(options.headers['Content-Type'], 'application/json'); assert.deepEqual(JSON.parse(options.body), { data: {} });
  assert.ok(!options.body.includes('token')); assert.ok(options.signal);
  for (const reason of ['SETTINGS_CONFLICT', '__proto__', 'constructor', { bad: true }, 'unknown']) {
    f.fetch = async () => reply({ error: { status: 'ABORTED', message: 'SECRET', details: { reason } } }, 409);
    await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context), e => e.details.reason === (reason === 'SETTINGS_CONFLICT' ? reason : 'UNAVAILABLE') && !e.message.includes('SECRET'));
  }
  f.fetch = async () => reply({ error: { status: 'INTERNAL', details: { reason: 'SETTINGS_CONFLICT' } } });
  await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context), e => e.details.reason === 'UNAVAILABLE');
  for (const body of [null, {}, { result: {}, extra: true }]) { f.fetch = async () => reply(body); await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context)); }
});

test('framework auth errors have safe copy; mixed/success conflict envelopes never prove refusal', async () => {
  const f = fixture();
  for (const [status, http] of [['UNAUTHENTICATED', 401], ['PERMISSION_DENIED', 403]]) {
    f.fetch = async () => reply({ error: { status, message: 'PRIVATE DETAILS' } }, http);
    await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context), e => e.details.reason === status && !e.message.includes('PRIVATE'));
  }
  const conflict = { status: 'ABORTED', details: { reason: 'SETTINGS_CONFLICT' } };
  for (const [body, http] of [[{ result: {}, error: conflict }, 409], [{ error: conflict }, 200], [{ error: conflict }, 503],
    [{ error: { status: 'ABORTED', details: Object.create({ reason: 'SETTINGS_CONFLICT' }) } }, 409]]) {
    f.fetch = async () => reply(body, http);
    await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context), e => e.details.reason === 'UNAVAILABLE');
  }
});
test('bounded timeout covers token/fetch; request already dispatched may finish for original owner', async () => {
  const f = fixture({ timeoutMs: 5 }); f.user.getIdToken = () => new Promise(() => {});
  await assert.rejects(f.transport('yumpalsGetPaidSettings', {}, f.context)); assert.equal(f.requests.length, 0);
  const x = fixture({ timeoutMs: 5 }); x.fetch = () => new Promise(() => {}); await assert.rejects(x.transport('yumpalsGetPaidSettings', {}, x.context));
  const sent = fixture(); const response = deferred(); sent.fetch = () => response.promise;
  const pending = sent.transport('yumpalsGetPaidSettings', {}, sent.context); await new Promise(r => setTimeout(r, 0));
  sent.active = false; response.resolve(reply({ result: { historical: true } })); assert.deepEqual(await pending, { historical: true });
  // The controller ignores this late result and retains its owner-scoped journal.
});
