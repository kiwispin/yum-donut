'use strict';

// Synthetic Firestore fixture; never imports the Admin SDK or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const { giveDonutsFromTeams } = require('../src/donutService');
const { mappingKeyForTeamsUser } = require('../src/identity');
const { localDateLabel } = require('../src/dateKeys');
const { payForGift, resolveBankBalance } = require('../src/giving');

const NOW = new Date('2026-11-03T00:00:00Z'); // Tuesday 1pm Auckland.
const TODAY = localDateLabel(NOW);
const ROOT = 'artifacts/yum-donut-school';
const publicPath = (name) => `${ROOT}/public/data/users/${name}`;
const privatePath = (uid) => `${ROOT}/users/${uid}/profile/data`;
const mappingPath = (teamsUser) => `${ROOT}/public/data/integrations/teams/mappings/${mappingKeyForTeamsUser(teamsUser)}`;

const FieldValue = {
  increment: (amount) => ({ increment: amount }),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
};

function applyFields(current, fields) {
  const next = { ...current };
  for (const [key, value] of Object.entries(fields)) {
    next[key] = value && typeof value === 'object' && 'increment' in value ? (next[key] || 0) + value.increment : value;
  }
  return next;
}

function createDb() {
  const documents = new Map();
  let autoId = 0;
  const docRef = (path) => ({ path, collection: (name) => collectionRef(`${path}/${name}`) });
  const collectionRef = (path) => ({ doc: (id = `auto-${autoId += 1}`) => docRef(`${path}/${id}`) });
  return {
    documents,
    collection: (name) => collectionRef(name),
    async runTransaction(callback) {
      const writes = new Map();
      const read = (path) => (writes.has(path) ? writes.get(path) : documents.get(path));
      const transaction = {
        get: async (ref) => {
          if (writes.size) throw new Error('READ_AFTER_WRITE');
          const value = documents.get(ref.path);
          return { exists: value !== undefined, data: () => structuredClone(value) };
        },
        set: (ref, value, options = {}) => { writes.set(ref.path, applyFields(options.merge ? read(ref.path) : {}, value)); },
        update: (ref, value) => {
          if (read(ref.path) === undefined) throw new Error('UPDATE_MISSING');
          writes.set(ref.path, applyFields(read(ref.path), value));
        },
      };
      const result = await callback(transaction);
      for (const [path, value] of writes) documents.set(path, value);
      return result;
    },
  };
}

const alice = { aadObjectId: 'aad-alice', name: 'Alice' };
const bob = { aadObjectId: 'aad-bob', name: 'Bob' };
const cara = { aadObjectId: 'aad-cara', name: 'Cara' };
const teacher = { aadObjectId: 'aad-teacher', name: 'Mr Rayner' };

function setup({ wallet = 10, bank = 0, givenToday = 0 } = {}) {
  const db = createDb();
  const seed = (path, value) => db.documents.set(path, structuredClone(value));
  seed(`${ROOT}/public/data/config/roster`, { names: ['Alice', 'Bob', 'Cara', 'Mr Rayner'] });
  for (const [teamsUser, name, uid] of [[alice, 'Alice', 'uid-alice'], [bob, 'Bob', 'uid-bob'], [cara, 'Cara', 'uid-cara'], [teacher, 'Mr Rayner', 'uid-teacher']]) {
    seed(mappingPath(teamsUser), { yumName: name, uid });
    seed(publicPath(name), { name, uid, claimed: true, balance: 20, bank_balance: 0, lifetime_given: 0, lifetime_received: 20 });
    seed(privatePath(uid), { balance: 20, bank_balance: 0, given_today: 0, last_given_date: TODAY });
  }
  seed(publicPath('Alice'), { name: 'Alice', uid: 'uid-alice', claimed: true, balance: wallet, bank_balance: bank, lifetime_given: 0, lifetime_received: 30 });
  seed(privatePath('uid-alice'), { balance: wallet, bank_balance: bank, given_today: givenToday, last_given_date: TODAY });
  let activity = 0;
  const give = (sender, recipients, donutCount, activityId = `activity-${activity += 1}`) => giveDonutsFromTeams({
    db, FieldValue, activityId, senderTeamsUser: sender, recipientTeamsUsers: recipients, donutCount, message: 'great teamwork', now: NOW,
  });
  const read = (path) => structuredClone(db.documents.get(path));
  const snapshot = () => JSON.stringify([...db.documents]);
  return { db, seed, read, give, snapshot };
}

test('server giving rules match the web app', () => {
  assert.deepEqual(payForGift({ wallet: 5, bank: 10 }, 3), { wallet: 2, bank: 10 });
  assert.deepEqual(payForGift({ wallet: 1, bank: 10 }, 4), { wallet: 0, bank: 7 });
  assert.equal(payForGift({ wallet: 1, bank: 2 }, 4), null);
  assert.equal(resolveBankBalance(undefined, 156), 156);
  assert.equal(resolveBankBalance(156, undefined), 156);
  assert.equal(resolveBankBalance(156, 206), null);
  assert.equal(resolveBankBalance(156, -1), null);
});

test('a student gift from Teams comes out of their wallet', async () => {
  const f = setup({ wallet: 3, bank: 10 });
  const result = await f.give(alice, [bob], 2);
  assert.equal(result.ok, true);
  assert.equal(f.read(publicPath('Alice')).balance, 1);
  assert.equal(f.read(privatePath('uid-alice')).balance, 1);
  assert.equal(f.read(publicPath('Alice')).bank_balance, 10);
  assert.equal(f.read(privatePath('uid-alice')).given_today, 2);
  assert.equal(f.read(publicPath('Alice')).lifetime_given, 2);
  assert.equal(f.read(publicPath('Bob')).balance, 22);
  assert.equal(f.read(privatePath('uid-bob')).balance, 22);
});

test('the bank covers what the wallet cannot', async () => {
  const f = setup({ wallet: 1, bank: 10 });
  const result = await f.give(alice, [bob, cara], 2);
  assert.equal(result.ok, true);
  for (const path of [publicPath('Alice'), privatePath('uid-alice')]) {
    assert.equal(f.read(path).balance, 0);
    assert.equal(f.read(path).bank_balance, 7);
  }
});

test('a student who cannot cover the gift is refused and nothing is written', async () => {
  const f = setup({ wallet: 1, bank: 0 });
  const before = f.snapshot();
  assert.deepEqual(await f.give(alice, [bob], 2), { ok: false, code: 'NOT_ENOUGH', requested: 2 });
  assert.equal(f.snapshot(), before);
});

test('the daily limit still applies and shares the app counter', async () => {
  const f = setup({ wallet: 10, givenToday: 4 });
  assert.deepEqual(await f.give(alice, [bob], 2), { ok: false, code: 'DAILY_LIMIT', remaining: 1, requested: 2 });
});

test('the teacher gives for free and without a limit', async () => {
  const f = setup();
  const result = await f.give(teacher, [bob, cara], 4);
  assert.equal(result.ok, true);
  assert.equal(f.read(publicPath('Mr Rayner')).balance, 20);
  assert.equal(f.read(privatePath('uid-teacher')).balance, 20);
  assert.equal(f.read(publicPath('Bob')).balance, 24);
});

test('a sender with no linked account is refused', async () => {
  const f = setup();
  f.seed(mappingPath(alice), { yumName: 'Alice' });
  f.seed(publicPath('Alice'), { name: 'Alice', claimed: false, balance: 10, lifetime_given: 0, lifetime_received: 10 });
  const before = f.snapshot();
  assert.deepEqual(await f.give(alice, [bob], 1), { ok: false, code: 'SENDER_NO_ACCOUNT' });
  assert.equal(f.snapshot(), before);
});

test('a corrupted sender balance is held for repair', async () => {
  const f = setup();
  f.seed(privatePath('uid-alice'), { balance: 10, bank_balance: 5, given_today: 0, last_given_date: TODAY });
  const before = f.snapshot();
  assert.deepEqual(await f.give(alice, [bob], 1), { ok: false, code: 'SENDER_BALANCE_CORRUPT' });
  assert.equal(f.snapshot(), before);
});

test('a corrupted recipient balance refuses the whole gift without a partial write', async () => {
  const f = setup({ wallet: 10 });
  f.seed(publicPath('Cara'), { name: 'Cara', uid: 'uid-cara', claimed: true, balance: NaN, lifetime_received: 20 });
  const before = f.snapshot();
  assert.deepEqual(await f.give(alice, [bob, cara], 1, 'activity-x'), { ok: false, code: 'RECIPIENT_BALANCE_CORRUPT', yumName: 'Cara' });
  assert.equal(f.snapshot(), before);

  // Once Cara is repaired, Teams resending the same message pays everyone exactly once.
  f.seed(publicPath('Cara'), { name: 'Cara', uid: 'uid-cara', claimed: true, balance: 20, lifetime_received: 20 });
  assert.equal((await f.give(alice, [bob, cara], 1, 'activity-x')).ok, true);
  assert.equal(f.read(publicPath('Bob')).balance, 21);
  assert.equal(f.read(publicPath('Alice')).balance, 8);
});

test('a resent Teams message is charged once', async () => {
  const f = setup({ wallet: 10 });
  assert.equal((await f.give(alice, [bob], 2, 'activity-same')).ok, true);
  assert.deepEqual(await f.give(alice, [bob], 2, 'activity-same'), { ok: false, code: 'DUPLICATE' });
  assert.equal(f.read(publicPath('Alice')).balance, 8);
  assert.equal(f.read(publicPath('Bob')).balance, 22);
});
