'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudentSuspensionService, validPeriods, startBreak, endBreak } = require('../src/studentSuspensionService');

class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const union = (...values) => ({ operation: 'union', values });
const remove = (...values) => ({ operation: 'remove', values });
const NOW = Date.parse('2026-11-05T00:00:00Z');

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
  const users = new Map([['uid-kate', { uid: 'uid-kate', disabled: false, revoked: 0 }], ['teacher', { uid: 'teacher', disabled: false, revoked: 0 }]]);
  const authAdmin = {
    updateUser: async (uid, update) => {
      if (!users.has(uid)) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' });
      Object.assign(users.get(uid), update);
    },
    revokeRefreshTokens: async uid => { users.get(uid).revoked += 1; },
  };
  let clock = NOW;
  const service = createStudentSuspensionService({ authAdmin, db, HttpsError, arrayUnion: union, arrayRemove: remove, now: () => clock });
  const teacher = { uid: 'teacher', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'password' } } };
  const call = (data, auth = teacher) => service({ auth, data });
  const seed = (path, data) => documents.set(path, structuredClone(data));
  const read = path => structuredClone(documents.get(path));
  const rosterPath = 'artifacts/yum-donut-school/public/data/config/roster';
  const publicPath = name => `artifacts/yum-donut-school/public/data/users/${name}`;
  const breaksPath = uid => `artifacts/yum-donut-school/yumpals/main/breaks/${uid}`;
  seed(rosterPath, { names: ['Kate', 'Lauren', 'Mr Rayner'], removed_names: ['Old'] });
  seed(publicPath('Kate'), { name: 'Kate', uid: 'uid-kate', balance: 42, trophies: { medal: 2 } });
  seed(publicPath('Mr Rayner'), { name: 'Mr Rayner', uid: 'teacher' });
  return { call, users, seed, read, rosterPath, publicPath, breaksPath, later: ms => { clock += ms; } };
}

test('Suspend takes Kate off the roster, switches off her sign-in and starts her pal’s break, keeping everything', async () => {
  const f = fixture();
  const before = f.read(f.publicPath('Kate'));
  assert.deepEqual(await f.call({ action: 'suspend', name: 'Kate' }), { name: 'Kate', suspended: true, signInOff: true });
  assert.deepEqual(f.read(f.rosterPath), { names: ['Lauren', 'Mr Rayner'], removed_names: ['Old', 'Kate'], suspended_names: ['Kate'] });
  assert.equal(f.users.get('uid-kate').disabled, true);
  assert.equal(f.users.get('uid-kate').revoked, 1, 'signed-in devices are signed out');
  assert.deepEqual(f.read(f.breaksPath('uid-kate')), { periods: [{ from: NOW, to: null }] });
  assert.deepEqual(f.read(f.publicPath('Kate')), before, 'donuts, trophies and looks are untouched');
});

test('Restore brings Kate back as she was: roster, sign-in on, pal break closed', async () => {
  const f = fixture();
  await f.call({ action: 'suspend', name: 'Kate' });
  f.later(7 * 24 * 3600000);
  assert.deepEqual(await f.call({ action: 'restore', name: 'Kate' }), { name: 'Kate', suspended: false, signInOn: true });
  const roster = f.read(f.rosterPath);
  assert.deepEqual(roster.names.sort(), ['Kate', 'Lauren', 'Mr Rayner']);
  assert.deepEqual(roster.removed_names, ['Old']); assert.deepEqual(roster.suspended_names, []);
  assert.equal(f.users.get('uid-kate').disabled, false);
  assert.deepEqual(f.read(f.breaksPath('uid-kate')), { periods: [{ from: NOW, to: NOW + 7 * 24 * 3600000 }] });
});

test('Suspend and Restore are safe to repeat, and a second break is recorded separately', async () => {
  const f = fixture();
  await f.call({ action: 'suspend', name: 'Kate' });
  f.later(1000); await f.call({ action: 'suspend', name: 'Kate' });
  assert.deepEqual(f.read(f.breaksPath('uid-kate')), { periods: [{ from: NOW, to: null }] }, 'one open break, not two');
  f.later(1000); await f.call({ action: 'restore', name: 'Kate' });
  f.later(1000); await f.call({ action: 'restore', name: 'Kate' });
  f.later(1000); await f.call({ action: 'suspend', name: 'Kate' });
  assert.deepEqual(f.read(f.breaksPath('uid-kate')).periods, [{ from: NOW, to: NOW + 2000 }, { from: NOW + 4000, to: null }]);
});

test('A student removed before Suspend existed can be restored, and one with no account only moves on the roster', async () => {
  const f = fixture();
  assert.deepEqual(await f.call({ action: 'restore', name: 'Old' }), { name: 'Old', suspended: false, signInOn: false });
  assert.ok(f.read(f.rosterPath).names.includes('Old'));
  assert.deepEqual(await f.call({ action: 'suspend', name: 'Lauren' }), { name: 'Lauren', suspended: true, signInOff: false });
  assert.ok(f.read(f.rosterPath).suspended_names.includes('Lauren'));
});

test('Only the teacher can suspend, never their own account, and only roster names', async () => {
  const f = fixture();
  const student = { uid: 'uid-kate', token: { firebase: { sign_in_provider: 'password' } } };
  await assert.rejects(f.call({ action: 'suspend', name: 'Lauren' }, student), { code: 'permission-denied' });
  await assert.rejects(f.call({ action: 'suspend', name: 'Mr Rayner' }), { code: 'failed-precondition' });
  await assert.rejects(f.call({ action: 'suspend', name: 'Nobody' }), { code: 'not-found' });
  await assert.rejects(f.call({ action: 'delete', name: 'Kate' }), { code: 'invalid-argument' });
  await assert.rejects(f.call({ action: 'suspend', name: 'Kate', extra: 1 }), { code: 'invalid-argument' });
  await assert.rejects(f.call({ action: 'suspend', name: '../Kate' }), { code: 'invalid-argument' });
  assert.equal(f.users.get('uid-kate').disabled, false, 'nothing changed');
});

test('Break periods are checked and opened or closed only once', () => {
  assert.equal(validPeriods([]), true);
  assert.equal(validPeriods([{ from: 1, to: 2 }, { from: 3, to: null }]), true);
  assert.equal(validPeriods([{ from: 1, to: null }, { from: 3, to: null }]), false);
  assert.equal(validPeriods([{ from: 5, to: 2 }]), false);
  assert.equal(validPeriods([{ from: 3, to: 4 }, { from: 1, to: 2 }]), false);
  assert.equal(validPeriods('none'), false);
  const open = startBreak([], 10);
  assert.equal(startBreak(open, 20), open);
  assert.deepEqual(endBreak(open, 30), [{ from: 10, to: 30 }]);
  const closed = endBreak(open, 30);
  assert.equal(endBreak(closed, 40), closed);
});
