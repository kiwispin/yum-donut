import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeSettingsUrl } from './settings-http-checks.mjs';
import { routePaidCareUrl } from './paid-care-http-checks.mjs';
import { routeSavedGameUrl } from './saved-game-http-checks.mjs';
test('saved-game routing accepts only the two exact demo endpoints', () => {
  for (const name of ['yumpalsGetSavedGame', 'yumpalsChooseSavedGame']) {
    const url = `https://us-central1-demo-yumpals-ownership.cloudfunctions.net/${name}`;
    assert.equal(routeSavedGameUrl(url), `http://127.0.0.1:5101/demo-yumpals-ownership/us-central1/${name}`);
    for (const invalid of [`${url}?x=1`, `${url}/`, url.replace('demo-yumpals-ownership', 'yum-donut-school'), url.replace('https:', 'http:')]) assert.throws(() => routeSavedGameUrl(invalid));
  }
});
const require = createRequire(import.meta.url);
const { assertLocalSettingsEnvironment } = require('./settings-functions/guard.cjs');
const { redactCredentialForLogs } = require('./settings-functions/credential.cjs');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const valid = { FUNCTIONS_EMULATOR: 'true', FIREBASE_EMULATOR_HUB: '127.0.0.1:4401', FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-yumpals-ownership' }), GCLOUD_PROJECT: 'demo-yumpals-ownership',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199', FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5101' };

test('verification entry rejects wrong project/host/launcher before SDK access', () => {
  assert.doesNotThrow(() => assertLocalSettingsEnvironment(valid));
  for (const [key, value] of [['FUNCTIONS_EMULATOR', undefined], ['FUNCTIONS_EMULATOR', 'false'], ['FIREBASE_EMULATOR_HUB', undefined], ['FIREBASE_EMULATOR_HUB', '192.0.2.1:4401'], ['GCLOUD_PROJECT', 'real-project'], ['GCLOUD_PROJECT', undefined],
    ['GOOGLE_CLOUD_QUOTA_PROJECT', 'real-project'], ['GCP_PROJECT', 'real-project'], ['GOOGLE_CLOUD_PROJECT', 'real-project'],
    ['FIRESTORE_EMULATOR_HOST', 'localhost:8180'], ['FIREBASE_AUTH_EMULATOR_HOST', '192.0.2.1:9199'], ['FUNCTIONS_EMULATOR_HOST', '127.0.0.1:5001'],
    ['FIRESTORE_EMULATOR_HOST', undefined], ['FIREBASE_AUTH_EMULATOR_HOST', undefined], ['FIREBASE_CONFIG', undefined],
    ['FIREBASE_CONFIG', 'not-json'], ['FIREBASE_CONFIG', JSON.stringify({ projectId: 'real-project' })]]) assert.throws(() => assertLocalSettingsEnvironment({ ...valid, [key]: value }));
  // The actual entry must throw before resolving SDKs, even with no installed packages on NODE_PATH.
  const result = spawnSync(process.execPath, [path.join(DIR, 'settings-functions/index.cjs')], { env: {}, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Verification entry requires the Functions emulator/);
});

test('actual installed CLI discovery and worker environment builders both satisfy mandatory guards without parent credentials', () => {
  const cli = createRequire('/usr/local/lib/node_modules/firebase-tools/package.json');
  const { FunctionsEmulator } = cli('./lib/emulator/functionsEmulator');
  const { EmulatorRegistry } = cli('./lib/emulator/registry');
  const originalList = EmulatorRegistry.listRunningWithInfo;
  EmulatorRegistry.listRunningWithInfo = () => [
    { name: 'auth', host: '127.0.0.1', port: 9199 }, { name: 'firestore', host: '127.0.0.1', port: 8180 },
    { name: 'hub', host: '127.0.0.1', port: 4401 }, { name: 'functions', host: '127.0.0.1', port: 5101 },
  ];
  try {
    const instance = Object.create(FunctionsEmulator.prototype);
    instance.args = { projectId: 'demo-yumpals-ownership' }; instance.adminSdkConfig = {};
    instance.getEmulatorInfo = () => undefined;
    instance.getUserEnvs = () => ({});
    // The exact object construction used by discoverTriggers in this installed CLI.
    const discovery = { ...instance.getSystemEnvs(), ...instance.getEmulatorEnvs(), FIREBASE_CONFIG: instance.getFirebaseConfig() };
    assert.equal(discovery.YUMPALS_SETTINGS_HTTP_FIXTURE, undefined);
    assert.equal(discovery.FUNCTIONS_EMULATOR_HOST, undefined);
    assert.equal(discovery.GOOGLE_APPLICATION_CREDENTIALS, undefined);
    assert.doesNotThrow(() => assertLocalSettingsEnvironment(discovery));
    const worker = instance.getRuntimeEnvs({ env: {} }, { entryPoint: 'yumpalsGetPaidSettings', name: 'fixture', httpsTrigger: {} });
    assert.doesNotThrow(() => assertLocalSettingsEnvironment(worker));
    for (const key of ['FUNCTIONS_EMULATOR', 'FIREBASE_EMULATOR_HUB', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_CONFIG', 'GCLOUD_PROJECT']) {
      assert.throws(() => assertLocalSettingsEnvironment({ ...discovery, [key]: undefined }));
      assert.throws(() => assertLocalSettingsEnvironment({ ...worker, [key]: undefined }));
    }
  } finally { EmulatorRegistry.listRunningWithInfo = originalList; }
});

test('test routing accepts exact two demo URLs only and always returns fixed loopback endpoint', () => {
  for (const name of ['yumpalsGetPaidCareState', 'yumpalsPurchaseCare']) assert.equal(routePaidCareUrl(`https://us-central1-demo-yumpals-ownership.cloudfunctions.net/${name}`), `http://127.0.0.1:5101/demo-yumpals-ownership/us-central1/${name}`);
  for (const url of ['https://example.com/yumpalsPurchaseCare', 'https://us-central1-demo-yumpals-ownership.cloudfunctions.net/yumpalsPurchaseCare?x=1', 'https://us-central1-demo-yumpals-ownership.cloudfunctions.net/yumpalsGetPaidSettings']) assert.throws(() => routePaidCareUrl(url));
  for (const name of ['yumpalsGetPaidSettings', 'yumpalsUpdatePaidSettings']) assert.equal(routeSettingsUrl(`https://us-central1-demo-yumpals-ownership.cloudfunctions.net/${name}`), `http://127.0.0.1:5101/demo-yumpals-ownership/us-central1/${name}`);
  for (const url of ['https://example.com/yumpalsGetPaidSettings', 'http://us-central1-demo-yumpals-ownership.cloudfunctions.net/yumpalsGetPaidSettings',
    'https://us-central1-demo-yumpals-ownership.cloudfunctions.net/yumpalsGetState', 'https://us-central1-demo-yumpals-ownership.cloudfunctions.net/yumpalsGetPaidSettings?target=live',
    'https://user@us-central1-demo-yumpals-ownership.cloudfunctions.net/yumpalsGetPaidSettings', 'https://us-central1-demo-yumpals-ownership.cloudfunctions.net/a/../yumpalsGetPaidSettings']) assert.throws(() => routeSettingsUrl(url));
});

test('installed EmulatorLog serialization redacts certificate internals/tokens but SDK certificate remains usable', async () => {
  const installed = createRequire(path.join(ROOT, 'functions/package.json'));
  const admin = installed('firebase-admin');
  const { getFirestoreOptions } = installed('./node_modules/firebase-admin/lib/firestore/firestore-internal.js');
  const { EmulatorLog } = require('/usr/local/lib/node_modules/firebase-tools/lib/emulator/types.js');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const credential = admin.credential.cert({ projectId: 'demo-yumpals-ownership', clientEmail: 'synthetic@demo-yumpals-ownership.iam.gserviceaccount.com', privateKey });
  const prototype = Object.getPrototypeOf(credential);
  redactCredentialForLogs(credential);
  credential.getAccessToken = async () => { throw new Error('OAuth forbidden'); };
  credential.authClient = { credentials: { access_token: 'synthetic-access-token' } };
  assert.equal(Object.getPrototypeOf(credential), prototype);
  assert.equal(credential.privateKey === privateKey, true);
  const options = { projectId: 'demo-yumpals-ownership', credential };
  // This is the installed pure options conversion, not SDK app initialization or network.
  const firestoreOptions = getFirestoreOptions({ options }, {});
  assert.equal(firestoreOptions.credentials.private_key === privateKey, true);
  const log = new EmulatorLog('SYSTEM', 'non-default-admin-app-used', '', { appName: 'fixture', opts: options });
  for (const serialized of [log.toString(), log.toPrettyString(), JSON.stringify(options)]) {
    assert.equal(/BEGIN|PRIVATE KEY|privateKey|private_key|serviceAccountPathOrObject|authClient|access_token|synthetic-access-token/.test(serialized), false);
    assert.equal(serialized.includes(privateKey), false);
    assert.ok(serialized.includes('ephemeral-local-certificate-redacted'));
  }
  await assert.rejects(credential.getAccessToken(), /OAuth forbidden/);
});

test('config has all five fixed ports and only verification Functions source; installed SDK resolves without installing', () => {
  const config = JSON.parse(fs.readFileSync(path.join(DIR, 'firebase.ownership.json'), 'utf8'));
  assert.deepEqual(config.functions, { source: 'settings-functions', codebase: 'settings-verification', runtime: 'nodejs22' });
  for (const [name, port] of Object.entries({ functions: 5101, firestore: 8180, auth: 9199, hub: 4401, logging: 4501 })) assert.deepEqual(config.emulators[name], { host: '127.0.0.1', port });
  const expected = fs.realpathSync(path.join(DIR, config.functions.source));
  const pretendTemp = '/tmp/ownership-preboot-test-no-directory-created';
  const relativeSource = path.relative(pretendTemp, expected);
  assert.equal(path.join(pretendTemp, relativeSource), expected);
  const lookup = spawnSync(process.execPath, ['-e', 'process.stdout.write(require.resolve("firebase-functions", {paths:[process.argv[1]]}))', expected], {
    env: { NODE_PATH: path.join(ROOT, 'functions/node_modules') }, encoding: 'utf8',
  });
  assert.equal(lookup.status, 0); assert.ok(lookup.stdout.startsWith(`${fs.realpathSync(path.join(ROOT, 'functions/node_modules/firebase-functions'))}${path.sep}`));
  const entry = fs.readFileSync(path.join(expected, 'index.cjs'), 'utf8');
  assert.ok(entry.indexOf('assertLocalSettingsEnvironment(process.env)') < entry.indexOf("installed('firebase-admin')"));
  assert.equal((entry.match(/exports\./g) || []).length, 12);
});
