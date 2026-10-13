'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudentAccountService, emailForName, legacyEmailForName } = require('../src/studentAccountService');

class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const union = (...values) => ({ operation: 'union', values });
const remove = (...values) => ({ operation: 'remove', values });
function fixture() {
  const documents = new Map();
  const db = { doc: path => ({
    get: async () => {
      const value = documents.get(path);
      return { exists: value !== undefined, data: () => structuredClone(value) };
    },
    set: async (value, options) => {
      const current = documents.get(path) || {};
      const next = options?.merge ? { ...current } : {};
      for (const [key, field] of Object.entries(value)) {
        if (field?.operation === 'union') next[key] = [...new Set([...(next[key] || []), ...field.values])];
        else if (field?.operation === 'remove') next[key] = (next[key] || []).filter(item => !field.values.includes(item));
        else next[key] = field;
      }
      documents.set(path, next);
    },
  }) };
  const users = new Map(); let nextUid = 1;
  const authAdmin = {
    getUser: async uid => {
      const user = [...users.values()].find(value => value.uid === uid);
      if (!user) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' });
      return structuredClone(user);
    },
    getUserByEmail: async email => {
      const user = users.get(email);
      if (!user) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' });
      return structuredClone(user);
    },
    createUser: async ({ email, password, displayName }) => {
      if (users.has(email)) throw Object.assign(new Error('exists'), { code: 'auth/email-already-exists' });
      const user = { uid: `uid-${nextUid++}`, email, password, displayName };
      users.set(email, user); return structuredClone(user);
    },
    updateUser: async (uid, update) => {
      const user = [...users.values()].find(value => value.uid === uid);
      if (!user) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' });
      Object.assign(user, update); return structuredClone(user);
    },
  };
  const manage = createStudentAccountService({ authAdmin, db, HttpsError, arrayUnion: union, arrayRemove: remove });
  const teacher = { uid: 'teacher', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'password' } } };
  const call = (data, auth = teacher) => manage({ auth, data });
  const seed = (path, data) => documents.set(path, structuredClone(data));
  const read = path => structuredClone(documents.get(path));
  const rosterPath = 'artifacts/yum-donut-school/public/data/config/roster';
  const publicPath = name => `artifacts/yum-donut-school/public/data/users/${name}`;
  const profilePath = uid => `artifacts/yum-donut-school/users/${uid}/profile/data`;
  return { call, authAdmin, users, seed, read, rosterPath, publicPath, profilePath };
}

test('Add creates an exact-name sign-in and adds the roster entry without touching a donut profile', async () => {
  const f = fixture(); f.seed(f.rosterPath, { names: ['Existing'], removed_names: ['Kate'] });
  const result = await f.call({ action: 'add', name: 'Kate', password: 'initial-pass' });
  assert.deepEqual(result, { name: 'Kate', created: true, rosterAdded: true });
  const user = f.users.get(emailForName('Kate'));
  assert.equal(user.displayName, 'Kate'); assert.equal(user.password, 'initial-pass');
  assert.deepEqual(f.read(f.rosterPath), { names: ['Existing', 'Kate'], removed_names: [] });
  assert.equal(f.read(f.publicPath('Kate')), undefined);
  assert.equal(f.read(f.profilePath(user.uid)), undefined);
});

test('Setting a password for roster-only Kate and Lauren creates their separate accounts', async () => {
  const f = fixture(); f.seed(f.rosterPath, { names: ['Kate', 'Lauren'], removed_names: [] });
  const kate = await f.call({ action: 'set-password', name: 'Kate', password: 'kate-pass' });
  const lauren = await f.call({ action: 'set-password', name: 'Lauren', password: 'lauren-pass' });
  assert.equal(kate.created, true); assert.equal(lauren.created, true);
  assert.notEqual(emailForName('Kate'), emailForName('Lauren'));
  assert.notEqual(f.users.get(emailForName('Kate')).uid, f.users.get(emailForName('Lauren')).uid);
  assert.equal(f.users.get(emailForName('Kate')).password, 'kate-pass');
  assert.equal(f.users.get(emailForName('Lauren')).password, 'lauren-pass');
});

test('Setting a password updates only the exact name account linked to the saved profile', async () => {
  const f = fixture(); f.seed(f.rosterPath, { names: ['Lara', 'Lara C'], removed_names: [] });
  const user = await f.authAdmin.createUser({ email: emailForName('Lara C'), password: 'old-pass', displayName: 'Lara C' });
  f.seed(f.profilePath(user.uid), { name: 'Lara C', balance: 17, bank_balance: 6 });
  f.seed(f.publicPath('Lara C'), { name: 'Lara C', uid: user.uid, claimed: true, balance: 17, bank_balance: 6 });
  const result = await f.call({ action: 'set-password', name: 'Lara C', password: 'new-pass' });
  assert.equal(result.created, false);
  assert.equal(f.users.get(emailForName('Lara C')).password, 'new-pass');
  assert.equal(f.read(f.profilePath(user.uid)).balance, 17);
  assert.equal(f.read(f.profilePath(user.uid)).bank_balance, 6);
  assert.equal(f.users.has(legacyEmailForName('Lara')), false);
});

test('Legacy-name collisions resolve from the stored profile name, not the email alias', async () => {
  const f = fixture(); f.seed(f.rosterPath, { names: ['Lara C', 'LaraC'], removed_names: [] });
  const user = await f.authAdmin.createUser({ email: legacyEmailForName('Lara C'), password: 'old-pass', displayName: 'Lara C' });
  f.seed(f.profilePath(user.uid), { name: 'Lara C' });
  const result = await f.call({ action: 'set-password', name: 'Lara C', password: 'new-pass' });
  assert.equal(result.created, false);
  assert.equal(f.users.get(legacyEmailForName('Lara C')).password, 'new-pass');
});

test('Server and sign-in screen derive the same account emails for new and legacy names', async () => {
  const client = await import('../../src/authIdentity.js');
  for (const name of ['Kate', 'Lauren', 'Lara', 'Lara C', 'Mr Rayner']) {
    assert.equal(emailForName(name), client.accountEmailForName(name));
    assert.equal(legacyEmailForName(name), client.legacyAccountEmailForName(name));
  }
});

test('Creating an account on an unclaimed public wallet record leaves its donuts untouched', async () => {
  const f = fixture(); f.seed(f.rosterPath, { names: ['Student'], removed_names: [] });
  f.seed(f.publicPath('Student'), { name: 'Student', balance: 31, bank_balance: 8, lifetime_given: 4 });
  const created = await f.call({ action: 'set-password', name: 'Student', password: 'new-pass' });
  assert.equal(created.created, true);
  assert.deepEqual(f.read(f.publicPath('Student')), { name: 'Student', balance: 31, bank_balance: 8, lifetime_given: 4 });
});

test('Missing Auth for an account linked to existing donut data fails closed', async () => {
  const f = fixture(); f.seed(f.rosterPath, { names: ['Kate'], removed_names: [] });
  f.seed(f.publicPath('Kate'), { name: 'Kate', uid: 'deleted-auth-uid', claimed: true, balance: 42, bank_balance: 9 });
  await assert.rejects(f.call({ action: 'set-password', name: 'Kate', password: 'new-pass' }), { code: 'failed-precondition' });
  assert.equal(f.users.size, 0);
  assert.equal(f.read(f.publicPath('Kate')).balance, 42);
});

test('Roster membership, teacher identity, and password bounds are checked before changes', async () => {
  const f = fixture(); f.seed(f.rosterPath, { names: ['Kate'], removed_names: [] });
  await assert.rejects(f.call({ action: 'set-password', name: 'Other', password: 'new-pass' }), { code: 'failed-precondition' });
  await assert.rejects(f.call({ action: 'add', name: 'kate', password: 'new-pass' }), { code: 'already-exists' });
  await assert.rejects(f.call({ action: 'add', name: 'Other', password: 'short' }), { code: 'invalid-argument' });
  await assert.rejects(f.call({ action: 'add', name: 'Other', password: 'new-pass' }, { uid: 'student', token: {} }), { code: 'permission-denied' });
  assert.equal(f.users.size, 0);
  assert.deepEqual(f.read(f.rosterPath), { names: ['Kate'], removed_names: [] });
});
