const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { CloudAdapter, ConfigurationBotFrameworkAuthentication } = require('botbuilder');
const { handleTeamsTurn } = require('./src/teamsBot');

admin.initializeApp();

const MICROSOFT_APP_ID = defineSecret('MICROSOFT_APP_ID');
const MICROSOFT_APP_PASSWORD = defineSecret('MICROSOFT_APP_PASSWORD');
const MICROSOFT_APP_TENANT_ID = defineSecret('MICROSOFT_APP_TENANT_ID');

function createAdapter() {
  const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppType: 'SingleTenant',
    MicrosoftAppId: MICROSOFT_APP_ID.value(),
    MicrosoftAppPassword: MICROSOFT_APP_PASSWORD.value(),
    MicrosoftAppTenantId: MICROSOFT_APP_TENANT_ID.value(),
  });

  const adapter = new CloudAdapter(botFrameworkAuthentication);

  adapter.onTurnError = async (context, error) => {
    console.error('Teams bot turn failed:', error);
    await context.sendActivity('Sorry, Yum Donut could not process that donut just now.');
  };

  return adapter;
}

exports.teamsBot = onRequest({
  region: 'us-central1',
  secrets: [MICROSOFT_APP_ID, MICROSOFT_APP_PASSWORD, MICROSOFT_APP_TENANT_ID],
}, async (req, res) => {
  if (!MICROSOFT_APP_ID.value() || !MICROSOFT_APP_PASSWORD.value() || !MICROSOFT_APP_TENANT_ID.value()) {
    res.status(503).send('Teams bot credentials are not configured.');
    return;
  }

  const adapter = createAdapter();
  await adapter.process(req, res, async (context) => {
    await handleTeamsTurn(context, {
      db: admin.firestore(),
      FieldValue: admin.firestore.FieldValue,
    });
  });
});
