const assert = require('node:assert/strict');
function assertLocalSettingsEnvironment(env) {
  // Required CLI-owned launch markers are passed in BOTH discovery and workers.
  // Arbitrary parent variables are not forwarded to SDK discovery by this CLI.
  assert.equal(env.FUNCTIONS_EMULATOR, 'true', 'Verification entry requires the Functions emulator');
  assert.equal(env.FIREBASE_EMULATOR_HUB, '127.0.0.1:4401', 'Verification entry requires the local emulator hub');
  assert.equal(env.GCLOUD_PROJECT, 'demo-yumpals-ownership', 'Refusing non-demo project');
  for (const key of ['GCP_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_QUOTA_PROJECT']) {
    if (env[key]) assert.equal(env[key], 'demo-yumpals-ownership', `Refusing conflicting ${key}`);
  }
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8180', 'Refusing unexpected Firestore host');
  assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9199', 'Refusing unexpected Auth host');
  // Discovery has an ephemeral SDK control port, not the public Functions port.
  // The runner strictly validates 5101; reject a conflicting worker override too.
  if (env.FUNCTIONS_EMULATOR_HOST !== undefined) assert.equal(env.FUNCTIONS_EMULATOR_HOST, '127.0.0.1:5101', 'Refusing unexpected Functions host');
  assert.equal(typeof env.FIREBASE_CONFIG, 'string', 'Firebase config is required');
  assert.equal(JSON.parse(env.FIREBASE_CONFIG).projectId, 'demo-yumpals-ownership', 'Refusing conflicting Firebase config');
}
module.exports = { assertLocalSettingsEnvironment };
