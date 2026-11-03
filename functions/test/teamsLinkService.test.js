'use strict';

// Synthetic Firestore and Teams fixtures; never imports the Admin SDK, the Bot SDK or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTeamsLinkService } = require('../src/teamsLinkService');
const { mappingKeyForTeamsUser } = require('../src/identity');
const { giveDonutsFromTeams } = require('../src/donutService');

class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const FieldValue = { serverTimestamp: () => 'SERVER_TIMESTAMP', increment: amount => ({ increment: amount }) };
const DATA = 'artifacts/yum-donut-school/public/data';
const TEAMS = `${DATA}/integrations/teams`;
const NOW = new Date('2026-11-03T00:00:00Z');

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
          const current = writes.has(ref.path) ? writes.get(ref.path) : documents.get(ref.path);
          writes.set(ref.path, options.merge ? { ...current, ...value } : { ...value });
        },
        update: (ref, value) => {
          const current = writes.has(ref.path) ? writes.get(ref.path) : documents.get(ref.path);
          if (current === undefined) throw new Error('UPDATE_MISSING');
          const next = { ...current };
          for (const [key, field] of Object.entries(value)) next[key] = field?.increment !== undefined ? (next[key] || 0) + field.increment : field;
          writes.set(ref.path, next);
        },
        delete: ref => { writes.set(ref.path, undefined); },
      };
      const result = await callback(transaction);
      for (const [path, value] of writes) {
        if (value === undefined) documents.delete(path); else documents.set(path, value);
      }
      return result;
    },
  };
}

const timestamp = ms => ({ toMillis: () => ms });
const keyOf = id => mappingKeyForTeamsUser({ aadObjectId: id });

// Team members as Teams returns them: both ids, real names and emails.
const aaishah = { aadObjectId: 'aad-aaishah', id: '29:aaishah', name: 'Aaishah Khan', email: 'aaishah@school.example' };
const amelia = { aadObjectId: 'aad-amelia', id: '29:amelia', name: 'Amelia Smith', email: 'amelia@school.example' };
const ben = { aadObjectId: 'aad-ben', id: '29:ben', name: 'Ben Lee', userPrincipalName: 'ben@school.example' };
const teacher = { aadObjectId: 'aad-teacher', id: '29:teacher', name: 'Mr Rayner' };
const TEAM = [aaishah, amelia, ben, teacher];

function setup({ team = 'ok' } = {}) {
  const db = createDb();
  const seed = (path, value) => db.documents.set(path, clone(value));
  const read = path => clone(db.documents.get(path));
  const pending = (id, fields) => seed(`${TEAMS}/pendingMappings/${keyOf(id)}`, {
    mappingKey: keyOf(id), teamsUserId: id, aadObjectId: null, userPrincipalName: null, source: 'donut_message', lastSeenAt: timestamp(1000), ...fields,
  });
  seed(`${DATA}/config/roster`, { names: ['Mr Rayner', 'Aaishah', 'Amelia S', 'Ben', 'Chenuthi', 'Gone'], removed_names: ['Chenuthi', 'Gone'] });
  // What the bot has seen so far: givers by Entra id, mentions by Teams id, split mention names.
  pending('aad-aaishah', { displayName: 'Aaishah Khan', aadObjectId: 'aad-aaishah' });
  pending('29:aaishah', { displayName: 'Aaishah' });
  pending('29:amelia', { displayName: 'S' });
  pending('aad-teacher', { displayName: 'Mr Rayner', aadObjectId: 'aad-teacher' });
  pending('29:chenuthi', { displayName: 'Chenuthi' });
  pending('29:appvalidation', { displayName: 'AppValidation' });
  // Hand-made console links from before this screen: the teacher, and a student who has left.
  seed(`${TEAMS}/mappings/${keyOf('aad-teacher')}`, { yumName: 'Mr Rayner', uid: 'uid-teacher' });
  seed(`${TEAMS}/mappings/${keyOf('29:chenuthi')}`, { yumName: 'Chenuthi', uid: 'uid-chenuthi' });
  seed(`${DATA}/users/Mr Rayner`, { name: 'Mr Rayner', uid: 'uid-teacher', balance: 0, bank_balance: 0, lifetime_given: 0, lifetime_received: 0 });
  seed(`${DATA}/users/Aaishah`, { name: 'Aaishah', balance: 4, bank_balance: 0, lifetime_given: 0, lifetime_received: 4 });

  const reference = { serviceUrl: 'https://smba.trafficmanager.net/amer/', teamId: '19:team', tenantId: 'tenant', teamName: 'Room 12' };
  const memberCalls = [];
  const roster = {
    reference: async () => (team === 'unknown' ? null : reference),
    members: async () => { if (team === 'error') throw new Error('Teams is down'); return TEAM.map(member => ({ ...member })); },
    member: async (_reference, userId) => {
      memberCalls.push(userId);
      if (team === 'error') throw new Error('Teams is down');
      const member = TEAM.find(entry => entry.aadObjectId === userId || entry.id === userId);
      return member ? { ...member } : null;
    },
  };
  const manage = createTeamsLinkService({ db, HttpsError, FieldValue, roster });
  const teacherAuth = { uid: 'uid-teacher', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'password' } } };
  const call = (data, auth = teacherAuth) => manage({ auth, data });
  const mapping = id => read(`${TEAMS}/mappings/${keyOf(id)}`);
  const snapshot = () => JSON.stringify([...db.documents]);
  return { db, seed, read, call, mapping, snapshot, memberCalls };
}

const gift = (db, sender, recipients, activityId) => giveDonutsFromTeams({
  db, FieldValue, activityId, senderTeamsUser: sender, recipientTeamsUsers: recipients, donutCount: 1, message: 'well done', now: NOW,
});

test('Only the signed-in teacher can list or change Teams links', async () => {
  const f = setup();
  const before = f.snapshot();
  const student = { uid: 'uid-ben', token: { firebase: { sign_in_provider: 'password' } } };
  const anonymousAdmin = { uid: 'anon', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'anonymous' } } };
  for (const auth of [null, student, anonymousAdmin]) {
    for (const data of [
      { action: 'list' },
      { action: 'link', personId: keyOf('aad-ben'), yumName: 'Ben' },
      { action: 'unlink', personId: keyOf('aad-teacher') },
      { action: 'forget', mappingKey: keyOf('29:chenuthi') },
    ]) await assert.rejects(f.call(data, auth), { code: 'permission-denied' });
  }
  assert.equal(f.snapshot(), before);
  assert.deepEqual(f.memberCalls, []);
});

test('The list shows every Team member once with their real name, and moves leavers aside', async () => {
  const f = setup();
  const result = await f.call({ action: 'list' });
  assert.deepEqual(result.team, { status: 'ok', name: 'Room 12' });
  assert.deepEqual(result.roster, ['Mr Rayner', 'Aaishah', 'Amelia S', 'Ben']);
  assert.deepEqual(result.people.map(person => person.displayName), ['Aaishah Khan', 'Amelia Smith', 'Ben Lee', 'Mr Rayner']);
  const ameliaRow = result.people.find(person => person.displayName === 'Amelia Smith');
  assert.deepEqual(ameliaRow, {
    personId: keyOf('aad-amelia'), displayName: 'Amelia Smith', email: 'amelia@school.example',
    yumName: null, complete: false, onRoster: false, hasAccount: false,
  });
  assert.equal(result.people.find(person => person.displayName === 'Ben Lee').email, 'ben@school.example');
  const teacherRow = result.people.find(person => person.displayName === 'Mr Rayner');
  assert.equal(teacherRow.yumName, 'Mr Rayner');
  assert.equal(teacherRow.complete, false, 'the hand-made link covers giving, not being mentioned');
  assert.equal(teacherRow.hasAccount, true);
  // Aaishah's two records and Amelia's "S" belong to Team members, so only leavers and strangers are left over.
  assert.deepEqual(result.records.map(record => [record.displayName, record.yumName, record.onRoster]).sort(), [
    ['AppValidation', null, false], ['Chenuthi', 'Chenuthi', false],
  ]);
});

test('Linking a Team member covers both their ids, so they can be given to and can give', async () => {
  const f = setup();
  const result = await f.call({ action: 'link', personId: keyOf('aad-amelia'), yumName: 'Amelia S' });
  assert.deepEqual(result, { personId: keyOf('aad-amelia'), yumName: 'Amelia S', changed: true, previousName: null });
  for (const id of ['aad-amelia', '29:amelia']) {
    assert.deepEqual(f.mapping(id), {
      teamsUserId: '29:amelia', teamsAadObjectId: 'aad-amelia', teamsEmail: 'amelia@school.example', displayName: 'Amelia Smith',
      mappingKey: keyOf(id), yumName: 'Amelia S', linkedAt: 'SERVER_TIMESTAMP', linkedBy: 'uid-teacher',
    });
  }
  // Mentioned as "S" (Teams id only), the gift still reaches Amelia S.
  const mentioned = await gift(f.db, { aadObjectId: 'aad-teacher', name: 'Mr Rayner' }, [{ id: '29:amelia', name: 'S' }], 'a1');
  assert.equal(mentioned.ok, true);
  assert.deepEqual(mentioned.recipients, ['Amelia S']);
  // As a giver (Entra id) the bot also finds her; she is refused only because she has never signed in.
  const giving = await gift(f.db, { aadObjectId: 'aad-amelia', name: 'Amelia Smith' }, [{ id: '29:ben', name: 'Ben' }], 'a2');
  assert.notEqual(giving.code, 'SENDER_UNMAPPED');

  const listed = await f.call({ action: 'list' });
  const row = listed.people.find(person => person.personId === keyOf('aad-amelia'));
  assert.equal(row.complete, true);
  assert.equal(row.hasAccount, false);
});

test('Relinking a half-linked member fills in the missing id and keeps the hand-made uid', async () => {
  const f = setup();
  const result = await f.call({ action: 'link', personId: keyOf('aad-teacher'), yumName: 'Mr Rayner' });
  assert.equal(result.changed, true);
  assert.equal(f.mapping('aad-teacher').uid, 'uid-teacher');
  assert.equal(f.mapping('aad-teacher').linkedAt, undefined, 'the existing link is refreshed, not replaced');
  assert.equal(f.mapping('29:teacher').yumName, 'Mr Rayner');
  assert.equal((await f.call({ action: 'list' })).people.find(person => person.displayName === 'Mr Rayner').complete, true);
});

test('Linking a second Team member to the same name needs the teacher to confirm', async () => {
  const f = setup();
  await f.call({ action: 'link', personId: keyOf('aad-aaishah'), yumName: 'Aaishah' });
  await assert.rejects(f.call({ action: 'link', personId: keyOf('aad-ben'), yumName: 'Aaishah' }), { code: 'already-exists' });
  assert.equal(f.mapping('aad-ben'), undefined);
  await f.call({ action: 'link', personId: keyOf('aad-ben'), yumName: 'Aaishah', alsoLinked: true });
  assert.equal(f.mapping('29:ben').yumName, 'Aaishah');
});

test('Changing a member\'s link replaces both ids and drops the old uid', async () => {
  const f = setup();
  f.seed(`${TEAMS}/mappings/${keyOf('aad-ben')}`, { yumName: 'Aaishah', uid: 'uid-aaishah', isAdmin: true });
  const result = await f.call({ action: 'link', personId: keyOf('aad-ben'), yumName: 'Ben' });
  assert.equal(result.previousName, 'Aaishah');
  for (const id of ['aad-ben', '29:ben']) {
    assert.equal(f.mapping(id).yumName, 'Ben');
    assert.equal(f.mapping(id).uid, undefined);
    assert.equal(f.mapping(id).isAdmin, undefined);
  }
});

test('Removing a member\'s link removes both ids', async () => {
  const f = setup();
  await f.call({ action: 'link', personId: keyOf('aad-aaishah'), yumName: 'Aaishah' });
  const result = await f.call({ action: 'unlink', personId: keyOf('aad-aaishah') });
  assert.deepEqual(result, { personId: keyOf('aad-aaishah'), removed: true, previousName: 'Aaishah' });
  assert.equal(f.mapping('aad-aaishah'), undefined);
  assert.equal(f.mapping('29:aaishah'), undefined);
  assert.equal((await f.call({ action: 'list' })).people.find(person => person.displayName === 'Aaishah Khan').yumName, null);
});

test('Forgetting someone who left removes their link and the bot\'s record of them', async () => {
  const f = setup();
  const result = await f.call({ action: 'forget', mappingKey: keyOf('29:chenuthi') });
  assert.deepEqual(result, { mappingKey: keyOf('29:chenuthi'), removed: true, previousName: 'Chenuthi' });
  await f.call({ action: 'forget', mappingKey: keyOf('29:appvalidation') });
  assert.equal(f.mapping('29:chenuthi'), undefined);
  assert.equal(f.read(`${TEAMS}/pendingMappings/${keyOf('29:chenuthi')}`), undefined);
  assert.deepEqual((await f.call({ action: 'list' })).records, []);
  const chenuthiGift = await gift(f.db, { aadObjectId: 'aad-teacher', name: 'Mr Rayner' }, [{ id: '29:chenuthi', name: 'Chenuthi' }], 'a3');
  assert.equal(chenuthiGift.code, 'RECIPIENT_UNMAPPED');
});

test('Only current Team members on the roster can be linked', async () => {
  const f = setup();
  const before = f.snapshot();
  await assert.rejects(f.call({ action: 'link', personId: keyOf('29:chenuthi'), yumName: 'Ben' }), { code: 'not-found' });
  await assert.rejects(f.call({ action: 'link', personId: keyOf('aad-ben'), yumName: 'Chenuthi' }), { code: 'failed-precondition' });
  await assert.rejects(f.call({ action: 'link', personId: keyOf('aad-ben'), yumName: 'ben' }), { code: 'failed-precondition' });
  assert.equal(f.snapshot(), before);
});

test('If Teams cannot be reached the list still works and linking a member says so', async () => {
  const f = setup({ team: 'error' });
  const result = await f.call({ action: 'list' });
  assert.equal(result.team.status, 'error');
  assert.deepEqual(result.people, []);
  assert.equal(result.records.length, 6);
  await assert.rejects(f.call({ action: 'link', personId: keyOf('aad-ben'), yumName: 'Ben' }), { code: 'unavailable' });
});

test('Before the bot knows the Team, records the bot has seen can still be linked one by one', async () => {
  const f = setup({ team: 'unknown' });
  const result = await f.call({ action: 'list' });
  assert.deepEqual(result.team, { status: 'unknown', name: null });
  assert.deepEqual(result.people, []);
  assert.equal(result.records.length, 6);
  await assert.rejects(f.call({ action: 'link', personId: keyOf('aad-ben'), yumName: 'Ben' }), { code: 'failed-precondition' });

  await f.call({ action: 'link', mappingKey: keyOf('29:aaishah'), yumName: 'Aaishah' });
  assert.deepEqual(f.mapping('29:aaishah'), {
    teamsUserId: '29:aaishah', teamsAadObjectId: null, teamsEmail: null, displayName: 'Aaishah',
    mappingKey: keyOf('29:aaishah'), yumName: 'Aaishah', linkedAt: 'SERVER_TIMESTAMP', linkedBy: 'uid-teacher',
  });
  await assert.rejects(f.call({ action: 'link', mappingKey: keyOf('aad-aaishah'), yumName: 'Aaishah' }), { code: 'already-exists' });
  await f.call({ action: 'link', mappingKey: keyOf('aad-aaishah'), yumName: 'Aaishah', alsoLinked: true });
  assert.equal(f.mapping('aad-aaishah').teamsAadObjectId, 'aad-aaishah');
  await assert.rejects(f.call({ action: 'link', mappingKey: 'bmV2ZXItc2Vlbg', yumName: 'Ben' }), { code: 'not-found' });

  assert.deepEqual(await f.call({ action: 'unlink', mappingKey: keyOf('29:aaishah') }), { mappingKey: keyOf('29:aaishah'), removed: true, previousName: 'Aaishah' });
  assert.deepEqual(await f.call({ action: 'unlink', mappingKey: keyOf('29:aaishah') }), { mappingKey: keyOf('29:aaishah'), removed: false, previousName: null });
});

test('Malformed requests are refused before any read or write', async () => {
  const f = setup();
  const before = f.snapshot();
  for (const data of [
    undefined, {}, { action: 'delete-all' }, { action: 'list', extra: 1 },
    { action: 'link', personId: keyOf('aad-ben') },
    { action: 'link', personId: '../roster', yumName: 'Ben' },
    { action: 'link', personId: keyOf('aad-ben'), mappingKey: keyOf('aad-ben'), yumName: 'Ben' },
    { action: 'link', personId: keyOf('aad-ben'), yumName: 'Ben', uid: 'uid-someone' },
    { action: 'link', personId: keyOf('aad-ben'), yumName: 'Ben', alsoLinked: 'yes' },
    { action: 'link', personId: keyOf('aad-ben'), yumName: 'x'.repeat(81) },
    { action: 'forget', personId: keyOf('aad-ben') },
    { action: 'unlink', mappingKey: 'has/slash' },
  ]) {
    await assert.rejects(f.call(data), { code: 'invalid-argument' }, JSON.stringify(data));
  }
  assert.equal(f.snapshot(), before);
  assert.deepEqual(f.memberCalls, []);
});
