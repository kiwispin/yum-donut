// Verification-only entry. Never deploy or copy into the production functions entry.
const { assertLocalSettingsEnvironment } = require('./guard.cjs');
const { redactCredentialForLogs } = require('./credential.cjs');
assertLocalSettingsEnvironment(process.env); // Before importing or starting any SDK.
const { createRequire } = require('node:module');
const { generateKeyPairSync } = require('node:crypto');
const path = require('node:path');
const installed = createRequire(path.resolve(__dirname, '../../../functions/package.json'));
const admin = installed('firebase-admin');
const { onCall, HttpsError } = installed('firebase-functions/v2/https');
const { createTeacherSettingsCallables } = installed('./src/yumpals/teacherSettingsCallables');
const { paidSettingsRefs } = installed('./src/yumpals/paidSettingsPaths');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const credential = redactCredentialForLogs(admin.credential.cert({ projectId: 'demo-yumpals-ownership',
  clientEmail: 'synthetic-http@demo-yumpals-ownership.iam.gserviceaccount.com', privateKey }));
credential.getAccessToken = async () => { throw new Error('OAuth is forbidden in local verification'); };
assertLocalSettingsEnvironment(process.env);
const app = admin.initializeApp({ projectId: 'demo-yumpals-ownership', credential }, 'settings-http-verification');
let db;
async function close() {
  try { if (db) await db.terminate(); } finally { await app.delete(); }
}
try {
  db = app.firestore();
  const options = { db, refs: paidSettingsRefs(db), HttpsError, now: () => Date.parse('2026-09-14T00:00:00Z') };
  const normal = createTeacherSettingsCallables({ ...options, ready: () => true });
  const blocked = createTeacherSettingsCallables({ ...options, ready: () => false });
  exports.yumpalsGetPaidSettings = onCall({ region: 'us-central1' }, normal.getSettings);
  exports.yumpalsUpdatePaidSettings = onCall({ region: 'us-central1' }, normal.updateSettings);
  exports.testNotReadyGetPaidSettings = onCall({ region: 'us-central1' }, blocked.getSettings);
  exports.testNotReadyUpdatePaidSettings = onCall({ region: 'us-central1' }, blocked.updateSettings);
} catch (error) {
  void close().catch(() => {});
  throw error;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  void close().then(() => process.exit(0), () => process.exit(1));
});
