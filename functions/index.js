const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { BotFrameworkAdapter } = require('botbuilder');
const { handleTeamsTurn } = require('./src/teamsBot');

admin.initializeApp();

const MICROSOFT_APP_ID = defineSecret('MICROSOFT_APP_ID');
const MICROSOFT_APP_PASSWORD = defineSecret('MICROSOFT_APP_PASSWORD');

function createAdapter() {
  const adapter = new BotFrameworkAdapter({
    appId: MICROSOFT_APP_ID.value(),
    appPassword: MICROSOFT_APP_PASSWORD.value(),
  });

  adapter.onTurnError = async (context, error) => {
    console.error('Teams bot turn failed:', error);
    await context.sendActivity('Sorry, Yum Donut could not process that donut just now.');
  };

  return adapter;
}

exports.teamsBot = onRequest({
  region: 'us-central1',
  secrets: [MICROSOFT_APP_ID, MICROSOFT_APP_PASSWORD],
}, async (req, res) => {
  if (!MICROSOFT_APP_ID.value() || !MICROSOFT_APP_PASSWORD.value()) {
    res.status(503).send('Teams bot credentials are not configured.');
    return;
  }

  const adapter = createAdapter();
  await adapter.processActivity(req, res, async (context) => {
    await handleTeamsTurn(context, {
      db: admin.firestore(),
      FieldValue: admin.firestore.FieldValue,
    });
  });
});
