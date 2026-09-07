const test = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp, GeoPoint } = require('firebase-admin/firestore');
const { createOwnershipBootstrap, snapshotFingerprint, manifestFingerprint } = require('../src/yumpals/ownershipBootstrap');
const { createUidWalletAdapter } = require('../src/yumpals/uidWalletAdapter');

// Read snapshots retain SDK values; transactional patch writes preserve their identity.
class Db {
  constructor() { this.values = new Map(); this.version = 0; this.conflicts = 0; this.failAt = 0; this.failCommit = false; }
  seed(path, value) { this.values.set(path, { ...value }); this.version += 1; }
  async runTransaction(callback) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const version = this.version; const data = new Map(this.values); const writes = new Map(); let count = 0;
      const stage = (path, value) => { if (++count === this.failAt) throw new Error('STAGE_FAILURE'); writes.set(path, value); };
      const result = await callback({
        get: async (path) => { assert.equal(writes.size, 0); return { exists: data.has(path), data: () => data.get(path) }; },
        update: (path, fields) => { assert.ok(data.has(path)); stage(path, { ...data.get(path), ...fields }); },
        set: stage,
      });
      if (version !== this.version) { this.conflicts += 1; continue; }
      if (writes.size && this.failCommit) throw new Error('COMMIT_FAILURE');
      for (const [path, value] of writes) this.values.set(path, value);
      if (writes.size) this.version += 1;
      return result;
    }
    throw new Error('RETRIES');
  }
}
const refs = { publicProfile: (id) => `fixture/public/${id}`, privateProfile: (uid) => `fixture/private/${uid}`,
  mapping: (uid) => `fixture/mapping/${uid}`, reverse: (id) => `fixture/reverse/${id}`, audit: (review) => `fixture/audit/${review}` };
const gate = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { resolve, promise }; };
const saved = (db) => new Map(db.values);
function fixture() {
  const db = new Db(); const manifests = new Map(); const authRecords = new Map();
  const opaque = Object.freeze({ timestamp: Timestamp.fromMillis(1234), location: new GeoPoint(-36, 174), progress: ['hat', 'milestone'] });
  for (const [uid, publicId] of [['a', 'record-a'], ['b', 'record-b']]) {
    authRecords.set(uid, { uid, disabled: false, providerData: [{ providerId: 'password' }] });
    for (const path of [refs.publicProfile(publicId), refs.privateProfile(uid)]) db.seed(path, {
      name: 'Same Name', balance: 30, bank_balance: 100.5, given_today: 2, lifetime_given: 7, lifetime_received: 80, opaque,
      ...(path === refs.publicProfile(publicId) ? { uid, claimed: true } : {}),
    });
  }
  const authAdmin = { getUser: async (uid) => { if (!authRecords.has(uid)) throw Object.assign(new Error('Missing'), { code: 'auth/user-not-found' }); return authRecords.get(uid); } };
  const approve = (reviewId = 'review-1', assignments = [['a', 'record-a'], ['b', 'record-b']]) => {
    const manifest = { schemaVersion: 1, reviewId, approval: { operatorUid: 'reviewer', source: 'synthetic independently approved review', approvedAtMs: 1000, decision: 'approved' },
      entries: assignments.map(([uid, publicProfileId]) => ({ uid, publicProfileId,
        expectedPublicHash: snapshotFingerprint(db.values.get(refs.publicProfile(publicProfileId))),
        expectedPrivateHash: snapshotFingerprint(db.values.get(refs.privateProfile(uid))) })) };
    manifests.set(reviewId, { manifest, approvedDigest: manifestFingerprint(manifest) });
    return manifest;
  };
  const service = createOwnershipBootstrap({ db, authAdmin, refs, loadApprovedManifest: async (review) => manifests.get(review) });
  approve(); return { db, service, approve, manifests, authRecords, authAdmin, opaque };
}

test('reviewed dry run writes nothing; same names in distinct records map independently with opaque fields unchanged', async () => {
  const f = fixture(); const before = saved(f.db);
  const plan = await f.service.dryRun('review-1'); assert.equal(plan.ok, true); assert.equal(plan.applied, false); assert.deepEqual(f.db.values, before);
  await f.service.apply('review-1');
  for (const [uid, record] of [['a', 'record-a'], ['b', 'record-b']]) {
    for (const path of [refs.publicProfile(record), refs.privateProfile(uid)]) {
      assert.deepEqual(f.db.values.get(path), { ...before.get(path), ownerUid: uid });
      assert.equal(f.db.values.get(path).opaque, f.opaque);
    }
    assert.deepEqual(f.db.values.get(refs.mapping(uid)), { schemaVersion: 1, ownerUid: uid, publicProfileId: record });
    assert.deepEqual(f.db.values.get(refs.reverse(record)), f.db.values.get(refs.mapping(uid)));
    const adapter = createUidWalletAdapter({ refs });
    const wallet = await f.db.runTransaction((t) => adapter.read(t, uid));
    assert.equal(wallet.balance, 30);
  }
});

test('committed review replay is read-only after newer valid spending; existing mapping is not rewritten', async () => {
  const f = fixture(); await f.service.apply('review-1');
  for (const path of [refs.publicProfile('record-a'), refs.privateProfile('a')]) f.db.seed(path, { ...f.db.values.get(path), balance: 28 });
  const before = saved(f.db);
  assert.equal((await f.service.apply('review-1')).duplicate, true); assert.deepEqual(f.db.values, before);
  f.approve('review-2'); await f.service.apply('review-2');
  for (const [path, value] of before) assert.deepEqual(f.db.values.get(path), value);
});

test('reviewed changes require rereview; absent/null/zero fingerprints are distinct and missing is never repaired to zero', async () => {
  assert.notEqual(snapshotFingerprint({ balance: 0 }), snapshotFingerprint({}));
  assert.notEqual(snapshotFingerprint({ balance: null }), snapshotFingerprint({ balance: 0 }));
  const f = fixture();
  for (const path of [refs.publicProfile('record-a'), refs.privateProfile('a')]) f.db.seed(path, { ...f.db.values.get(path), balance: 29 });
  const before = saved(f.db); const plan = await f.service.dryRun('review-1');
  assert.ok(plan.conflicts.some((c) => c.uid === 'a' && c.code === 'SNAPSHOT_CHANGED'));
  await assert.rejects(f.service.apply('review-1')); assert.deepEqual(f.db.values, before);
  const zero = fixture();
  for (const path of [refs.publicProfile('record-a'), refs.privateProfile('a')]) zero.db.seed(path, { ...zero.db.values.get(path), balance: 0 });
  zero.approve(); await zero.service.apply('review-1'); assert.equal(zero.db.values.get(refs.privateProfile('a')).balance, 0);
});

test('missing/corrupt wallets, banks, ownership or incomplete mappings report per-item conflicts without writes', async () => {
  for (const mutate of [
    (f) => f.db.values.delete(refs.privateProfile('a')),
    (f) => f.db.seed(refs.privateProfile('a'), { ...f.db.values.get(refs.privateProfile('a')), balance: null }),
    (f) => f.db.seed(refs.privateProfile('a'), { ...f.db.values.get(refs.privateProfile('a')), bank_balance: 99 }),
    (f) => f.db.seed(refs.publicProfile('record-a'), { ...f.db.values.get(refs.publicProfile('record-a')), ownerUid: 'b' }),
    (f) => f.db.seed(refs.publicProfile('record-a'), { ...f.db.values.get(refs.publicProfile('record-a')), uid: 'b' }),
    (f) => f.db.seed(refs.mapping('a'), { schemaVersion: 1, ownerUid: 'a', publicProfileId: 'record-a' }),
  ]) {
    const f = fixture(); mutate(f); const before = saved(f.db); const result = await f.service.dryRun('review-1');
    assert.equal(result.ok, false); assert.ok(result.conflicts.some((c) => c.uid === 'a'));
    await assert.rejects(f.service.apply('review-1')); assert.deepEqual(f.db.values, before);
  }
});

test('Auth missing/disabled/anonymous/UID mismatch fail closed without emitting Auth secrets', async () => {
  for (const record of [null, { uid: 'a', disabled: true, providerData: [{ providerId: 'password' }] },
    { uid: 'a', disabled: false, providerData: [] }, { uid: 'a', disabled: false, providerData: [{ providerId: 'anonymous' }] },
    { uid: 'b', disabled: false, providerData: [{ providerId: 'password' }] }]) {
    const f = fixture(); if (record) f.authRecords.set('a', { ...record, email: 'PRIVATE', passwordHash: 'SECRET' }); else f.authRecords.delete('a');
    const before = saved(f.db); const plan = await f.service.dryRun('review-1'); assert.equal(plan.ok, false);
    assert.doesNotMatch(JSON.stringify(plan), /PRIVATE|SECRET/u); await assert.rejects(f.service.apply('review-1')); assert.deepEqual(f.db.values, before);
  }
});

test('tampered or duplicate manifests, absent trusted loader, and changed approval fail before writes', async () => {
  assert.throws(() => createOwnershipBootstrap({}), /TRUSTED_DEPENDENCIES_REQUIRED/u);
  for (const mutate of [
    (f) => { f.manifests.get('review-1').manifest.approval.source = 'altered'; },
    (f) => { f.manifests.get('review-1').manifest.entries.push(f.manifests.get('review-1').manifest.entries[0]); },
    (f) => { f.manifests.get('review-1').manifest.approval.decision = 'pending'; },
    (f) => { f.manifests.get('review-1').manifest.entries[1].publicProfileId = 'record-a'; },
    (f) => { f.manifests.delete('review-1'); },
  ]) { const f = fixture(); mutate(f); const before = saved(f.db); await assert.rejects(f.service.apply('review-1')); assert.deepEqual(f.db.values, before); }
});

test('every write failure and failed commit rolls back ownership, both maps and audit', async () => {
  for (let n = 1; n <= 9; n += 1) {
    const f = fixture(); f.db.failAt = n; const before = saved(f.db);
    await assert.rejects(f.service.apply('review-1'), /STAGE_FAILURE/u); assert.deepEqual(f.db.values, before);
  }
  const f = fixture(); f.db.failCommit = true; const before = saved(f.db);
  await assert.rejects(f.service.apply('review-1'), /COMMIT_FAILURE/u); assert.deepEqual(f.db.values, before);
});

test('competing approved records for one UID retry then refuse remapping', async () => {
  const f = fixture();
  f.db.seed(refs.publicProfile('record-b'), { ...f.db.values.get(refs.publicProfile('record-b')), uid: 'a' });
  f.approve('a-review', [['a', 'record-a']]); f.approve('b-review', [['a', 'record-b']]);
  const run = f.db.runTransaction.bind(f.db); const barrier = gate(); let count = 0;
  f.db.runTransaction = (callback) => run((t) => callback({ ...t, get: async (path) => {
    const snap = await t.get(path); if (path.startsWith('fixture/reverse/') && count < 2) { if (++count === 2) barrier.resolve(); await barrier.promise; } return snap;
  } }));
  const results = await Promise.allSettled([f.service.apply('a-review'), f.service.apply('b-review')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1); assert.ok(f.db.conflicts > 0);
  assert.equal([...f.db.values.keys()].filter((p) => p.startsWith('fixture/mapping/')).length, 1);
});

test('missing/unclaimed public linkage and a reviewed wrong-UID assignment require separate repair', async () => {
  for (const change of [{ uid: null }, { claimed: false }, { claimed: null }, { uid: 'b' }]) {
    const f = fixture(); f.db.seed(refs.publicProfile('record-a'), { ...f.db.values.get(refs.publicProfile('record-a')), ...change });
    f.approve(); const before = saved(f.db); const plan = await f.service.dryRun('review-1');
    assert.ok(plan.conflicts.some((c) => c.code === 'PUBLIC_LINK_REPAIR_REQUIRED'));
    await assert.rejects(f.service.apply('review-1')); assert.deepEqual(f.db.values, before);
  }
  const f = fixture(); f.approve('wrong', [['b', 'record-a']]);
  assert.equal((await f.service.dryRun('wrong')).ok, false);
});

test('same review concurrent apply is idempotent; malformed/batch/ref collision/audit tamper cannot write', async () => {
  const f = fixture();
  const result = await Promise.all([f.service.apply('review-1'), f.service.apply('review-1')]);
  assert.equal(result.filter((r) => !r.duplicate).length, 1); assert.ok(f.db.conflicts > 0);
  const auditRef = refs.audit('review-1');
  f.db.seed(auditRef, { ...f.db.values.get(auditRef), manifestHash: '0'.repeat(64) });
  const before = saved(f.db); await assert.rejects(f.service.apply('review-1')); assert.deepEqual(f.db.values, before);
  for (const mutation of [
    (m) => { m.entries = []; }, (m) => { m.entries = Array(41).fill(m.entries[0]); },
    (m) => { m.entries[0].unexpected = true; }, (m) => { m.entries[0].expectedPublicHash = 'bad'; },
    (m) => { m.entries[0].uid = 'bad/uid'; },
  ]) {
    const x = fixture(); const m = x.manifests.get('review-1').manifest; mutation(m);
    x.manifests.get('review-1').approvedDigest = manifestFingerprint(m);
    const prior = saved(x.db); await assert.rejects(x.service.apply('review-1')); assert.deepEqual(x.db.values, prior);
  }
  const x = fixture();
  const collision = createOwnershipBootstrap({ db: x.db, authAdmin: x.authAdmin,
    refs: { ...refs, reverse: () => refs.mapping('a') }, loadApprovedManifest: async () => x.manifests.get('review-1') });
  await assert.rejects(collision.apply('review-1'), /REFERENCE_COLLISION/u);
});

test('current financial write during reviewed apply forces retry and rereview, never overwrites newer funds', async () => {
  const f = fixture(); f.approve('one', [['a', 'record-a']]); const ready = gate(); const release = gate();
  const run = f.db.runTransaction.bind(f.db);
  f.db.runTransaction = (callback) => run((t) => callback({ ...t, get: async (path) => {
    const snap = await t.get(path); if (path === refs.reverse('record-a')) { ready.resolve(); await release.promise; } return snap;
  } }));
  const pending = f.service.apply('one'); await ready.promise;
  for (const path of [refs.publicProfile('record-a'), refs.privateProfile('a')]) f.db.seed(path, { ...f.db.values.get(path), balance: 32 });
  release.resolve(); await assert.rejects(pending); assert.ok(f.db.conflicts > 0);
  assert.equal(f.db.values.get(refs.publicProfile('record-a')).balance, 32);
  assert.equal(f.db.values.has(refs.mapping('a')), false);
});

test('unrelated SDK, cosmetic and opaque progress changes do not invalidate financial/identity review', async () => {
  const f = fixture();
  const opaque = Object.freeze({ unsupportedObject: new (class UnknownSdkValue {})(), timestamp: Timestamp.fromMillis(9999) });
  for (const path of [refs.publicProfile('record-a'), refs.privateProfile('a')]) {
    f.db.seed(path, { ...f.db.values.get(path), avatar_color: 'new-color', opaque, newProgress: { milestone: 99 } });
  }
  const before = saved(f.db);
  assert.equal((await f.service.dryRun('review-1')).ok, true);
  await f.service.apply('review-1');
  for (const path of [refs.publicProfile('record-a'), refs.privateProfile('a')]) {
    assert.deepEqual(f.db.values.get(path), { ...before.get(path), ownerUid: 'a' });
    assert.equal(f.db.values.get(path).opaque, opaque);
  }
  for (const field of ['uid', 'name', 'claimed', 'ownerUid', 'balance', 'bank_balance', 'lifetime_given', 'lifetime_received',
    'given_today', 'last_given_date', 'training_earned_today', 'training_last_earned_date']) {
    const original = { name: 'Same', balance: 30 };
    assert.notEqual(snapshotFingerprint(original), snapshotFingerprint({ ...original, [field]: 'changed' }), field);
  }
});
