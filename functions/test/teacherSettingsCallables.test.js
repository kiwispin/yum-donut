const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTeacherSettingsCallables } = require('../src/yumpals/teacherSettingsCallables');
const { paidSettingsRefs } = require('../src/yumpals/paidSettingsPaths');
const { FakeDb } = require('./paidCareFixture');
class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
const auth = { uid: 'teacher', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'password' } } };
const initial = { operationId: 'initial', expectedVersion: null, expectedSettingsHash: null, enabled: false };
function fixture(ready = () => true) {
  const db = new FakeDb(); let accesses = 0;
  const run = db.runTransaction.bind(db); db.runTransaction = cb => { accesses++; return run(cb); };
  const refs = { settings: () => 'settings/new', legacySettings: () => 'settings/old', receipt: (uid, id) => `receipt/${uid}/${id}` };
  const handlers = createTeacherSettingsCallables({ db, refs, HttpsError, ready, now: () => Date.parse('2026-09-07T00:00:00Z') });
  return { db, refs, handlers, accesses: () => accesses };
}
test('wrapper denies auth before readiness; strict readiness refuses with zero database access', async () => {
  let readinessCalls = 0;
  const f = fixture(() => { readinessCalls++; return true; });
  for (const who of [undefined, { ...auth, uid: '' }, { ...auth, token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'anonymous' } } }, { ...auth, token: { ...auth.token, yumpalsAdmin: 'true' } }]) {
    for (const method of ['getSettings', 'updateSettings']) await assert.rejects(f.handlers[method]({ auth: who, data: initial }), error => ['UNAUTHENTICATED', 'PERMISSION_DENIED'].includes(error.details.reason));
  }
  assert.equal(readinessCalls, 0); assert.equal(f.accesses(), 0);
  for (const readiness of [false, null, undefined, 'true', 1]) {
    const blocked = fixture(() => readiness);
    for (const method of ['getSettings', 'updateSettings']) await assert.rejects(blocked.handlers[method]({ auth, data: initial }), error => error.code === 'failed-precondition' && error.details.reason === 'ROLLOUT_NOT_READY');
    assert.equal(blocked.accesses(), 0);
  }
});
test('wrapper runs actual settings service/cutover, translates invalid state/input and hides unknown secrets', async () => {
  const f = fixture();
  assert.equal((await f.handlers.getSettings({ auth, data: {} })).configured, false);
  const saved = await f.handlers.updateSettings({ auth, data: initial });
  assert.equal(saved.enabled, false); assert.equal(f.db.read(f.refs.legacySettings()).paidCareControl.mode, 'paid');
  assert.equal((await f.handlers.updateSettings({ auth, data: initial })).duplicate, true);
  await assert.rejects(f.handlers.updateSettings({ auth, data: { ...initial, extra: 'secret' } }), error => error.details.reason === 'INVALID_SETTINGS' && !error.message.includes('secret'));
  f.db.seed(f.refs.settings(), { ...saved.settings, controlVersion: null });
  await assert.rejects(f.handlers.getSettings({ auth, data: {} }), error => error.details.reason === 'INVALID_SETTINGS' && !/controlVersion|corrupt/i.test(error.message));
  f.db.runTransaction = () => { throw new Error('PRIVATE SECRET'); };
  await assert.rejects(f.handlers.getSettings({ auth, data: {} }), error => error.details.reason === 'UNAVAILABLE' && !error.message.includes('SECRET'));
});
test('actual wrapper forced competing initial updates expose definite settings conflict only for loser', async () => {
  const f = fixture(); const raw = f.db.runTransaction.bind(f.db);
  let arrivals = 0; let release; const barrier = new Promise(resolve => { release = resolve; });
  f.db.runTransaction = cb => raw(t => cb({ ...t, get: async ref => {
    const snap = await t.get(ref);
    if (ref === f.refs.legacySettings() && ++arrivals <= 2) { if (arrivals === 2) release(); await barrier; }
    return snap;
  } }));
  const results = await Promise.allSettled([f.handlers.updateSettings({ auth, data: initial }), f.handlers.updateSettings({ auth: { ...auth, uid: 'other' }, data: { ...initial, enabled: true } })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.ok(f.db.conflicts > 0);
  assert.equal(results.find(r => r.status === 'rejected').reason.details.reason, 'SETTINGS_CONFLICT');
});
test('paid paths have valid explicit segments; additive exports preserve prior names/default readiness', () => {
  const ref = segments => ({ path: segments.join('/'), collection: id => ({ doc: name => ref([...segments, id, name]) }) });
  const refs = paidSettingsRefs({ collection: id => ({ doc: name => ref([id, name]) }) });
  assert.match(refs.settings().path, /yumpals\/main\/config\/paidSettings$/);
  assert.equal(refs.receipt('teacher', 'operation').path, `${refs.settings().path}/teachers/teacher/operations/operation`);
  assert.match(refs.legacySettings().path, /config\/settings$/);
  for (const target of [refs.settings(), refs.legacySettings(), refs.receipt('teacher', 'operation')]) assert.equal(target.path.split('/').length % 2, 0);
  const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  for (const name of ['teamsBot', 'yumpalsGetState', 'yumpalsAdopt', 'yumpalsCare', 'yumpalsUpdatePet', 'yumpalsUpdateSettings', 'yumpalsGetPaidSettings', 'yumpalsUpdatePaidSettings']) assert.equal((source.match(new RegExp(`exports\\.${name} =`, 'g')) || []).length, 1);
  assert.match(source, /defineBoolean\('YUMPALS_PAID_SETTINGS_READY', \{ default: false \}\)/);
});
