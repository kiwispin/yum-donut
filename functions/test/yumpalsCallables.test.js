const test = require('node:test');
const assert = require('node:assert/strict');
const { createYumPalsHandlers } = require('../src/yumpals/callables');
const { yumPalsUserDoc, yumPalsSettingsDoc } = require('../src/yumpals/paths');
const { createTeacherSettingsService } = require('../src/yumpals/teacherSettingsService');

class FakeHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class FakeSnapshot {
  constructor(value) {
    this.value = value;
    this.exists = value !== undefined;
  }

  data() {
    return this.value;
  }
}

class FakeCollection {
  constructor(db, segments) {
    this.db = db;
    this.segments = segments;
  }

  doc(id) {
    return new FakeDoc(this.db, [...this.segments, id]);
  }
}

class FakeDoc {
  constructor(db, segments) {
    this.db = db;
    this.segments = segments;
  }

  collection(name) {
    return new FakeCollection(this.db, [...this.segments, name]);
  }

  async get() {
    return new FakeSnapshot(this.db.values.get(this.path()));
  }

  path() {
    return this.segments.join('/');
  }
}

class FakeTransaction {
  constructor(db) {
    this.db = db;
    this.operations = [];
  }

  async get(ref) {
    const path = ref.path();
    if (!this.readVersions.has(path)) this.readVersions.set(path, this.db.versions.get(path) || 0);
    if (this.db.readBarrier && !this.barrierWaited) {
      this.barrierWaited = true;
      await this.db.readBarrier.arrive();
    }
    return ref.get();
  }

  set(ref, value, options = {}) {
    this.operations.push({ ref, value, options });
  }
}

class FakeDb {
  constructor() {
    this.values = new Map();
    this.versions = new Map();
    this.failCommitOnce = false;
    this.readBarrier = null;
  }

  collection(name) {
    return new FakeCollection(this, [name]);
  }

  async runTransaction(callback) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const transaction = new FakeTransaction(this);
      transaction.readVersions = new Map();
      const result = await callback(transaction);
      const hasConflict = [...transaction.readVersions.entries()].some(([path, version]) => (this.versions.get(path) || 0) !== version);
      if (hasConflict) continue;
      if (this.failCommitOnce) {
        this.failCommitOnce = false;
        throw new Error('COMMIT_FAILURE');
      }
      for (const operation of transaction.operations) {
        const path = operation.ref.path();
        const value = materialise(operation.value);
        this.values.set(path, operation.options.merge ? { ...(this.values.get(path) || {}), ...value } : value);
        this.versions.set(path, (this.versions.get(path) || 0) + 1);
      }
      return result;
    }
    throw new Error('TRANSACTION_CONFLICT');
  }

  armReadBarrier(expected) {
    let arrivals = 0;
    let release;
    const released = new Promise((resolve) => { release = resolve; });
    this.readBarrier = {
      arrive: async () => {
        arrivals += 1;
        if (arrivals >= expected) release();
        await released;
      },
    };
    return () => { this.readBarrier = null; };
  }
}

function materialise(value) {
  if (Array.isArray(value)) return value.map(materialise);
  if (!value || typeof value !== 'object') return value;
  if (value.__serverTimestamp) return { __serverTimestamp: true };
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, materialise(child)]));
}

function request(uid, { admin = false, anonymous = false, data = {} } = {}) {
  return {
    data,
    auth: {
      uid,
      token: {
        yumpalsAdmin: admin,
        firebase: { sign_in_provider: anonymous ? 'anonymous' : 'password' },
      },
    },
  };
}

function setup() {
  const db = new FakeDb();
  let nowMs = Date.parse('2026-09-07T00:00:00.000Z');
  const handlers = createYumPalsHandlers({
    db,
    FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) },
    HttpsError: FakeHttpsError,
    now: () => nowMs,
  });
  return {
    db,
    handlers,
    setNow(next) {
      nowMs = Date.parse(next);
    },
  };
}

async function enableYumPals(handlers) {
  await handlers.updateSettings(request('teacher-uid', { admin: true, data: { enabled: true } }));
}

async function adopt(handlers, uid, name = 'Same Name') {
  return handlers.adopt(request(uid, {
    data: { species: 'mossbit', name, color: '#d94878', casing: 'berry' },
  }));
}

async function completeCare(handlers, uid, operationPrefix) {
  await handlers.care(request(uid, { data: { action: 'feed', operationId: `${operationPrefix}-feed` } }));
  return handlers.care(request(uid, { data: { action: 'pat', operationId: `${operationPrefix}-pat` } }));
}

test('old routes refuse every own paidCare value before duplicate care/adoption and preserve all records', async () => {
  const { db, handlers } = setup(); await enableYumPals(handlers); await adopt(handlers, 'student');
  await handlers.care(request('student', { data: { action: 'feed', operationId: 'prior' } }));
  const path = yumPalsUserDoc(db, 'student').path(); const saved = db.values.get(path);
  for (const paidCare of [null, undefined, {}, { schemaVersion: 2 }, false]) {
    db.values.set(path, { ...saved, paidCare });
    const before = structuredClone([...db.values]);
    for (const invoke of [() => handlers.getState(request('student')), () => adopt(handlers, 'student'),
      () => handlers.care(request('student', { data: { action: 'feed', operationId: 'prior' } })),
      () => handlers.updatePet(request('student', { data: { name: 'Changed' } }))]) {
      await assert.rejects(invoke(), error => error.code === 'failed-precondition' && /refresh.*updated YumPals/i.test(error.message));
      assert.deepEqual([...db.values], before);
    }
  }
});

test('any own raw cutover marker closes all old routes including petless adoption and teacher settings', async () => {
  const { db, handlers } = setup(); await enableYumPals(handlers); await adopt(handlers, 'student');
  const path = yumPalsSettingsDoc(db).path(); const saved = db.values.get(path);
  for (const paidCareControl of [null, undefined, {}, false, { schemaVersion: 1, mode: 'paid', settingsPath: 'synthetic' }]) {
    db.values.set(path, { ...saved, paidCareControl }); const before = structuredClone([...db.values]);
    for (const invoke of [() => handlers.getState(request('student')), () => adopt(handlers, 'petless'),
      () => handlers.care(request('student', { data: { action: 'feed' } })),
      () => handlers.updatePet(request('student', { data: { name: 'Changed' } })),
      () => enableYumPals(handlers)]) {
      await assert.rejects(invoke(), error => error.code === 'failed-precondition' && /refresh.*updated YumPals/i.test(error.message));
      assert.deepEqual([...db.values], before);
    }
  }
});

test('atomic initial cutover preserves legacy fields and forces in-flight old adoption to retry/refuse', async () => {
  const { db, handlers } = setup(); await enableYumPals(handlers);
  const legacyRef = yumPalsSettingsDoc(db); const original = db.values.get(legacyRef.path());
  db.values.set(legacyRef.path(), { ...original, opaque: { __serverTimestamp: true }, unrelated: ['keep'] });
  const newRef = db.collection('synthetic').doc('settings');
  const wrap = ref => ({ path: ref.path(), original: ref });
  const rawRun = db.runTransaction.bind(db);
  const bridge = { runTransaction: cb => rawRun(t => cb({ get: ref => t.get(ref.original), set: (ref, value, options) => t.set(ref.original, value, options) })) };
  const controls = createTeacherSettingsService({ db: bridge, refs: { settings: () => wrap(newRef), legacySettings: () => wrap(legacyRef),
    receipt: (uid, id) => wrap(db.collection('synthetic').doc(`${uid}-${id}`)) }, now: () => Date.parse('2026-09-07T00:00:00Z') });
  let release; const barrier = new Promise(r => { release = r; }); let reached; const ready = new Promise(r => { reached = r; }); let first = true;
  db.runTransaction = cb => rawRun(t => cb({ get: async ref => {
    const value = await t.get(ref);
    if (ref.path() === legacyRef.path() && first) { first = false; reached(); await barrier; } return value;
  }, set: (...args) => t.set(...args) }));
  const pending = adopt(handlers, 'petless'); await ready;
  await controls.updateSettings(request('teacher', { admin: true, data: { operationId: 'initial', expectedVersion: null, expectedSettingsHash: null, enabled: false } }));
  release(); await assert.rejects(pending, { code: 'failed-precondition' });
  assert.equal(db.values.has(yumPalsUserDoc(db, 'petless').path()), false);
  assert.deepEqual(db.values.get(legacyRef.path()), { ...original, opaque: { __serverTimestamp: true }, unrelated: ['keep'], enabled: false,
    paidCareControl: { schemaVersion: 1, mode: 'paid', settingsPath: newRef.path() } });
});

test('rejects anonymous authors, display-name admin, and arbitrary UID payloads', async () => {
  const { handlers } = setup();
  await assert.rejects(() => handlers.getState(request('anon', { anonymous: true })), { code: 'unauthenticated' });
  await assert.rejects(() => handlers.updateSettings(request('regular', { data: { enabled: true } })), { code: 'permission-denied' });
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a', 'Same Name');
  const otherPet = await handlers.getState(request('uid-b', { data: { uid: 'uid-a' } }));
  assert.equal(otherPet.pet, null);
});

test('uses UID-owned state, trusted server date, atomic daily completion, and idempotent operations', async () => {
  const { handlers } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');
  await adopt(handlers, 'uid-b');

  const firstFeed = await handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'same-operation' } }));
  assert.equal(firstFeed.today.feed, true);
  const repeatedFeed = await handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'same-operation' } }));
  assert.equal(repeatedFeed.duplicate, true);
  await assert.rejects(
    () => handlers.care(request('uid-a', { data: { action: 'pat', operationId: 'same-operation' } })),
    { code: 'already-exists' },
  );
  const completed = await handlers.care(request('uid-a', { data: { action: 'pat', operationId: 'different-operation' } }));
  assert.equal(completed.completed, true);
  assert.equal(completed.pet.careDays, 1);

  const uidBState = await handlers.getState(request('uid-b', { data: { operationId: 'uid-a' } }));
  assert.equal(uidBState.pet.careDays, 0);
});

test('optimistic retry fake converges simultaneous feed/pat and duplicate submissions', async () => {
  const { handlers, db } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');

  const releaseFirstRace = db.armReadBarrier(2);
  const [feed, pat] = await Promise.all([
    handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'race-feed' } })),
    handlers.care(request('uid-a', { data: { action: 'pat', operationId: 'race-pat' } })),
  ]);
  releaseFirstRace();
  assert.equal(feed.pet.careDays + pat.pet.careDays >= 1, true);
  const afterRace = await handlers.getState(request('uid-a'));
  assert.equal(afterRace.pet.careDays, 1);
  assert.equal(afterRace.today.feed, true);
  assert.equal(afterRace.today.pat, true);

  const releaseDuplicateRace = db.armReadBarrier(2);
  const duplicateResults = await Promise.all([
    handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'duplicate-a' } })),
    handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'duplicate-b' } })),
  ]);
  releaseDuplicateRace();
  assert.equal(duplicateResults.filter((result) => result.duplicate).length, 2);

  const auditPaths = [...db.values.keys()].filter((path) => path.includes('/yumpals/main/users/uid-a/audit/'));
  assert.equal(auditPaths.filter((path) => path.includes('race-')).length, 2);
  assert.equal(auditPaths.some((path) => path.includes('/public/')), false);
});

test('failed commit leaves pet, daily record, and audit unchanged before a successful retry', async () => {
  const { handlers, db } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');
  const before = await handlers.getState(request('uid-a'));
  const auditBefore = [...db.values.keys()].filter((path) => path.includes('/audit/')).length;
  db.failCommitOnce = true;
  await assert.rejects(() => handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'commit-retry' } })), { message: 'COMMIT_FAILURE' });
  const afterFailure = await handlers.getState(request('uid-a'));
  assert.deepEqual(afterFailure.pet, before.pet);
  assert.equal(afterFailure.today.feed, false);
  assert.equal([...db.values.keys()].filter((path) => path.includes('/audit/')).length, auditBefore);
  const retry = await handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'commit-retry' } }));
  assert.equal(retry.today.feed, true);
});

test('weekends, holidays, and missed days never create debt or remove progress', async () => {
  const { handlers, setNow } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');
  await completeCare(handlers, 'uid-a', 'monday');
  setNow('2026-09-12T00:00:00.000Z');
  const weekend = await handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'weekend-feed' } }));
  assert.equal(weekend.blockedReason, 'WEEKEND');
  assert.equal(weekend.pet.careDays, 1);

  setNow('2026-09-14T00:00:00.000Z');
  await handlers.updateSettings(request('teacher-uid', { admin: true, data: { holidayDates: ['2026-09-14'] } }));
  const holiday = await handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'holiday-feed' } }));
  assert.equal(holiday.blockedReason, 'HOLIDAY');
  assert.equal(holiday.pet.careDays, 1);
  assert.equal((await handlers.getState(request('uid-a'))).pet.careDays, 1);
});

test('earned milestones persist across slower settings and stage thresholds are explicit', async () => {
  const { handlers, setNow } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');
  for (let day = 0; day < 5; day += 1) {
    setNow(`2026-09-${String(7 + day).padStart(2, '0')}T00:00:00.000Z`);
    await completeCare(handlers, 'uid-a', `day-${day}`);
  }
  const before = await handlers.getState(request('uid-a'));
  assert.equal(before.pet.careDays, 5);
  assert.equal(before.pet.growth.stage, 'budding');
  assert.deepEqual(before.pet.earnedMilestones, ['trick', 'accessory']);

  await handlers.updateSettings(request('teacher-uid', { admin: true, data: { growthSpeed: 'gentle' } }));
  const after = await handlers.getState(request('uid-a'));
  assert.deepEqual(after.pet.earnedMilestones, ['trick', 'accessory']);
  assert.equal(after.pet.growth.stage, 'budding');
});

test('read-only growth never creates a quick-speed phantom reward', async () => {
  const { handlers, setNow } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');
  await completeCare(handlers, 'uid-a', 'standard-day-0');
  setNow('2026-09-08T00:00:00.000Z');
  await completeCare(handlers, 'uid-a', 'standard-day-1');

  const beforeSpeedChange = await handlers.getState(request('uid-a'));
  assert.deepEqual(beforeSpeedChange.pet.earnedMilestones, []);
  await handlers.updateSettings(request('teacher-uid', { admin: true, data: { growthSpeed: 'quick' } }));
  const quickRead = await handlers.getState(request('uid-a'));
  assert.deepEqual(quickRead.pet.earnedMilestones, []);
  assert.deepEqual(quickRead.pet.growth.completed, []);
  await handlers.updateSettings(request('teacher-uid', { admin: true, data: { growthSpeed: 'gentle' } }));
  const gentleRead = await handlers.getState(request('uid-a'));
  assert.deepEqual(gentleRead.pet.earnedMilestones, []);
  assert.deepEqual(gentleRead.pet.growth.completed, []);
});

test('invalid persisted state fails closed and profile saves preserve today status', async () => {
  const { handlers, db } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');
  await handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'profile-feed' } }));
  const profileResponse = await handlers.updatePet(request('uid-a', { data: { name: 'Renamed' } }));
  assert.equal(profileResponse.today.feed, true);
  const afterProfile = await handlers.getState(request('uid-a'));
  assert.equal(afterProfile.pet.name, 'Renamed');
  assert.equal(afterProfile.today.feed, true);

  const invalidRef = yumPalsUserDoc(db, 'corrupt');
  db.values.set(invalidRef.path(), {
    schemaVersion: 1,
    ownerUid: 'corrupt',
    species: 'mossbit',
    name: 'Broken',
    color: '#d94878',
    casing: 'berry',
    reducedMotion: false,
    careDays: -4,
    earnedMilestones: [],
  });
  await assert.rejects(() => handlers.getState(request('corrupt')), { code: 'data-loss' });
  await assert.rejects(() => handlers.care(request('corrupt', { data: { action: 'feed', operationId: 'corrupt-care' } })), { code: 'data-loss' });
  await assert.rejects(() => handlers.updatePet(request('corrupt', { data: { name: 'Still Broken' } })), { code: 'data-loss' });
  assert.equal(db.values.get(invalidRef.path()).careDays, -4);
});

test('invalid daily records reject both care and profile updates, and disabled care writes nothing', async () => {
  const { handlers, db } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');
  const invalidDayRef = yumPalsUserDoc(db, 'uid-a').collection('days').doc('2026-09-07');
  db.values.set(invalidDayRef.path(), { dateKey: '2026-09-07', actions: { feed: 'yes' }, complete: false });
  await assert.rejects(() => handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'invalid-day-care' } })), { code: 'data-loss' });
  await assert.rejects(() => handlers.updatePet(request('uid-a', { data: { name: 'Nope' } })), { code: 'data-loss' });

  db.values.delete(invalidDayRef.path());
  const stateBeforeDisable = await handlers.getState(request('uid-a'));
  const auditBeforeDisable = [...db.values.keys()].filter((path) => path.includes('/audit/')).length;
  await handlers.updateSettings(request('teacher-uid', { admin: true, data: { enabled: false } }));
  await assert.rejects(() => handlers.care(request('uid-a', { data: { action: 'feed', operationId: 'disabled-care' } })), { code: 'failed-precondition' });
  const stateAfterDisable = await handlers.getState(request('uid-a'));
  assert.deepEqual(stateAfterDisable.pet, stateBeforeDisable.pet);
  assert.equal([...db.values.keys()].filter((path) => path.includes('/audit/')).length, auditBeforeDisable + 1);
});

test('client supplied date cannot move server care to another Auckland day', async () => {
  const { handlers } = setup();
  await enableYumPals(handlers);
  await adopt(handlers, 'uid-a');
  const result = await handlers.care(request('uid-a', { data: { action: 'feed', dateKey: '2099-12-31', operationId: 'spoof-date' } }));
  assert.equal(result.today.dateKey, '2026-09-07');
  assert.equal(result.today.feed, true);
});
