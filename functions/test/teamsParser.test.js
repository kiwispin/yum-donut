const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTeamsDonutActivity, normalizeTeamsDonutEmoji, stripHtml } = require('../src/teamsParser');
const { mappingKeyForTeamsUser } = require('../src/identity');
const { localDateKey, localDateLabel } = require('../src/dateKeys');
const { successReply, failureReply } = require('../src/replies');

test('parses a bot-mentioned multi-recipient donut message', () => {
  const activity = {
    text: '<at>YumDonut</at> <at>Alice</at> <at>Bob</at> 🍩🍩 great teamwork',
    recipient: { id: 'bot-id', name: 'YumDonut' },
    entities: [
      { type: 'mention', mentioned: { id: 'bot-id', name: 'YumDonut' } },
      { type: 'mention', mentioned: { id: 'alice-id', name: 'Alice' } },
      { type: 'mention', mentioned: { id: 'bob-id', name: 'Bob' } },
    ],
  };

  const parsed = parseTeamsDonutActivity(activity);
  assert.equal(parsed.botWasMentioned, true);
  assert.equal(parsed.donutCount, 2);
  assert.deepEqual(parsed.recipientTeamsUsers.map((user) => user.name), ['Alice', 'Bob']);
  assert.equal(parsed.message, 'great teamwork');
  assert.deepEqual(parsed.errors, []);
});

test('requires bot mention, recipient, and donut emoji', () => {
  const parsed = parseTeamsDonutActivity({
    text: 'hello',
    recipient: { id: 'bot-id', name: 'YumDonut' },
    entities: [],
  });

  assert.deepEqual(parsed.errors, ['BOT_NOT_MENTIONED', 'NO_RECIPIENTS', 'NO_DONUTS']);
});

test('parses Teams emoji markup and shortcodes as donuts', () => {
  const baseActivity = {
    recipient: { id: 'bot-id', name: 'YumDonut' },
    entities: [
      { type: 'mention', mentioned: { id: 'bot-id', name: 'YumDonut' } },
      { type: 'mention', mentioned: { id: 'alice-id', name: 'Alice' } },
    ],
  };

  assert.equal(normalizeTeamsDonutEmoji('<img alt="&#x1F369;" src="x">'), '🍩');
  assert.equal(normalizeTeamsDonutEmoji('<span itemid="1f369" itemtype="http://schema.skype.com/Emoji"></span>'), '🍩');

  const parsed = parseTeamsDonutActivity({
    ...baseActivity,
    text: '<at>YumDonut</at> <at>Alice</at> <img alt="&#x1F369;" src="x"> <span itemid="1f369" itemtype="http://schema.skype.com/Emoji"></span> :doughnut: Test!',
  });

  assert.equal(parsed.donutCount, 3);
  assert.equal(parsed.message, 'Test!');
  assert.deepEqual(parsed.errors, []);
});

test('counts Teams emoji attachments as donuts when text omits the emoji', () => {
  const activity = {
    text: '<at>YumDonut</at> <at>Alice</at> Test!',
    recipient: { id: 'bot-id', name: 'YumDonut' },
    entities: [
      { type: 'mention', mentioned: { id: 'bot-id', name: 'YumDonut' } },
      { type: 'mention', mentioned: { id: 'alice-id', name: 'Alice' } },
    ],
    attachments: [
      { contentType: 'image/*', contentUrl: 'https://example.test/emoji.png' },
      {
        contentType: 'text/html',
        content: '<img alt="&#x1F369;" src="x"><span itemid="1f369" itemtype="http://schema.skype.com/Emoji"></span>',
      },
    ],
  };

  const parsed = parseTeamsDonutActivity(activity);
  assert.equal(parsed.donutCount, 1);
  assert.equal(parsed.message, 'Test!');
  assert.deepEqual(parsed.errors, []);
});

test('counts multiple Teams emoji image attachments without double-counting metadata', () => {
  const activity = {
    text: '<at>YumDonut</at> <at>Alice</at> Test!',
    recipient: { id: 'bot-id', name: 'YumDonut' },
    entities: [
      { type: 'mention', mentioned: { id: 'bot-id', name: 'YumDonut' } },
      { type: 'mention', mentioned: { id: 'alice-id', name: 'Alice' } },
    ],
    attachments: [
      { contentType: 'image/*' },
      { contentType: 'image/*' },
      {
        contentType: 'text/html',
        content: '<img alt="&#x1F369;" src="x"><span itemid="1f369" itemtype="http://schema.skype.com/Emoji"></span>',
      },
    ],
  };

  const parsed = parseTeamsDonutActivity(activity);
  assert.equal(parsed.donutCount, 2);
  assert.deepEqual(parsed.errors, []);
});

test('falls back to Teams emoji image attachments when HTML has no readable label', () => {
  const activity = {
    text: '<at>YumDonut</at> <at>Alice</at> Test!',
    recipient: { id: 'bot-id', name: 'YumDonut' },
    entities: [
      { type: 'mention', mentioned: { id: 'bot-id', name: 'YumDonut' } },
      { type: 'mention', mentioned: { id: 'alice-id', name: 'Alice' } },
    ],
    attachments: [
      { contentType: 'image/*' },
      { contentType: 'text/html', content: '<p></p>' },
    ],
  };

  const parsed = parseTeamsDonutActivity(activity);
  assert.equal(parsed.donutCount, 1);
  assert.equal(parsed.message, 'Test!');
  assert.deepEqual(parsed.errors, []);
});

test('normalizes Teams mention HTML and entities', () => {
  assert.equal(stripHtml('<at>Alice</at>&nbsp;🍩 &amp; thanks'), '🍩 & thanks');
});

test('creates stable safe mapping keys', () => {
  const key = mappingKeyForTeamsUser({ aadObjectId: '0000:abc/user' });
  assert.match(key, /^[A-Za-z0-9_-]+$/);
});

test('formats Auckland date keys', () => {
  assert.equal(localDateKey(new Date('2026-04-27T12:00:00.000Z')), '2026-04-28');
  assert.equal(localDateLabel(new Date('2026-04-27T12:00:00.000Z')), 'Tue Apr 28 2026');
});

test('formats bot replies', () => {
  assert.equal(successReply({ recipients: ['Alice', 'Bob'], amountEach: 2 }), '🍩 Sent 2 donuts each to Alice and Bob. Sweet shout-out!');
  assert.equal(failureReply('DAILY_LIMIT', { remaining: 1, requested: 4 }), 'You have 1 donut left today, but this would send 4.');
});
