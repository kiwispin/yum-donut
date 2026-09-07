const test = require('node:test');
const assert = require('node:assert/strict');
const { createUidWalletAdapter } = require('../src/yumpals/uidWalletAdapter');
const { createPaidCareService } = require('../src/yumpals/paidCareService');
const { setup } = require('./paidCareFixture');

const UID = 'student-a';
const refs = {
  mapping: (uid) => `fixture/ownedMappings/${uid}`,
  publicProfile: (id) => `artifacts/fixture/public/data/users/${id}`,
  privateProfile: (uid) => `artifacts/fixture/users/${uid}/profile/data`,
};
const publicPath = refs.publicProfile('record-a');
const privatePath = refs.privateProfile(UID);
const snapshot = (db) => structuredClone([...db.values]);

function fixture() {
  const base = setup({ needs: { hunger: 0, happiness: 0, cleanliness: 0, health: 0 } });
  for (const [uid, id] of [[UID, 'record-a'], ['student-b', 'record-b']]) {
    base.db.seed(refs.mapping(uid), { schemaVersion: 1, ownerUid: uid, publicProfileId: id });
    for (const [path, extra] of [[refs.publicProfile(id), { publicOnly: true }], [refs.privateProfile(uid), { privateOnly: true }]]) {
      base.db.seed(path, { ownerUid: uid, uid, name: 'Same Name', balance: 30, bank_balance: 100,
        given_today: 3, lifetime_given: 50, lifetime_received: 80, unknown: { nested: ['keep'] }, ...extra });
    }
  }
  const adapter = createUidWalletAdapter({ refs });
  const makeService = (walletAdapter = adapter) => createPaidCareService({ db: base.db, refs: base.refs, walletAdapter, now: () => Date.parse('2026-09-07T00:00:00Z') });
  return { ...base, adapter, makeService, service: makeService() };
}

test('same-name UIDs stay isolated; atomic debit changes only each mirror balance, with one receipt', async () => {
  const { db, service, purchaseRequest, refs: petRefs } = fixture();
  const before = snapshot(db);
  const results = await Promise.all([service.purchase(purchaseRequest('meal')), service.purchase(purchaseRequest('meal'))]);
  assert.equal(results.filter((result) => !result.duplicate).length, 1);
  for (const [path, data] of before) {
    if ([publicPath, privatePath].includes(path)) assert.deepEqual(db.read(path), { ...data, balance: 28 });
    else if (path !== petRefs.pet(UID)) assert.deepEqual(db.read(path), data);
  }
  assert.equal(db.read(petRefs.pet(UID)).paidCare.needs.hunger, 2);
  assert.equal(db.read(petRefs.receipt(UID, 'purchase-1')).walletAfter, 28);
  assert.ok(db.conflicts > 0);
});

test('missing or conflicting mappings, ownership and balances fail without any write', async () => {
  const mutations = [
    (db) => db.values.delete(refs.mapping(UID)),
    (db) => db.seed(refs.mapping(UID), { schemaVersion: 1, ownerUid: 'student-b', publicProfileId: 'record-a' }),
    (db) => db.seed(refs.mapping(UID), { schemaVersion: 2, ownerUid: UID, publicProfileId: 'record-a' }),
    (db) => db.seed(refs.mapping(UID), { schemaVersion: 1, ownerUid: UID, publicProfileId: '../bad' }),
    (db) => db.seed(refs.mapping(UID), { schemaVersion: 1, ownerUid: UID, publicProfileId: 'record-b' }),
  ];
  for (const path of [publicPath, privatePath]) {
    mutations.push((db) => db.values.delete(path));
    for (const ownerUid of [undefined, null, '', 'student-b']) mutations.push((db) => db.seed(path, { ...db.read(path), ownerUid }));
    mutations.push((db) => db.seed(path, { ...db.read(path), uid: 'student-b' }));
    for (const balance of [undefined, null, '30', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 29]) {
      mutations.push((db) => db.seed(path, { ...db.read(path), balance }));
    }
  }
  for (const mutate of mutations) {
    const { db, service, purchaseRequest } = fixture();
    mutate(db);
    const before = snapshot(db);
    await assert.rejects(service.purchase(purchaseRequest('meal')));
    assert.deepEqual(snapshot(db), before);
  }
});

test('zero is valid but cannot spend savings; full needs are a no-op', async () => {
  const { db, service, purchaseRequest, refs: petRefs } = fixture();
  for (const path of [publicPath, privatePath]) db.seed(path, { ...db.read(path), balance: 0 });
  let before = snapshot(db);
  await assert.rejects(service.purchase(purchaseRequest('meal')), /INSUFFICIENT_FUNDS/u);
  assert.deepEqual(snapshot(db), before);
  for (const path of [publicPath, privatePath]) db.seed(path, { ...db.read(path), balance: 30 });
  const pet = db.read(petRefs.pet(UID));
  pet.paidCare.needs.hunger = 4;
  db.seed(petRefs.pet(UID), pet);
  before = snapshot(db);
  await assert.rejects(service.purchase(purchaseRequest('meal')));
  assert.deepEqual(snapshot(db), before);
});

test('coordinated concurrent reward retries retain credit, care debit and unrelated changes', async () => {
  const { db, adapter, makeService, purchaseRequest } = fixture();
  let walletRead;
  const ready = new Promise((resolve) => { walletRead = resolve; });
  let rewardDone;
  const done = new Promise((resolve) => { rewardDone = resolve; });
  const service = makeService({ ...adapter, read: async (transaction, uid) => {
    const wallet = await adapter.read(transaction, uid);
    walletRead();
    await done;
    return wallet;
  } });
  await Promise.all([
    service.purchase(purchaseRequest('meal')),
    ready.then(() => db.runTransaction(async (transaction) => {
      const a = (await transaction.get(publicPath)).data();
      const b = (await transaction.get(privatePath)).data();
      assert.equal(a.balance, b.balance);
      transaction.set(publicPath, { ...a, balance: a.balance + 5, rewardMarker: true });
      transaction.set(privatePath, { ...b, balance: b.balance + 5, rewardMarker: true });
    })).then(rewardDone),
  ]);
  for (const path of [publicPath, privatePath]) {
    assert.equal(db.read(path).balance, 33);
    assert.equal(db.read(path).rewardMarker, true);
    assert.equal(db.read(path).bank_balance, 100);
  }
  assert.ok(db.conflicts > 0);
});

test('one-sided concurrent writer causes conflict then refusal, not silent reconciliation', async () => {
  const { db, adapter, makeService, purchaseRequest, refs: petRefs } = fixture();
  let injected = false;
  const service = makeService({ ...adapter, read: async (transaction, uid) => {
    const wallet = await adapter.read(transaction, uid);
    if (!injected) {
      injected = true;
      db.seed(publicPath, { ...db.read(publicPath), balance: 35 });
    }
    return wallet;
  } });
  const petBefore = db.read(petRefs.pet(UID));
  await assert.rejects(service.purchase(purchaseRequest('meal')), /WALLET_BALANCE_CONFLICT/u);
  assert.equal(db.read(publicPath).balance, 35);
  assert.equal(db.read(privatePath).balance, 30);
  assert.deepEqual(db.read(petRefs.pet(UID)), petBefore);
  assert.equal(db.read(petRefs.receipt(UID, 'purchase-1')), undefined);
});

test('async rejection after staging both mirrors and failed commit roll back all care writes', async () => {
  for (const failCommit of [false, true]) {
    const { db, adapter, makeService, purchaseRequest } = fixture();
    const service = makeService(failCommit ? adapter : { ...adapter, debit: async (...args) => {
      await adapter.debit(...args);
      await Promise.resolve();
      throw new Error('ASYNC_DEBIT_FAILURE');
    } });
    db.failCommit = failCommit;
    const before = snapshot(db);
    await assert.rejects(service.purchase(purchaseRequest('meal')), /ASYNC_DEBIT_FAILURE|COMMIT_FAILURE/u);
    assert.deepEqual(snapshot(db), before);
  }
});

test('debit rejects forged, reused and cross-transaction contexts and invalid amounts', async () => {
  const { db, adapter } = fixture();
  const before = snapshot(db);
  for (const amount of [0, -1, 31, 1.5, NaN]) {
    await assert.rejects(db.runTransaction(async (transaction) => {
      const wallet = await adapter.read(transaction, UID);
      await adapter.debit(transaction, wallet, amount);
    }), /INVALID_WALLET_DEBIT/u);
  }
  await assert.rejects(db.runTransaction((transaction) => adapter.debit(transaction, { ownerUid: UID, balance: 30 }, 1)), /INVALID_WALLET_CONTEXT/u);
  let captured;
  await db.runTransaction(async (transaction) => { captured = await adapter.read(transaction, UID); });
  await assert.rejects(db.runTransaction((transaction) => adapter.debit(transaction, captured, 1)), /INVALID_WALLET_CONTEXT/u);
  await assert.rejects(db.runTransaction(async (transaction) => {
    const wallet = await adapter.read(transaction, UID);
    await adapter.debit(transaction, wallet, 1);
    await adapter.debit(transaction, wallet, 1);
  }), /INVALID_WALLET_CONTEXT/u);
  await assert.rejects(db.runTransaction(async (transaction) => {
    await adapter.read(transaction, UID);
    await adapter.read(transaction, UID);
  }), /WALLET_ALREADY_READ/u);
  assert.deepEqual(snapshot(db), before);
});

test('a failure staging the second mirror aborts the first staged write and pet receipt', async () => {
  const { db, adapter, makeService, purchaseRequest } = fixture();
  const service = makeService({ ...adapter, debit: async (transaction, wallet, amount) => {
    const original = transaction.set;
    transaction.set = (path, value) => {
      if (path === privatePath) throw new Error('SECOND_SET_FAILURE');
      original(path, value);
    };
    await adapter.debit(transaction, wallet, amount);
  } });
  const before = snapshot(db);
  await assert.rejects(service.purchase(purchaseRequest('meal')), /SECOND_SET_FAILURE/u);
  assert.deepEqual(snapshot(db), before);
});

test('opaque Admin SDK values survive unchanged, without cloning or serializing', async () => {
  const { Timestamp, GeoPoint } = require('firebase-admin/firestore');
  const stamp = Timestamp.fromMillis(1000);
  const point = new GeoPoint(-36, 174);
  const opaque = Object.freeze({ stamp, point });
  const adapter = createUidWalletAdapter({ refs });
  const data = new Map([
    [refs.mapping(UID), { schemaVersion: 1, ownerUid: UID, publicProfileId: 'record-a' }],
    ...[publicPath, privatePath].map((path) => [path, { ownerUid: UID, balance: 30, opaque, stamp, point }]),
  ]);
  const writes = new Map();
  const transaction = {
    get: async (path) => { assert.equal(writes.size, 0); return { exists: data.has(path), data: () => data.get(path) }; },
    set: (path, value) => writes.set(path, value),
  };
  await adapter.debit(transaction, await adapter.read(transaction, UID), 2);
  for (const value of writes.values()) {
    assert.equal(value.opaque, opaque);
    assert.equal(value.stamp, stamp);
    assert.equal(value.point, point);
    assert.equal(value.balance, 28);
  }
  assert.equal(writes.size, 2);
});
