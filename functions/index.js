const admin = require('firebase-admin');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineBoolean } = require('firebase-functions/params');
const { CloudAdapter, ConfigurationBotFrameworkAuthentication } = require('botbuilder');
const { handleTeamsTurn } = require('./src/teamsBot');
const { createYumPalsHandlers } = require('./src/yumpals/callables');
const { createTeacherSettingsCallables } = require('./src/yumpals/teacherSettingsCallables');
const { paidSettingsRefs } = require('./src/yumpals/paidSettingsPaths');
const { createAppConnection } = require('./src/yumpals/appConnection');

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

const yumPalsHandlers = createYumPalsHandlers({
  db: admin.firestore(),
  FieldValue: admin.firestore.FieldValue,
  HttpsError,
});

exports.yumpalsGetState = onCall({ region: 'us-central1' }, yumPalsHandlers.getState);
exports.yumpalsAdopt = onCall({ region: 'us-central1' }, yumPalsHandlers.adopt);
exports.yumpalsCare = onCall({ region: 'us-central1' }, yumPalsHandlers.care);
exports.yumpalsUpdatePet = onCall({ region: 'us-central1' }, yumPalsHandlers.updatePet);
exports.yumpalsUpdateSettings = onCall({ region: 'us-central1' }, yumPalsHandlers.updateSettings);

const YUMPALS_PAID_SETTINGS_READY = defineBoolean('YUMPALS_PAID_SETTINGS_READY', { default: false });
const paidSettingsHandlers = createTeacherSettingsCallables({
  db: admin.firestore(), refs: paidSettingsRefs(admin.firestore()), HttpsError,
  ready: () => YUMPALS_PAID_SETTINGS_READY.value(),
});
exports.yumpalsGetPaidSettings = onCall({ region: 'us-central1' }, paidSettingsHandlers.getSettings);
exports.yumpalsUpdatePaidSettings = onCall({ region: 'us-central1' }, paidSettingsHandlers.updateSettings);

const YUMPALS_PAID_CARE_READY = defineBoolean('YUMPALS_PAID_CARE_READY', { default: false });
const savedYumPals = createAppConnection({ db: admin.firestore(), authAdmin: admin.auth(), HttpsError,
  ready: () => YUMPALS_PAID_CARE_READY.value() });
exports.yumpalsGetPaidCareState = onCall({ region: 'us-central1' }, savedYumPals.paid.getState);
exports.yumpalsPurchaseCare = onCall({ region: 'us-central1' }, savedYumPals.paid.purchase);
exports.yumpalsGetSavedGame = onCall({ region: 'us-central1' }, savedYumPals.game.getGame);
exports.yumpalsChooseSavedGame = onCall({ region: 'us-central1' }, savedYumPals.game.choose);
