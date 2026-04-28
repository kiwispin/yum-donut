const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTeamsDonutActivity, stripHtml } = require('../src/teamsParser');
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
  assert.equal(successReply({ recipients: ['Alice', 'Bob'], amountEach: 2 }), '🍩 Sent 2 donuts each to Alice and Bob. Nice recognition!');
  assert.equal(failureReply('DAILY_LIMIT', { remaining: 1, requested: 4 }), 'You have 1 donut left today, but this would send 4.');
});
