const admin = require('firebase-admin');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineBoolean } = require('firebase-functions/params');
const { createYumPalsHandlers } = require('./src/yumpals/callables');
const { createTeacherSettingsCallables } = require('./src/yumpals/teacherSettingsCallables');
const { paidSettingsRefs } = require('./src/yumpals/paidSettingsPaths');
const { createAppConnection } = require('./src/yumpals/appConnection');
const { createHolidayMode } = require('./src/yumpals/holidayMode');
const { withPreflightCache } = require('./src/yumpals/preflightCache');
const { yumPalsRoot } = require('./src/yumpals/paths');
const { createStudentAccountService } = require('./src/studentAccountService');

admin.initializeApp();
exports.yumpalsSetHolidayMode = onCall({ region: 'us-central1' }, createHolidayMode({
  db: admin.firestore(), HttpsError,
  globalRef: admin.firestore().doc('artifacts/yum-donut-school/public/data/config/global'),
  historyRef: yumPalsRoot(admin.firestore()).collection('config').doc('holidayClock'),
  receiptRef: (uid, id) => yumPalsRoot(admin.firestore()).collection('holidayReceipts').doc(`${uid}_${id}`),
}));

const MICROSOFT_APP_ID = defineSecret('MICROSOFT_APP_ID');
const MICROSOFT_APP_PASSWORD = defineSecret('MICROSOFT_APP_PASSWORD');
const MICROSOFT_APP_TENANT_ID = defineSecret('MICROSOFT_APP_TENANT_ID');

function createAdapter() {
  // YumPals endpoints share this entrypoint, but do not use the Teams SDK.
  const { CloudAdapter, ConfigurationBotFrameworkAuthentication } = require('botbuilder');
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
    const { handleTeamsTurn } = require('./src/teamsBot');
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
// Donut pal for everyone; while false only the teacher (yumpalsAdmin) can use it.
const YUMPALS_POCKET_READY = defineBoolean('YUMPALS_POCKET_READY', { default: false });
const savedYumPals = createAppConnection({ db: admin.firestore(), authAdmin: admin.auth(), HttpsError,
  ready: () => YUMPALS_PAID_CARE_READY.value(), pocketReady: () => YUMPALS_POCKET_READY.value() });
exports.yumpalsGetPaidCareState = withPreflightCache(onCall({ region: 'us-central1' }, savedYumPals.paid.getState));
exports.yumpalsPurchaseCare = withPreflightCache(onCall({ region: 'us-central1' }, savedYumPals.paid.purchase));
exports.yumpalsGetSavedGame = withPreflightCache(onCall({ region: 'us-central1' }, savedYumPals.game.getGame));
exports.yumpalsChooseSavedGame = withPreflightCache(onCall({ region: 'us-central1' }, savedYumPals.game.choose));

const manageStudentAccount = createStudentAccountService({ authAdmin: admin.auth(), db: admin.firestore(), HttpsError,
  arrayUnion: (...values) => admin.firestore.FieldValue.arrayUnion(...values),
  arrayRemove: (...values) => admin.firestore.FieldValue.arrayRemove(...values),
});
exports.yumpalsManageStudentAccount = onCall({ region: 'us-central1' }, manageStudentAccount);
