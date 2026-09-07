const test = require('node:test');
const assert = require('node:assert/strict');
const { FakeDb } = require('./paidCareFixture');
const { giveDonutsFromTeams } = require('../src/donutService');
const { failureReply } = require('../src/replies');
const paths = require('../src/firestorePaths');
const { mappingKeyForTeamsUser } = require('../src/identity');
const { localDateLabel } = require('../src/dateKeys');

class TeamsDb extends FakeDb {
  constructor() { super(); this.serial = 0; this.failAt = 0; }
  ref(path) { return { path, doc: (id = `auto-${++this.serial}`) => this.ref(`${path}/${id}`), collection: (id) => this.ref(`${path}/${id}`) }; }
  collection(id) { return this.ref(id); }
  runTransaction(callback) {
    return super.runTransaction(async (t) => {
      const readData = new Map(); let count = 0;
      const stage = (ref, data) => { if (++count === this.failAt) throw new Error('STAGING_FAILURE'); t.set(ref.path, data); };
      return callback({
        get: async (ref) => { const snap = await t.get(ref.path); if (snap.exists) readData.set(ref.path, snap.data()); return snap; },
        set: (ref, data, options) => stage(ref, options?.merge ? { ...readData.get(ref.path), ...data } : data),
        update: (ref, patch) => { assert.ok(readData.has(ref.path)); stage(ref, { ...readData.get(ref.path), ...patch }); },
      });
    });
  }
}
const now = new Date('2026-09-07T00:00:00Z');
const user = (id) => ({ aadObjectId: id, name: id });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { resolve, promise }; };
function setup() {
  const db = new TeamsDb();
  const publicRef = (name) => paths.usersCollection(db).doc(name);
  const privateRef = (uid) => paths.privateProfileDoc(db, uid);
  const mappingRef = (id) => paths.teamsMappingsCollection(db).doc(mappingKeyForTeamsUser(user(id)));
  for (const [name, uid] of [['Sender', 's'], ['Alice', 'a'], ['Bob', 'b']]) {
    db.seed(mappingRef(name).path, { yumName: name, uid });
    db.seed(publicRef(name).path, { name, uid, claimed: true, balance: 30.5, bank_balance: 100, lifetime_received: 50, lifetime_given: 9, extra: { keep: true } });
    db.seed(privateRef(uid).path, { name, balance: 30.5, bank_balance: 100, given_today: 1, last_given_date: localDateLabel(now), extra: { keep: true } });
  }
  db.seed(paths.rosterDoc(db).path, { names: ['Sender', 'Alice', 'Bob', 'Alias', 'Unclaimed', 'Fresh'] });
  const args = { db, FieldValue: { serverTimestamp: () => 'TIME' }, activityId: 'activity-1', senderTeamsUser: user('Sender'),
    recipientTeamsUsers: [user('Alice'), user('Bob')], donutCount: 1, message: 'Thanks', now };
  return { db, publicRef, privateRef, mappingRef, args, run: (overrides = {}) => giveDonutsFromTeams({ ...args, ...overrides }) };
}
const snapshot = (db) => structuredClone([...db.values]);

test('fixture commits returned errors; corrupt second recipient leaves sender, first recipient and all records untouched', async () => {
  const f = setup();
  const probe = f.db.collection('probe').doc('returned-error');
  await f.db.runTransaction(async (t) => { t.set(probe, { committed: true }); return { ok: false }; });
  assert.equal(f.db.read(probe.path).committed, true, 'returned errors DO commit staged writes');
  f.db.seed(f.publicRef('Bob').path, { ...f.db.read(f.publicRef('Bob').path), lifetime_received: null });
  const before = snapshot(f.db);
  assert.deepEqual(await f.run(), { ok: false, code: 'RECIPIENT_BALANCE_CORRUPT' });
  assert.deepEqual(snapshot(f.db), before);
});

test('actual Teams service credits mirrors/counters atomically without sender debit and binds replay payload', async () => {
  const f = setup(); const before = snapshot(f.db);
  const result = await f.run(); assert.equal(result.ok, true); assert.equal(result.total, 2);
  assert.equal(f.db.read(f.privateRef('s').path).balance, 30.5);
  assert.equal(f.db.read(f.privateRef('s').path).given_today, 3);
  assert.equal(f.db.read(f.publicRef('Sender').path).lifetime_given, 11);
  for (const [name, uid] of [['Alice', 'a'], ['Bob', 'b']]) {
    assert.equal(f.db.read(f.publicRef(name).path).balance, 31.5);
    assert.equal(f.db.read(f.privateRef(uid).path).balance, 31.5);
    assert.equal(f.db.read(f.publicRef(name).path).bank_balance, 100);
  }
  const paid = snapshot(f.db);
  assert.equal((await f.run()).code, 'DUPLICATE');
  assert.equal((await f.run({ donutCount: 2 })).code, 'ACTIVITY_CONFLICT');
  assert.equal((await f.run({ recipientTeamsUsers: [user('Alice')] })).code, 'ACTIVITY_CONFLICT');
  assert.equal((await f.run({ message: 'Edited' })).code, 'ACTIVITY_CONFLICT');
  assert.deepEqual(snapshot(f.db), paid);
  const feed = [...f.db.values].filter(([path]) => path.includes('/transactions/'));
  assert.equal(feed.length, 2); assert.ok(feed.every(([, v]) => v.amount === 1));
  for (const [path, data] of before) if (path.includes('/profile/')) assert.deepEqual(f.db.read(path).extra, data.extra);
});

test('every staged write and commit failure rolls back all profiles, counter, feeds and processed activity', async () => {
  for (let n = 1; n <= 9; n += 1) {
    const f = setup(); f.db.failAt = n; const before = snapshot(f.db);
    await assert.rejects(f.run(), /STAGING_FAILURE/u); assert.deepEqual(snapshot(f.db), before);
  }
  const f = setup(); f.db.failCommit = true; const before = snapshot(f.db);
  await assert.rejects(f.run(), /COMMIT_FAILURE/u); assert.deepEqual(snapshot(f.db), before);
});

test('missing, mismatched and protected ownership; alias names/UIDs/self UID refuse before any mutation', async () => {
  const cases = [
    (f) => f.db.values.delete(f.privateRef('a').path),
    (f) => f.db.seed(f.mappingRef('Alice').path, { yumName: 'Alice', uid: 'b' }),
    (f) => f.db.seed(f.publicRef('Alice').path, { ...f.db.read(f.publicRef('Alice').path), ownerUid: 'a' }),
    (f) => f.db.seed(f.privateRef('a').path, { ...f.db.read(f.privateRef('a').path), balance: 2 }),
    (f) => f.db.seed(f.mappingRef('Bob').path, { yumName: 'Alice', uid: 'a' }),
    (f) => { f.db.seed(f.mappingRef('Bob').path, { yumName: 'Bob', uid: 'a' }); f.db.seed(f.publicRef('Bob').path, { ...f.db.read(f.publicRef('Bob').path), uid: 'a' }); },
    (f) => { f.db.seed(f.mappingRef('Alice').path, { yumName: 'Alice', uid: 's' }); f.db.seed(f.publicRef('Alice').path, { ...f.db.read(f.publicRef('Alice').path), uid: 's' }); },
    (f) => f.db.values.delete(f.privateRef('s').path),
  ];
  for (const mutate of cases) { const f = setup(); mutate(f); const before = snapshot(f.db); assert.equal((await f.run()).ok, false); assert.deepEqual(snapshot(f.db), before); }
});

test('Teams-only sender and unclaimed/missing recipients preserve public creation and Teams daily counter', async () => {
  const f = setup();
  f.db.seed(f.mappingRef('Sender').path, { yumName: 'Sender' }); f.db.values.delete(f.publicRef('Sender').path); f.db.values.delete(f.privateRef('s').path);
  f.db.seed(f.mappingRef('Unclaimed').path, { yumName: 'Unclaimed' }); f.db.seed(f.mappingRef('Fresh').path, { yumName: 'Fresh' });
  f.db.seed(f.publicRef('Unclaimed').path, { claimed: false, balance: 5, lifetime_received: 7, bank_balance: 10 });
  const result = await f.run({ recipientTeamsUsers: [user('Unclaimed'), user('Fresh')] });
  assert.equal(result.ok, true);
  assert.equal(f.db.read(f.publicRef('Fresh').path).balance, 1);
  assert.equal(f.db.read(f.publicRef('Unclaimed').path).balance, 6);
  assert.equal(f.db.read(f.publicRef('Sender').path).balance, 0);
  assert.equal(f.db.read(f.privateRef('s').path), undefined);
  assert.equal([...f.db.values].find(([path]) => path.includes('/daily/'))[1].given_today, 2);
});

test('malformed unclaimed UID and missing stable activity ID never write; friendly error replies', async () => {
  for (const uid of [0, false, NaN]) {
    const f = setup(); f.db.seed(f.mappingRef('Alice').path, { yumName: 'Alice' });
    f.db.seed(f.publicRef('Alice').path, { claimed: false, uid, balance: 2, lifetime_received: 2 });
    const before = snapshot(f.db); assert.equal((await f.run()).code, 'ACCOUNT_LINK_CONFLICT'); assert.deepEqual(snapshot(f.db), before);
  }
  for (const activityId of [undefined, '', ' ']) { const f = setup(); const before = snapshot(f.db); assert.equal((await f.run({ activityId })).code, 'ACTIVITY_ID_REQUIRED'); assert.deepEqual(snapshot(f.db), before); }
  for (const code of ['RECIPIENT_BALANCE_CORRUPT', 'ACCOUNT_LINK_CONFLICT', 'ACCOUNT_BALANCE_CONFLICT', 'ACTIVITY_ID_REQUIRED']) {
    assert.match(failureReply(code), /No donuts were sent/u); assert.doesNotMatch(failureReply(code), /corrupt/u);
  }
});

test('deterministic overlap with recipient debit and shared app giving counter retries safely', async () => {
  for (const kind of ['debit', 'counter']) {
    const f = setup(); const run = f.db.runTransaction.bind(f.db); const ready = deferred(); const release = deferred();
    f.db.runTransaction = (callback) => run((t) => {
      const readPrivate = new Set();
      return callback({ ...t, get: async (ref) => {
        const result = await t.get(ref);
        if (['s', 'a', 'b'].some((uid) => ref.path === f.privateRef(uid).path)) readPrivate.add(ref.path);
        if (readPrivate.size === 3) { ready.resolve(); await release.promise; }
        return result;
      } });
    });
    const pending = f.run(); await ready.promise;
    await run(async (t) => {
      if (kind === 'debit') {
        const p = f.publicRef('Alice'); const q = f.privateRef('a'); await t.get(p); await t.get(q);
        t.update(p, { balance: 28.5 }); t.update(q, { balance: 28.5 });
      } else { const ref = f.privateRef('s'); await t.get(ref); t.update(ref, { given_today: 5 }); }
    });
    release.resolve(); const result = await pending;
    assert.ok(f.db.conflicts > 0);
    if (kind === 'debit') { assert.equal(result.ok, true); assert.equal(f.db.read(f.privateRef('a').path).balance, 29.5); }
    else { assert.equal(result.code, 'DAILY_LIMIT'); assert.equal(f.db.read(f.privateRef('a').path).balance, 30.5); }
  }
});

test('legacy processed records still bind matching replay and reject edited payload without a new hash', async () => {
  const f = setup(); await f.run();
  const ref = paths.teamsProcessedCollection(f.db).doc(Buffer.from(f.args.activityId).toString('base64url'));
  const receipt = f.db.read(ref.path); delete receipt.requestBinding; f.db.seed(ref.path, receipt);
  const before = snapshot(f.db);
  assert.equal((await f.run()).code, 'DUPLICATE');
  assert.equal((await f.run({ donutCount: 2 })).code, 'ACTIVITY_CONFLICT');
  assert.equal((await f.run({ message: 'Changed' })).code, 'ACTIVITY_CONFLICT');
  assert.equal((await f.run({ recipientTeamsUsers: [user('Alice')] })).code, 'ACTIVITY_CONFLICT');
  assert.deepEqual(snapshot(f.db), before);
});

test('concurrent identical activities count once; distinct activities retry the shared daily cap', async () => {
  for (const sameId of [true, false]) {
    const f = setup(); const run = f.db.runTransaction.bind(f.db); const barrier = deferred(); let arrivals = 0;
    f.db.runTransaction = (callback) => run((t) => {
      const readPrivate = new Set(); let arrived = false;
      return callback({ ...t, get: async (ref) => {
        const result = await t.get(ref);
        if (['s', 'a', 'b'].some((uid) => ref.path === f.privateRef(uid).path)) readPrivate.add(ref.path);
        if (readPrivate.size === 3 && !arrived && arrivals < 2) {
          arrived = true; arrivals += 1; if (arrivals === 2) barrier.resolve(); await barrier.promise;
        }
        return result;
      } });
    });
    const results = await Promise.all([f.run({ donutCount: 2 }), f.run({ donutCount: 2, activityId: sameId ? 'activity-1' : 'activity-2' })]);
    assert.ok(f.db.conflicts > 0);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.find((r) => !r.ok).code, sameId ? 'DUPLICATE' : 'DAILY_LIMIT');
    assert.equal(f.db.read(f.privateRef('s').path).given_today, 5);
    assert.equal(f.db.read(f.privateRef('a').path).balance, 32.5);
    assert.equal(f.db.read(f.privateRef('s').path).balance, 30.5);
  }
});
