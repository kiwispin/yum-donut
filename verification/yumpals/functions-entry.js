'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');

const functionsRoot = path.resolve(__dirname, '../../functions');
const requireFromFunctions = createRequire(path.join(functionsRoot, 'package.json'));
const admin = requireFromFunctions('firebase-admin');
const { onCall, HttpsError } = requireFromFunctions('firebase-functions/v2/https');
const { createYumPalsHandlers } = require(path.join(functionsRoot, 'src/yumpals/callables'));

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'demo-yumpals-stage';
if (PROJECT_ID !== 'demo-yumpals-stage') {
  throw new Error(`Refusing YumPals verification Functions outside demo-yumpals-stage: ${PROJECT_ID}`);
}

function assertLocalEmulatorHost(name, expectedPort) {
  const value = process.env[name];
  const match = /^([^:]+):(\d+)$/u.exec(value || '');
  if (!match || !['127.0.0.1', 'localhost'].includes(match[1]) || Number(match[2]) !== expectedPort) {
    throw new Error(`Refusing YumPals verification Functions without local ${name} on port ${expectedPort}.`);
  }
}

assertLocalEmulatorHost('FIRESTORE_EMULATOR_HOST', 8180);
assertLocalEmulatorHost('FIREBASE_AUTH_EMULATOR_HOST', 9199);

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const handlers = createYumPalsHandlers({
  db: admin.firestore(),
  FieldValue: admin.firestore.FieldValue,
  HttpsError,
});

exports.yumpalsGetState = onCall({ region: 'us-central1' }, handlers.getState);
exports.yumpalsAdopt = onCall({ region: 'us-central1' }, handlers.adopt);
exports.yumpalsCare = onCall({ region: 'us-central1' }, handlers.care);
exports.yumpalsUpdatePet = onCall({ region: 'us-central1' }, handlers.updatePet);
exports.yumpalsUpdateSettings = onCall({ region: 'us-central1' }, handlers.updateSettings);
