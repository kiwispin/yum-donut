'use strict';

// Synthetic fixtures; never imports the Bot SDK or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const { handleTeamsTurn } = require('../src/teamsBot');

const FieldValue = { serverTimestamp: () => 'SERVER_TIMESTAMP', increment: amount => ({ increment: amount }) };

function quietDb() {
  const doc = () => ({ collection: () => ({ doc }), set: async () => {} });
  return { collection: () => ({ doc }), batch: () => ({ set: () => {}, commit: async () => {} }) };
}

// Shaped like Alison's refused message: the donut is missing from the text and only appears,
// in an unknown form, in the formatted copy.
const activity = {
  type: 'message',
  channelId: 'msteams',
  text: 'GOOD JOB!! <at>YumDonut</at> <at>Aubree</at> Thanks for filling in for me this week',
  recipient: { id: '28:bot', name: 'YumDonut' },
  from: { id: '29:alison', aadObjectId: 'aad-alison', name: 'Alison' },
  entities: [
    { type: 'mention', mentioned: { id: '28:bot', name: 'YumDonut' } },
    { type: 'mention', mentioned: { id: '29:aubree', name: 'Aubree' } },
  ],
  attachments: [{
    contentType: 'text/html',
    content: '<p>GOOD JOB!! <span itemscope="" itemtype="http://schema.skype.com/Mention" itemid="1">Aubree</span> Thanks for filling in for me this week '
      + '<img src="https://statics.teams.cdn.office.net/evergreen-assets/emoji/bagel/default.png?token=secret" alt="🥯" itemtype="http://schema.skype.com/Emoji" itemid="bagel" width="20" href="https://private.example/x"></p>',
  }],
};

test('A refused message logs the shape of its emoji but never names or words', async () => {
  const warnings = [];
  const warn = console.warn; console.warn = (...args) => warnings.push(args);
  const sent = [];
  try {
    await handleTeamsTurn({ activity, sendActivity: async reply => sent.push(reply) }, { db: quietDb(), FieldValue });
  } finally { console.warn = warn; }

  assert.equal(sent.length, 1, 'the bot still replies');
  const [label, details] = warnings.find(([first]) => first === 'Teams donut parse miss:');
  assert.ok(label);
  assert.equal(details.error, 'NO_DONUTS');
  const [html] = details.html;
  assert.deepEqual(html.emojiCodePoints, ['1f96f']);
  assert.deepEqual(html.tags, [{
    tag: 'img',
    attributes: {
      src: 'statics.teams.cdn.office.net/evergreen-assets/emoji/bagel/default.png',
      alt: '🥯', itemtype: 'http://schema.skype.com/Emoji', itemid: 'bagel', width: '…', href: '…',
    },
  }]);
  const logged = JSON.stringify(details.html);
  for (const secret of ['Aubree', 'Thanks', 'filling', 'GOOD JOB', 'token', 'private.example']) {
    assert.equal(logged.includes(secret), false, secret);
  }
});
