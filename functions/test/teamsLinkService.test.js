'use strict';

// Synthetic Firestore fixture; never imports the Admin SDK or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTeamsLinkService } = require('../src/teamsLinkService');
const { mappingKeyForTeamsUser } = require('../src/identity');
const { giveDonutsFromTeams } = require('../src/donutService');

class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const FieldValue = { serverTimestamp: () => 'SERVER_TIMESTAMP', increment: amount => ({ increment: amount }) };
const DATA = 'artifacts/yum-donut-school/public/data';
const TEAMS = `${DATA}/integrations/teams`;

// Shallow copies keep timestamp objects (with their toMillis method) intact.
const clone = value => (value === undefined ? undefined
  : Object.fromEntries(Object.entries(value).map(([key, field]) => [key, Array.isArray(field) ? [...field] : field])));

function createDb() {
  const documents = new Map();
  const snapOf = (path, value) => ({
    id: path.split('/').pop(), exists: value !== undefined, data: () => clone(value),
  });
  const children = path => [...documents].filter(([key]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'));
  const queryRef = (path, filter) => ({
    path, filter,
    get: async () => ({ docs: children(path).filter(([, value]) => !filter || value[filter.field] === filter.value).map(([key, value]) => snapOf(key, value)) }),
  });
  const docRef = path => ({
    path,
    collection: name => collectionRef(`${path}/${name}`),
    get: async () => snapOf(path, documents.get(path)),
    delete: async () => { documents.delete(path); },
  });
  const collectionRef = path => ({
    ...queryRef(path),
    doc: id => docRef(`${path}/${id}`),
    where: (field, op, value) => { assert.equal(op, '=='); return queryRef(path, { field, value }); },
  });
  return {
    documents,
    collection: name => collectionRef(name),
    async runTransaction(callback) {
      const writes = new Map();
      const transaction = {
        get: async ref => {
          if (writes.size) throw new Error('READ_AFTER_WRITE');
          return ref.get();
        },
        set: (ref, value, options = {}) => {
          const current = writes.get(ref.path) ?? documents.get(ref.path);
          writes.set(ref.path, options.merge ? { ...current, ...value } : { ...value });
        },
        update: (ref, value) => {
          const current = writes.get(ref.path) ?? documents.get(ref.path);
          if (current === undefined) throw new Error('UPDATE_MISSING');
          const next = { ...current };
          for (const [key, field] of Object.entries(value)) next[key] = field?.increment !== undefined ? (next[key] || 0) + field.increment : field;
          writes.set(ref.path, next);
        },
      };
      const result = await callback(transaction);
      for (const [path, value] of writes) documents.set(path, value);
      return result;
    },
  };
}

const timestamp = ms => ({ toMillis: () => ms });
const aaishahGiving = { aadObjectId: 'aad-aaishah', id: '29:aaishah', name: 'Aaishah Khan' };
const aaishahMentioned = { id: '29:aaishah-mention', name: 'Aaishah Khan' };
const ben = { aadObjectId: 'aad-ben', id: '29:ben', name: 'Ben Lee', userPrincipalName: 'ben@school.example' };
const teacherTeams = { aadObjectId: 'aad-teacher', id: '29:teacher', name: 'Mr Rayner' };
const keyOf = mappingKeyForTeamsUser;

function setup() {
  const db = createDb();
  const seed = (path, value) => db.documents.set(path, clone(value));
  const read = path => clone(db.documents.get(path));
  seed(`${DATA}/config/roster`, { names: ['Mr Rayner', 'Aaishah', 'Ben', 'Gone'], removed_names: ['Gone'] });
  for (const user of [aaishahGiving, aaishahMentioned, ben, teacherTeams]) {
    seed(`${TEAMS}/pendingMappings/${keyOf(user)}`, {
      mappingKey: keyOf(user), teamsUserId: user.aadObjectId || user.id, displayName: user.name,
      aadObjectId: user.aadObjectId || null, userPrincipalName: user.userPrincipalName || null,
      source: 'donut_message', lastSeenAt: timestamp(1000),
    });
  }
  // The teacher's link was made by hand in the console before this screen existed.
  seed(`${TEAMS}/mappings/${keyOf(teacherTeams)}`, { yumName: 'Mr Rayner', uid: 'uid-teacher' });
  seed(`${DATA}/users/Mr Rayner`, { name: 'Mr Rayner', uid: 'uid-teacher', balance: 0, bank_balance: 0, lifetime_given: 0, lifetime_received: 0 });
  seed(`${DATA}/users/Aaishah`, { name: 'Aaishah', balance: 4, bank_balance: 0, lifetime_given: 0, lifetime_received: 4 });
  const manage = createTeamsLinkService({ db, HttpsError, FieldValue });
  const teacher = { uid: 'uid-teacher', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'password' } } };
  const call = (data, auth = teacher) => manage({ auth, data });
  const mapping = user => read(`${TEAMS}/mappings/${keyOf(user)}`);
  return { db, seed, read, call, mapping };
}

test('Only the signed-in teacher can list or change Teams links', async () => {
  const f = setup();
  const before = JSON.stringify([...f.db.documents]);
  const student = { uid: 'uid-ben', token: { firebase: { sign_in_provider: 'password' } } };
  const anonymousAdmin = { uid: 'anon', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'anonymous' } } };
  for (const auth of [null, student, anonymousAdmin]) {
    await assert.rejects(f.call({ action: 'list' }, auth), { code: 'permission-denied' });
    await assert.rejects(f.call({ action: 'link', mappingKey: keyOf(ben), yumName: 'Ben' }, auth), { code: 'permission-denied' });
    await assert.rejects(f.call({ action: 'unlink', mappingKey: keyOf(teacherTeams) }, auth), { code: 'permission-denied' });
  }
  assert.equal(JSON.stringify([...f.db.documents]), before);
});

test('List shows unlinked Teams users as pending and existing links with their status', async () => {
  const f = setup();
  const result = await f.call({ action: 'list' });
  assert.deepEqual(result.roster, ['Mr Rayner', 'Aaishah', 'Ben']);
  assert.deepEqual(result.links, [{
    mappingKey: keyOf(teacherTeams), yumName: 'Mr Rayner', displayName: 'Mr Rayner', email: null,
    seenWhen: 'giving', onRoster: true, hasAccount: true, lastSeenAt: 1000,
  }]);
  assert.deepEqual(result.pending.map(entry => [entry.displayName, entry.seenWhen]).sort(), [
    ['Aaishah Khan', 'giving'], ['Aaishah Khan', 'mentioned'], ['Ben Lee', 'giving'],
  ]);
  assert.equal(result.pending.find(entry => entry.mappingKey === keyOf(ben)).email, 'ben@school.example');
});

test('Linking writes a mapping from the recorded Teams identity, then the bot can deliver a gift', async () => {
  const f = setup();
  const result = await f.call({ action: 'link', mappingKey: keyOf(aaishahMentioned), yumName: 'Aaishah' });
  assert.deepEqual(result, { mappingKey: keyOf(aaishahMentioned), yumName: 'Aaishah', changed: true, previousName: null });
  assert.deepEqual(f.mapping(aaishahMentioned), {
    teamsUserId: '29:aaishah-mention', teamsAadObjectId: null, teamsEmail: null, displayName: 'Aaishah Khan',
    mappingKey: keyOf(aaishahMentioned), yumName: 'Aaishah', linkedAt: 'SERVER_TIMESTAMP', linkedBy: 'uid-teacher',
  });

  const gift = await giveDonutsFromTeams({ db: f.db, FieldValue, activityId: 'a1', senderTeamsUser: teacherTeams,
    recipientTeamsUsers: [aaishahMentioned], donutCount: 2, message: 'well done', now: new Date('2026-11-03T00:00:00Z') });
  assert.equal(gift.ok, true);
  assert.equal(f.read(`${DATA}/users/Aaishah`).balance, 6);

  const listed = await f.call({ action: 'list' });
  const aaishah = listed.links.find(link => link.yumName === 'Aaishah');
  assert.equal(aaishah.hasAccount, false, 'Aaishah has not signed in, so the screen warns she cannot give yet');
  assert.equal(listed.pending.some(entry => entry.mappingKey === keyOf(aaishahMentioned)), false);
});

test('A second Teams record for the same student needs the teacher to confirm', async () => {
  const f = setup();
  await f.call({ action: 'link', mappingKey: keyOf(aaishahMentioned), yumName: 'Aaishah' });
  await assert.rejects(f.call({ action: 'link', mappingKey: keyOf(aaishahGiving), yumName: 'Aaishah' }), { code: 'already-exists' });
  assert.equal(f.mapping(aaishahGiving), undefined);
  await f.call({ action: 'link', mappingKey: keyOf(aaishahGiving), yumName: 'Aaishah', alsoLinked: true });
  assert.equal(f.mapping(aaishahGiving).yumName, 'Aaishah');
  assert.equal(f.mapping(aaishahGiving).teamsAadObjectId, 'aad-aaishah');
});

test('Changing a link drops the old uid so the new student cannot spend the old one\'s wallet', async () => {
  const f = setup();
  f.seed(`${TEAMS}/mappings/${keyOf(ben)}`, { yumName: 'Aaishah', uid: 'uid-aaishah', isAdmin: true });
  const result = await f.call({ action: 'link', mappingKey: keyOf(ben), yumName: 'Ben' });
  assert.equal(result.previousName, 'Aaishah');
  const mapping = f.mapping(ben);
  assert.equal(mapping.yumName, 'Ben');
  assert.equal(mapping.uid, undefined);
  assert.equal(mapping.isAdmin, undefined);
  assert.equal(mapping.teamsEmail, 'ben@school.example');
});

test('Relinking to the same name keeps a hand-made uid and refreshes the Teams details', async () => {
  const f = setup();
  const result = await f.call({ action: 'link', mappingKey: keyOf(teacherTeams), yumName: 'Mr Rayner' });
  assert.equal(result.changed, false);
  assert.deepEqual(f.mapping(teacherTeams), {
    yumName: 'Mr Rayner', uid: 'uid-teacher', mappingKey: keyOf(teacherTeams),
    teamsUserId: 'aad-teacher', teamsAadObjectId: 'aad-teacher', teamsEmail: null, displayName: 'Mr Rayner',
  });
});

test('Unlinking removes the mapping and the person returns to the pending list', async () => {
  const f = setup();
  await f.call({ action: 'link', mappingKey: keyOf(ben), yumName: 'Ben' });
  assert.deepEqual(await f.call({ action: 'unlink', mappingKey: keyOf(ben) }), { mappingKey: keyOf(ben), removed: true, previousName: 'Ben' });
  assert.equal(f.mapping(ben), undefined);
  assert.deepEqual(await f.call({ action: 'unlink', mappingKey: keyOf(ben) }), { mappingKey: keyOf(ben), removed: false });
  const listed = await f.call({ action: 'list' });
  assert.equal(listed.pending.some(entry => entry.mappingKey === keyOf(ben)), true);
});

test('Links must name an active roster student and a Teams user the bot has seen', async () => {
  const f = setup();
  const before = JSON.stringify([...f.db.documents]);
  await assert.rejects(f.call({ action: 'link', mappingKey: keyOf(ben), yumName: 'Gone' }), { code: 'failed-precondition' });
  await assert.rejects(f.call({ action: 'link', mappingKey: keyOf(ben), yumName: 'ben' }), { code: 'failed-precondition' });
  await assert.rejects(f.call({ action: 'link', mappingKey: 'bmV2ZXItc2Vlbg', yumName: 'Ben' }), { code: 'not-found' });
  assert.equal(JSON.stringify([...f.db.documents]), before);
});

test('Malformed requests are refused before any read or write', async () => {
  const f = setup();
  const before = JSON.stringify([...f.db.documents]);
  for (const data of [
    undefined, {}, { action: 'delete-all' }, { action: 'list', extra: 1 },
    { action: 'link', mappingKey: keyOf(ben) },
    { action: 'link', mappingKey: '../roster', yumName: 'Ben' },
    { action: 'link', mappingKey: keyOf(ben), yumName: 'Ben', uid: 'uid-someone' },
    { action: 'link', mappingKey: keyOf(ben), yumName: 'Ben', alsoLinked: 'yes' },
    { action: 'link', mappingKey: keyOf(ben), yumName: 'x'.repeat(81) },
    { action: 'unlink', mappingKey: 'has/slash' },
  ]) {
    await assert.rejects(f.call(data), { code: 'invalid-argument' }, JSON.stringify(data));
  }
  assert.equal(JSON.stringify([...f.db.documents]), before);
});
