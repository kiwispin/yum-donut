import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTeacherSettingsController, settingsJournalKey, validateSettingsView, teacherSettingsError } from './teacherSettingsClient.js';
import { createPaidSettingsTransport } from './paidSettingsTransport.js';
const H = 'a'.repeat(64);
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const view = (enabled = false, version = 'v1') => ({ configured: true, enabled, version, settingsHash: H, settings: { schemaVersion: 1, controlVersion: 1, version, enabled } });
const missing = () => ({ configured: false, enabled: false, version: null, settingsHash: null, settings: null });
const memory = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const response = (req, uid = 'a') => ({ ...view(req.enabled, `next-${req.operationId}`), duplicate: false, receipt: {
  schemaVersion: 1, actorUid: uid, operationId: req.operationId, request: { ...req }, binding: H, committedAtMs: 1000,
  before: req.expectedVersion === null ? null : { version: req.expectedVersion }, beforeHash: req.expectedSettingsHash,
  after: view(req.enabled, `next-${req.operationId}`).settings, afterHash: H,
} });
function fixture(options = {}) {
  const f = { storage: memory(), identity: { uid: 'a', isAnonymous: false, sandbox: false }, calls: [], events: [], current: view(), ...options };
  f.handle = async (name, data) => {
    if (name === 'yumpalsGetPaidSettings') return f.current;
    const result = response(data); f.current = view(data.enabled, result.version); return result;
  };
  let count = 0;
  f.create = (extra = {}) => createTeacherSettingsController({ ownerUid: 'a', projectId: 'project', enabled: true,
    getIdentity: () => f.identity, storage: f.storage, operationId: () => `id-${++count}`, onChange: s => f.events.push(s),
    transport: (name, data) => { f.calls.push({ name, data }); return f.handle(name, data); }, ...extra });
  f.controller = f.create(); f.key = settingsJournalKey('project', 'a'); return f;
}
test('mount loads only current nonsandbox identity behind separate gate; malformed views never show false Off', async () => {
  for (const identity of [{ uid: 'b', isAnonymous: false, sandbox: false }, { uid: 'a', isAnonymous: true, sandbox: false }, { uid: 'a', isAnonymous: false, sandbox: true }]) {
    const f = fixture({ identity }); await f.controller.start(); assert.equal(f.calls.length, 0); assert.equal(f.controller.getState().quote, null);
  }
  const f = fixture(); await f.create({ enabled: false }).start(); assert.equal(f.calls.length, 0);
  for (const invalid of [null, false, {}, { ...missing(), enabled: true }, { ...view(), settings: { ...view().settings, enabled: true } }, { ...view(), settingsHash: 'bad' }, { ...view(), extra: 1 }]) assert.throws(() => validateSettingsView(invalid));
  assert.deepEqual(validateSettingsView(missing()), missing());
  f.handle = async () => null; await f.controller.start(); assert.equal(f.controller.getState().quote, null);
  for (const reason of ['__proto__', 'constructor', 'toString', 'UNKNOWN', {}, null, 1]) assert.equal(typeof teacherSettingsError({ details: { reason } }), 'string');
  assert.ok(!teacherSettingsError(new Error('SECRET')).includes('SECRET'));
});
test('save persists before dispatch, never optimistic; double clicks blocked and success refresh supplies current state', async () => {
  const f = fixture(); await f.controller.start(); f.controller.setDraft(true);
  const update = deferred(); const refresh = deferred();
  f.handle = (name, data) => {
    if (name === 'yumpalsUpdatePaidSettings') { assert.equal(JSON.parse(f.storage.getItem(f.key)).request.operationId, data.operationId); return update.promise; }
    return refresh.promise;
  };
  const saving = f.controller.save(); await f.controller.save(); f.controller.setDraft(false);
  assert.equal(f.calls.filter(c => c.name === 'yumpalsUpdatePaidSettings').length, 1);
  assert.equal(f.controller.getState().quote.enabled, false); assert.equal(f.controller.getState().draft, true);
  update.resolve(response(f.calls.at(-1).data)); await new Promise(r => setTimeout(r, 0));
  assert.equal(f.storage.getItem(f.key), null); assert.equal(f.controller.getState().quote, null);
  refresh.resolve(view(false, 'another-admin')); await saving;
  assert.equal(f.controller.getState().quote.enabled, false); assert.equal(f.controller.getState().quote.version, 'another-admin');
});
test('lost committed response survives reload with same ID; no automatic replay and historical duplicate is never current', async () => {
  const f = fixture(); await f.controller.start(); f.controller.setDraft(true);
  let committed;
  f.handle = async (name, data) => {
    if (name === 'yumpalsUpdatePaidSettings') { committed = response(data); throw new Error('response lost'); }
    return view(false, 'later');
  };
  await f.controller.save(); const raw = f.storage.getItem(f.key); const oldId = JSON.parse(raw).request.operationId;
  f.controller.dispose(); const reloaded = f.create(); const count = f.calls.length;
  await reloaded.start(); assert.equal(f.calls.length, count + 1); assert.equal(reloaded.getState().pending, true);
  f.handle = async name => name === 'yumpalsGetPaidSettings' ? view(false, 'later') : { ...committed, duplicate: true };
  await reloaded.retry(); assert.equal(f.calls.findLast(c => c.name === 'yumpalsUpdatePaidSettings').data.operationId, oldId);
  assert.equal(reloaded.getState().quote.version, 'later'); assert.equal(reloaded.getState().quote.enabled, false); assert.equal(f.storage.getItem(f.key), null);
});
test('definite conflict clears only matching pending and reloads; other errors retain exact request', async () => {
  for (const reason of ['SETTINGS_CONFLICT', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'CORRUPT_SETTINGS_RECEIPT', 'UNAVAILABLE', 'ROLLOUT_NOT_READY']) {
    const f = fixture(); await f.controller.start(); f.controller.setDraft(true);
    f.handle = async name => { if (name === 'yumpalsGetPaidSettings') return view(false, 'changed'); throw { details: { reason } }; };
    await f.controller.save();
    if (reason !== 'SETTINGS_CONFLICT') assert.equal(f.controller.getState().uncertain, true);
    assert.equal(f.controller.getState().pending, reason !== 'SETTINGS_CONFLICT');
    assert.equal(f.storage.getItem(f.key) === null, reason === 'SETTINGS_CONFLICT');
    if (reason === 'SETTINGS_CONFLICT') assert.equal(f.controller.getState().quote.version, 'changed');
  }
});

test('actual pinned transport inconsistent conflict envelopes retain journal without storing token', async () => {
  for (const [mixed, status] of [[true, 409], [false, 200]]) {
    const f = fixture(); const user = { uid: 'a', isAnonymous: false, getIdToken: async () => 'TOKEN-NEVER-STORED' };
    const transport = createPaidSettingsTransport({ projectId: 'demo-settings-fixture', enabled: true, getCurrentUser: () => user,
      fetchImpl: async (url, options) => {
        const data = JSON.parse(options.body).data;
        if (url.endsWith('yumpalsGetPaidSettings')) return { ok: true, status: 200, json: async () => ({ result: view() }) };
        const error = { status: 'ABORTED', details: { reason: 'SETTINGS_CONFLICT' } };
        return { ok: status === 200, status, json: async () => ({ error, ...(mixed ? { result: response(data) } : {}) }) };
      } });
    const controller = f.create({ transport }); await controller.start(); await controller.save();
    assert.equal(controller.getState().pending, true); assert.equal(controller.getState().uncertain, true);
    const raw = f.storage.getItem(f.key); assert.ok(raw); assert.ok(!raw.includes('TOKEN-NEVER-STORED'));
    assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['ownerUid', 'projectId', 'request', 'schemaVersion']);
  }
});
test('accepted save plus failed fresh read clears journal; refresh retries read only', async () => {
  const f = fixture(); await f.controller.start(); f.controller.setDraft(true);
  f.handle = async (name, data) => { if (name === 'yumpalsUpdatePaidSettings') return response(data); throw new Error('offline'); };
  await f.controller.save(); assert.equal(f.controller.getState().pending, false); assert.equal(f.controller.getState().quote, null);
  const updates = f.calls.filter(c => c.name === 'yumpalsUpdatePaidSettings').length;
  f.handle = async () => view(true, 'fresh'); await f.controller.refresh();
  assert.equal(f.calls.filter(c => c.name === 'yumpalsUpdatePaidSettings').length, updates); assert.equal(f.controller.getState().quote.enabled, true);
});
test('storage failure/corrupt journal blocks dispatch; invalid update response retains journal', async () => {
  for (const method of ['getItem', 'setItem']) {
    const f = fixture(); await f.controller.start(); f.storage[method] = () => { throw new Error('storage'); };
    await f.controller.save(); assert.equal(f.calls.filter(c => c.name === 'yumpalsUpdatePaidSettings').length, 0);
    assert.equal(f.controller.getState().storageBlocked, true); assert.match(f.controller.getState().message, /close and reopen/);
  }
  const uuidFailure = fixture(); const noUuid = uuidFailure.create({ operationId: () => { throw new Error('No UUID'); } });
  await noUuid.start(); await noUuid.save(); assert.equal(uuidFailure.storage.getItem(uuidFailure.key), null); assert.equal(uuidFailure.calls.length, 1);
  const f = fixture(); f.storage.setItem(f.key, JSON.stringify({ bad: true })); await f.controller.start(); assert.equal(f.calls.length, 0);
  for (const alter of [() => null, r => ({ ...r, receipt: { ...r.receipt, actorUid: 'b' } }), r => ({ ...r, receipt: { ...r.receipt, request: { ...r.receipt.request, extra: true } } })]) {
    const x = fixture(); await x.controller.start(); x.handle = async (name, data) => alter(response(data));
    await x.controller.save(); assert.equal(x.controller.getState().pending, true); assert.notEqual(x.storage.getItem(x.key), null);
  }
});
test('identity change/sandbox/unmount ignore delayed results and never clean old journal', async () => {
  for (const change of [f => { f.identity = { ...f.identity, uid: 'b' }; }, f => { f.identity.sandbox = true; }, f => f.controller.dispose()]) {
    const f = fixture(); const delayedRead = deferred(); f.handle = () => delayedRead.promise;
    const reading = f.controller.start(); change(f); const count = f.events.length;
    delayedRead.resolve(view()); await reading; assert.equal(f.events.length, count);
    const x = fixture(); await x.controller.start(); const update = deferred(); x.handle = () => update.promise;
    const saving = x.controller.save(); const raw = x.storage.getItem(x.key); const req = JSON.parse(raw).request;
    change(x); const eventCount = x.events.length; update.resolve(response(req)); await saving;
    assert.equal(x.events.length, eventCount); assert.equal(x.storage.getItem(x.key), raw);
  }
});
test('independent controllers do not overwrite pending or remove replacement journals; scopes separate UID/project', async () => {
  const f = fixture(); const second = f.create(); await f.controller.start(); await second.start();
  const update = deferred(); f.handle = () => update.promise;
  const firstSave = f.controller.save(); const raw = f.storage.getItem(f.key);
  await second.save(); assert.equal(f.storage.getItem(f.key), raw); assert.equal(f.calls.filter(c => c.name === 'yumpalsUpdatePaidSettings').length, 1);
  const replacement = JSON.stringify({ ...JSON.parse(raw), request: { ...JSON.parse(raw).request, operationId: 'replacement' } });
  f.storage.setItem(f.key, replacement); update.resolve(response(JSON.parse(raw).request)); await firstSave;
  assert.equal(f.storage.getItem(f.key), replacement);
  assert.notEqual(settingsJournalKey('project', 'a'), settingsJournalKey('other', 'a'));
  assert.notEqual(settingsJournalKey('project', 'a'), settingsJournalKey('project', 'b'));
  const cross = f.create({ projectId: 'other' }); f.handle = async () => view(); await cross.start(); assert.equal(cross.getState().pending, false);
});
test('App wiring uses separate gate/new transport, stable identity and mounts only inside YumPals settings tab', () => {
  const source = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(source, /VITE_YUMPALS_PAID_CONTROLS === 'enabled'/);
  assert.match(source, /const paidSettingsTransport = createPaidSettingsTransport/);
  assert.match(source, /paidSettingsIdentity = useMemo\(/);
  assert.match(source, /activeTab === 'yumpals'[\s\S]*<YumPalsTeacherSettings/);
  assert.ok(!source.includes('onOpenYumPals'));
  assert.match(source, /Show YumPals preview/);
});
