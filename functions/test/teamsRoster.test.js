'use strict';

// Synthetic fixtures; never imports the Bot SDK or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTeamsRoster, rememberTeam, teamReferenceFromActivity, trustedServiceUrl } = require('../src/teamsRoster');
const { handleTeamsTurn } = require('../src/teamsBot');
const { parseTeamsDonutActivity } = require('../src/teamsParser');

const TEAMS_DOC = 'artifacts/yum-donut-school/public/data/integrations/teams';
const FieldValue = { serverTimestamp: () => 'SERVER_TIMESTAMP', increment: amount => ({ increment: amount }) };

function createDb() {
  const documents = new Map();
  const docRef = path => ({
    path,
    collection: name => ({ doc: id => docRef(`${path}/${name}/${id}`) }),
    get: async () => ({ exists: documents.has(path), data: () => structuredClone(documents.get(path)) }),
    set: async (value, options = {}) => { documents.set(path, options.merge ? { ...documents.get(path), ...value } : value); },
  });
  return { documents, collection: name => ({ doc: id => docRef(`${name}/${id}`) }) };
}

const channelMessage = (overrides = {}) => ({
  type: 'message',
  channelId: 'msteams',
  serviceUrl: 'https://smba.trafficmanager.net/amer/',
  conversation: { id: '19:general;messageid=1', tenantId: 'tenant' },
  channelData: { team: { id: '19:team', name: 'Room 12' }, tenant: { id: 'tenant' } },
  from: { id: '29:teacher', aadObjectId: 'aad-teacher', name: 'Mr Rayner' },
  recipient: { id: '28:bot', name: 'YumDonut' },
  entities: [],
  text: 'hello',
  ...overrides,
});

test('Only Microsoft Teams service addresses are trusted', () => {
  assert.equal(trustedServiceUrl('https://smba.trafficmanager.net/amer/'), true);
  assert.equal(trustedServiceUrl('https://smba.trafficmanager.net/apac/tenant-id/'), true);
  for (const url of ['http://smba.trafficmanager.net/amer/', 'https://evil.example/smba.trafficmanager.net/', 'https://smba.trafficmanager.net.evil.example/',
    'https://user@smba.trafficmanager.net/', 'https://smba.trafficmanager.net:8443/', 'not a url', '', null]) {
    assert.equal(trustedServiceUrl(url), false, String(url));
  }
});

test('The bot remembers its team from a channel message, and ignores anything else', async () => {
  assert.deepEqual(teamReferenceFromActivity(channelMessage()), {
    serviceUrl: 'https://smba.trafficmanager.net/amer/', teamId: '19:team', tenantId: 'tenant', teamName: 'Room 12', conversationId: '19:general;messageid=1',
  });
  assert.equal(teamReferenceFromActivity(channelMessage({ channelData: {} })), null, 'a chat outside a team');
  assert.equal(teamReferenceFromActivity(channelMessage({ serviceUrl: 'https://evil.example/' })), null);
  assert.equal(teamReferenceFromActivity(channelMessage({ channelId: 'webchat' })), null);

  const db = createDb();
  assert.equal(await rememberTeam({ db, FieldValue, activity: channelMessage() }), true);
  assert.equal(db.documents.get(TEAMS_DOC).teamReference.teamId, '19:team');
  assert.equal(db.documents.get(TEAMS_DOC).teamReference.updatedAt, 'SERVER_TIMESTAMP');
});

test('A message that does not mention the bot is still ignored after the team is remembered', async () => {
  const db = createDb();
  const sent = [];
  await handleTeamsTurn({ activity: channelMessage(), sendActivity: async reply => sent.push(reply) }, { db, FieldValue });
  assert.deepEqual(sent, []);
  assert.equal(db.documents.get(TEAMS_DOC).teamReference.teamName, 'Room 12');
});

test('A failure to remember the team never stops the bot replying', async () => {
  const db = createDb();
  const failingDoc = path => ({
    path,
    collection: name => ({ doc: id => ({ path: `${path}/${name}/${id}` }) }),
    set: async () => { throw new Error('write failed'); },
  });
  db.collection = name => ({ doc: id => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: docId => failingDoc(`${name}/${id}/${docId}`) }) }) }) }) });
  db.batch = () => ({ set: () => {}, commit: async () => {} });
  const sent = [];
  const warn = console.warn; console.warn = () => {};
  try {
    // Mentions the bot but nobody else, so the bot must reply with a parse refusal.
    await handleTeamsTurn({
      activity: channelMessage({ text: '<at>YumDonut</at> 🍩', entities: [{ type: 'mention', mentioned: { id: '28:bot', name: 'YumDonut' } }] }),
      sendActivity: async reply => sent.push(reply),
    }, { db, FieldValue });
  } finally { console.warn = warn; }
  assert.equal(sent.length, 1);
});

function rosterFixture({ saved, pages = [], member = null, failWith = null } = {}) {
  const db = createDb();
  if (saved !== undefined) db.documents.set(TEAMS_DOC, { teamReference: saved });
  const calls = [];
  const adapter = {
    async continueConversationAsync(appId, reference, logic) {
      calls.push({ appId, reference });
      // Mirrors BotAdapter.runMiddleware: an escaping error would reach onTurnError and post in the channel.
      try { await logic({ fake: 'context' }); } catch { calls.push('onTurnError'); }
    },
  };
  const teamsInfo = {
    async getPagedTeamMembers(_context, teamId, pageSize, token) {
      if (failWith) throw failWith;
      calls.push({ teamId, pageSize, token: token || null });
      return pages[token ? Number(token) : 0];
    },
    async getTeamMember(_context, teamId, userId) {
      if (failWith) throw failWith;
      calls.push({ teamId, userId });
      if (!member) throw Object.assign(new Error('missing'), { statusCode: 404 });
      return member;
    },
  };
  const roster = createTeamsRoster({ db, createAdapter: () => adapter, appId: () => 'app-id', tenantId: () => 'tenant', teamsInfo: () => teamsInfo });
  return { roster, calls };
}

const SAVED = { serviceUrl: 'https://smba.trafficmanager.net/amer/', teamId: '19:team', tenantId: 'tenant', conversationId: '19:general' };

test('Team members are read page by page through the bot', async () => {
  const f = rosterFixture({ saved: SAVED, pages: [{ members: [{ id: '29:a' }], continuationToken: '1' }, { members: [{ id: '29:b' }] }] });
  const saved = await f.roster.reference();
  assert.deepEqual((await f.roster.members(saved)).map(member => member.id), ['29:a', '29:b']);
  assert.equal(f.calls[0].appId, 'app-id');
  assert.deepEqual(f.calls[0].reference.conversation, { id: '19:general', tenantId: 'tenant', isGroup: true, conversationType: 'channel' });
  assert.deepEqual(f.calls.slice(1), [{ teamId: '19:team', pageSize: 200, token: null }, { teamId: '19:team', pageSize: 200, token: '1' }]);
});

test('A member who has left reads as nobody, and Teams errors surface without a channel apology', async () => {
  const gone = rosterFixture({ saved: SAVED });
  assert.equal(await gone.roster.member(SAVED, 'aad-left'), null);
  const down = rosterFixture({ saved: SAVED, failWith: new Error('Teams is down') });
  await assert.rejects(down.roster.members(SAVED), /Teams is down/);
  assert.equal(down.calls.includes('onTurnError'), false);
});

test('A tampered team reference is refused before any token is used', async () => {
  assert.equal(await rosterFixture().roster.reference(), null);
  for (const saved of [{ ...SAVED, serviceUrl: 'https://evil.example/' }, { ...SAVED, tenantId: 'other-tenant' }, { ...SAVED, teamId: '' }]) {
    const f = rosterFixture({ saved });
    await assert.rejects(f.roster.reference(), /not trusted/);
    assert.deepEqual(f.calls, []);
  }
});

test('A mention Teams splits into "Amelia" and "S" is one recipient called "Amelia S"', () => {
  const mention = name => ({ type: 'mention', mentioned: { id: '29:amelia', name }, text: `<at>${name}</at>` });
  const parsed = parseTeamsDonutActivity(channelMessage({
    text: '<at>YumDonut</at> <at>Amelia</at> <at>S</at> 🍩 great work',
    entities: [{ type: 'mention', mentioned: { id: '28:bot', name: 'YumDonut' } }, mention('Amelia'), mention('S')],
  }));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.recipientTeamsUsers, [{ id: '29:amelia', name: 'Amelia S' }]);
  assert.equal(parsed.donutCount, 1);
});
