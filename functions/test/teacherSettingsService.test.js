const test = require('node:test');
const assert = require('node:assert/strict');
const { createTeacherSettingsService, settingsHash } = require('../src/yumpals/teacherSettingsService');
const { createPaidCareService } = require('../src/yumpals/paidCareService');
const { migrateLegacyPet, advancePet, defaultConfig, validateConfig } = require('../src/yumpals/paidCareEngine');
const { setup, legacy, request } = require('./paidCareFixture');
const UID = 'student-a';
const ms = (date) => Date.parse(`${date}T00:00:00Z`);
const admin = (data = {}, uid = 'teacher-a') => ({ auth: { uid, token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'password' } } }, data });
const snapshot = (db) => structuredClone([...db.values]);
function fixture() {
  const f = setup(); let clock = ms('2026-09-07');
  const refs = { settings: () => 'control/settings', legacySettings: () => 'control/legacy', receipt: (uid, id) => `control/receipt/${uid}/${id}` };
  const service = createTeacherSettingsService({ db: f.db, refs, now: () => clock });
  let serial = 0;
  const quoteRequest = async (enabled, operationId = `op-${++serial}`, uid = 'teacher-a') => {
    const quote = await service.getSettings(admin({}, uid));
    return admin({ operationId, expectedVersion: quote.version, expectedSettingsHash: quote.settingsHash, enabled }, uid);
  };
  return { ...f, refs, service, quoteRequest, setDate: (date) => { clock = ms(date); }, now: () => clock };
}

test('teacher auth, strict input and missing initialization are default-off with no inferred authority', async () => {
  const f = fixture(); const before = snapshot(f.db);
  assert.deepEqual(await f.service.getSettings(admin()), { configured: false, enabled: false, settings: null, version: null, settingsHash: null });
  assert.deepEqual(snapshot(f.db), before);
  for (const data of [null, false, true, 0, 1, '', 'text', [], new Date()]) await assert.rejects(f.service.getSettings(admin(data)), { code: 'INVALID_SETTINGS' });
  for (const auth of [undefined, { uid: '' }, { uid: 'teacher-a', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'anonymous' } } }, { uid: 'teacher-a', token: { yumpalsAdmin: 'true', firebase: { sign_in_provider: 'password' } } }, request().auth]) {
    await assert.rejects(f.service.getSettings({ auth, data: {} }));
    await assert.rejects(f.service.updateSettings({ auth, data: { operationId: 'bad', expectedVersion: null, expectedSettingsHash: null, enabled: true } }));
  }
  const req = await f.quoteRequest(false);
  for (const patch of [{ enabled: 1 }, { expectedSettingsHash: 'bad' }, { prices: { meal: 0 } }, { careCap: 1 }, { now: 0 }, { isAdmin: true }]) await assert.rejects(f.service.updateSettings({ ...req, data: { ...req.data, ...patch } }));
  const result = await f.service.updateSettings(req);
  assert.equal(result.enabled, false); assert.deepEqual(result.settings.pauses, [{ from: '2026-09-07', to: null }]);
  assert.deepEqual(result.settings.calendar[0].absences, []);
});

test('settings receipts survive map order/later changes, bind edits, and no-op changes only receipt', async () => {
  const f = fixture(); const req = await f.quoteRequest(true, 'initial');
  const result = await f.service.updateSettings(req);
  const noop = await f.service.updateSettings(await f.quoteRequest(true));
  assert.deepEqual(noop.settings, result.settings);
  await f.service.updateSettings(await f.quoteRequest(false));
  f.setDate('2026-09-09');
  const path = f.refs.receipt('teacher-a', 'initial');
  const reorder = (v) => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)])) : v;
  f.db.seed(path, reorder(f.db.read(path)));
  const before = snapshot(f.db);
  const replay = await f.service.updateSettings(req);
  assert.equal(replay.duplicate, true); assert.deepEqual(replay.settings, result.settings); assert.deepEqual(snapshot(f.db), before);
  await assert.rejects(f.service.updateSettings({ ...req, data: { ...req.data, enabled: false } }), { code: 'OPERATION_CONFLICT' });
  const bad = f.db.read(path); bad.after.enabled = false; f.db.seed(path, bad);
  await assert.rejects(f.service.updateSettings(req), { code: 'CORRUPT_SETTINGS_RECEIPT' });
});

test('cutover requires complete matching pair and refuses marker/legacy-enabled drift without repair', async () => {
  const f = fixture();
  f.db.seed(f.refs.legacySettings(), { enabled: true, other: ['keep'] });
  const req = await f.quoteRequest(false);
  await f.service.updateSettings(req);
  const legacy = f.db.read(f.refs.legacySettings()); assert.deepEqual(legacy.other, ['keep']);
  const current = snapshot(f.db);
  for (const mutate of [() => f.db.values.delete(f.refs.legacySettings()), () => f.db.values.delete(f.refs.settings()),
    () => f.db.seed(f.refs.legacySettings(), { ...legacy, enabled: true }),
    () => f.db.seed(f.refs.legacySettings(), { ...legacy, paidCareControl: null }),
    () => f.db.seed(f.refs.legacySettings(), { ...legacy, paidCareControl: { ...legacy.paidCareControl, settingsPath: 'elsewhere' } })]) {
    for (const [path, value] of current) f.db.seed(path, value);
    mutate(); const before = snapshot(f.db);
    await assert.rejects(f.service.getSettings(admin())); await assert.rejects(f.service.updateSettings(req)); assert.deepEqual(snapshot(f.db), before);
  }
});

test('malformed/bare config, global absence, invalid cap and backwards clock fail without repair', async () => {
  const f = fixture(); const initial = await f.service.updateSettings(await f.quoteRequest(true));
  for (const mutate of [c => { delete c.controlVersion; }, c => { c.controlVersion = 2; }, c => { c.careCap = 1; }, c => { c.prices.meal = 0.5; }, c => { c.calendar[0].absences = [{ from: '2026-09-07', to: '2026-09-08' }]; }, c => { c.pauses = [{ from: '2026-09-07', to: null }]; }]) {
    const config = structuredClone(initial.settings); mutate(config); f.db.seed(f.refs.settings(), config);
    const before = snapshot(f.db);
    await assert.rejects(f.service.getSettings(admin())); assert.deepEqual(snapshot(f.db), before);
  }
  f.db.seed(f.refs.settings(), initial.settings); f.setDate('2026-09-06');
  await assert.rejects(f.service.getSettings(admin()), { code: 'CLOCK_REVERSED' });
  await assert.rejects(f.service.updateSettings(admin({ operationId: 'reverse', expectedVersion: initial.version, expectedSettingsHash: initial.settingsHash, enabled: false })), { code: 'CLOCK_REVERSED' });
});

test('each settings/receipt staging failure and commit failure roll back; two admins CAS under forced overlap', async () => {
  for (const failAt of [1, 2, 3, 4]) {
    const f = fixture(); const req = await f.quoteRequest(true); const before = snapshot(f.db);
    if (failAt === 4) f.db.failCommit = true;
    const db = { runTransaction: (cb) => f.db.runTransaction((t) => {
      let writes = 0;
      return cb({ get: t.get, set: (...args) => { t.set(...args); if (++writes === failAt) throw new Error('STAGE_FAILURE'); } });
    }) };
    const service = createTeacherSettingsService({ db, refs: f.refs, now: f.now });
    await assert.rejects(service.updateSettings(req), /STAGE_FAILURE|COMMIT_FAILURE/); assert.deepEqual(snapshot(f.db), before);
  }
  const f = fixture(); const a = await f.quoteRequest(true, 'a'); const b = await f.quoteRequest(false, 'b', 'teacher-b');
  let release; const barrier = new Promise(r => { release = r; }); let arrivals = 0;
  const db = { runTransaction: cb => f.db.runTransaction(t => cb({ ...t, get: async path => {
    const result = await t.get(path);
    if (path === f.refs.legacySettings() && ++arrivals <= 2) { if (arrivals === 2) release(); await barrier; }
    return result;
  } })) };
  const service = createTeacherSettingsService({ db, refs: f.refs, now: f.now });
  const outcomes = await Promise.allSettled([service.updateSettings(a), service.updateSettings(b)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(x => x.status === 'rejected').reason.code, 'SETTINGS_CONFLICT'); assert.ok(f.db.conflicts > 0);
});

test('same-day adoption off/on and repeated toggles preserve history; multi-day pause has no catchup', async () => {
  const f = fixture(); const initial = await f.service.updateSettings(await f.quoteRequest(true));
  const pet = migrateLegacyPet(legacy(), UID, initial.settings, f.now());
  const baseHash = pet.paidCare.historyHash;
  for (let i = 0; i < 3; i++) {
    const off = await f.service.updateSettings(await f.quoteRequest(false));
    assert.equal(advancePet(pet, UID, off.settings, f.now()), pet);
    await f.service.updateSettings(await f.quoteRequest(true));
  }
  assert.deepEqual((await f.service.getSettings(admin())).settings.pauses, [{ from: '2026-09-07', to: '2026-09-07' }]);
  await f.service.updateSettings(await f.quoteRequest(false));
  f.setDate('2026-09-14');
  const off = await f.service.getSettings(admin()); assert.equal(advancePet(pet, UID, off.settings, f.now()), pet);
  const resumed = await f.service.updateSettings(await f.quoteRequest(true));
  const next = advancePet(pet, UID, resumed.settings, f.now());
  assert.deepEqual(next.paidCare.needs, pet.paidCare.needs); assert.equal(pet.paidCare.historyHash, baseHash);
  assert.ok(next.paidCare.pauseHistoryHash);
  f.setDate('2026-09-16');
  assert.equal(advancePet(next, UID, resumed.settings, f.now()).paidCare.needs.hunger, 3);
  const missing = structuredClone(next); delete missing.paidCare.pauseHistoryHash;
  assert.throws(() => advancePet(missing, UID, resumed.settings, f.now()), { code: 'PAUSE_HISTORY_CHANGED' });
  const changed = structuredClone(resumed.settings); changed.pauses[0].from = '2026-09-09';
  assert.throws(() => advancePet(next, UID, changed, f.now()), { code: 'PAUSE_HISTORY_CHANGED' });
});

test('pauses merge absences/holidays once, remain per UID, cross DST and validate bounded interval history', () => {
  const config = { ...defaultConfig('2026-01-01'), enabled: true, pauses: [{ from: '2026-09-25', to: '2026-09-28' }] };
  config.calendar[0].holidays = ['2026-09-25'];
  const pet = migrateLegacyPet(legacy(), UID, config, ms('2026-09-24'));
  const own = structuredClone(config); own.calendar[0].absences = [{ from: '2026-09-25', to: '2026-09-29' }];
  // Each pet's base calendar is bound independently from adoption.
  const absentPet = migrateLegacyPet(legacy(), UID, own, ms('2026-09-24'));
  assert.equal(advancePet(pet, UID, config, ms('2026-09-30')).paidCare.needs.hunger, 3);
  assert.equal(advancePet(absentPet, UID, own, ms('2026-09-30')).paidCare.needs.hunger, 4);
  for (const pauses of [null, [{ from: '2026-09-25', to: null }], [{ from: '2026-09-25', to: '2026-09-24' }], [{ from: '2026-09-25', to: '2026-09-28' }, { from: '2026-09-28', to: '2026-09-30' }], Array(513).fill({ from: '2026-09-25', to: '2026-09-28' })]) assert.throws(() => validateConfig({ ...config, pauses }));
  const oldConfig = { ...defaultConfig('2026-01-01'), enabled: true };
  const old = migrateLegacyPet(legacy(), UID, oldConfig, ms('2026-09-07'));
  assert.equal(Object.hasOwn(advancePet(old, UID, oldConfig, ms('2026-09-09')).paidCare, 'pauseHistoryHash'), false);
  const long = { ...oldConfig, pauses: [{ from: '2026-09-08', to: '2099-12-31' }] };
  assert.equal(advancePet(old, UID, long, ms('2099-12-31')).paidCare.needs.hunger, 4);
  const autumn = { ...oldConfig, pauses: [{ from: '2026-04-03', to: '2026-04-06' }] };
  const autumnPet = migrateLegacyPet(legacy(), UID, autumn, ms('2026-04-02'));
  assert.equal(advancePet(autumnPet, UID, autumn, ms('2026-04-08')).paidCare.needs.hunger, 3);
});

test('older pet read/care checkpoint stays yesterday before same-day disable; resume preserves prior care/history', async () => {
  const f = fixture(); const initial = await f.service.updateSettings(await f.quoteRequest(true));
  const petRefs = { config: f.refs.settings, pet: uid => `fixture/pets/${uid}`, receipt: (uid, id) => `care/${uid}/${id}`, migration: uid => `migrate/${uid}` };
  f.db.seed(petRefs.pet(UID), migrateLegacyPet(legacy(), UID, initial.settings, f.now()));
  const paid = createPaidCareService({ db: f.db, refs: petRefs, walletAdapter: f.walletAdapter, now: f.now });
  f.setDate('2026-09-10');
  const quote = await paid.getState(request());
  assert.equal(quote.pet.paidCare.checkpoint, '2026-09-09');
  await paid.purchase(request(UID, { action: 'snack', operationId: 'before-off', expectedConfigVersion: quote.configVersion, expectedConfigHash: quote.configHash }));
  const cared = f.db.read(petRefs.pet(UID));
  assert.equal(cared.paidCare.checkpoint, '2026-09-09');
  assert.equal(cared.paidCare.daily.date, '2026-09-10');
  assert.deepEqual(cared.paidCare.needs, { hunger: 3, happiness: 2, cleanliness: 2, health: 4 });
  const historyHash = cared.paidCare.historyHash;
  await f.service.updateSettings(await f.quoteRequest(false));
  for (const date of ['2026-09-10', '2026-09-14']) {
    f.setDate(date); const before = snapshot(f.db);
    assert.deepEqual((await paid.getState(request())).pet, cared);
    assert.deepEqual(snapshot(f.db), before);
    assert.equal(f.db.read(petRefs.pet(UID)).paidCare.historyHash, historyHash);
  }
  await f.service.updateSettings(await f.quoteRequest(true));
  const resumed = (await paid.getState(request())).pet;
  assert.equal(resumed.paidCare.checkpoint, '2026-09-13');
  assert.deepEqual(resumed.paidCare.needs, cared.paidCare.needs);
  assert.ok(resumed.paidCare.pauseHistoryHash);
  assert.equal(f.db.read(`fixture/wallets/${UID}`).balance, 29);
  f.setDate('2026-09-16');
  const continued = (await paid.getState(request())).pet;
  assert.deepEqual(continued.paidCare.needs, { hunger: 2, happiness: 1, cleanliness: 1, health: 4 });
  assert.equal(continued.paidCare.checkpoint, '2026-09-15');
});

test('concurrent identical settings operation commits once and replays original audit', async () => {
  const f = fixture(); const req = await f.quoteRequest(false, 'same');
  let release; const barrier = new Promise(r => { release = r; }); let arrivals = 0;
  const db = { runTransaction: cb => f.db.runTransaction(t => cb({ ...t, get: async path => {
    const result = await t.get(path);
    if (path === f.refs.legacySettings() && ++arrivals <= 2) { if (arrivals === 2) release(); await barrier; }
    return result;
  } })) };
  const service = createTeacherSettingsService({ db, refs: f.refs, now: f.now });
  const results = await Promise.all([service.updateSettings(req), service.updateSettings(req)]);
  assert.equal(results.filter(r => !r.duplicate).length, 1); assert.ok(f.db.conflicts > 0);
  assert.deepEqual(results[0].receipt, results[1].receipt);
  assert.equal([...f.db.values.keys()].filter(path => path.startsWith('control/receipt/')).length, 1);
});

test('disable racing an in-flight purchase forces retry and no debit/effect', async () => {
  const f = fixture(); const initial = await f.service.updateSettings(await f.quoteRequest(true));
  const petRefs = { config: f.refs.settings, pet: uid => `fixture/pets/${uid}`, receipt: (uid, id) => `care/${uid}/${id}`, migration: uid => `migrate/${uid}` };
  const pet = migrateLegacyPet(legacy(), UID, initial.settings, f.now()); pet.paidCare.needs.hunger = 0; f.db.seed(petRefs.pet(UID), pet);
  let reached; const ready = new Promise(r => { reached = r; }); let release; const barrier = new Promise(r => { release = r; }); let first = true;
  const walletAdapter = { ...f.walletAdapter, read: async (t, uid) => {
    const wallet = await f.walletAdapter.read(t, uid);
    if (first) { first = false; reached(); await barrier; } return wallet;
  } };
  const paid = createPaidCareService({ db: f.db, refs: petRefs, walletAdapter, now: f.now });
  const quote = await paid.getState(request());
  const pending = paid.purchase(request(UID, { action: 'meal', operationId: 'race', expectedConfigVersion: quote.configVersion, expectedConfigHash: quote.configHash }));
  await ready; await f.service.updateSettings(await f.quoteRequest(false)); release();
  await assert.rejects(pending, { code: 'RECONFIRM_CONFIG' });
  assert.ok(f.db.conflicts > 0); assert.equal(f.db.read(`fixture/wallets/${UID}`).balance, 30); assert.deepEqual(f.db.read(petRefs.pet(UID)), pet);
  const before = snapshot(f.db); await paid.getState(request()); assert.deepEqual(snapshot(f.db), before);
  assert.notEqual(settingsHash(initial.settings), (await f.service.getSettings(admin())).settingsHash);
});
