import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECT_ID = 'demo-yumpals-stage';
const APP_ID = 'yum-donut-school';
const FIREBASE_BIN = process.env.FIREBASE_CLI_BIN || 'firebase';
const PORTS = Object.freeze({
  firestore: 8180,
  auth: 9199,
  functions: 5101,
  hub: 4401,
  logging: 4501,
});
const LOCAL_HOST = '127.0.0.1';
const AUTH_BASE = `http://${LOCAL_HOST}:${PORTS.auth}`;
const FIRESTORE_BASE = `http://${LOCAL_HOST}:${PORTS.firestore}`;
const FUNCTIONS_BASE = `http://${LOCAL_HOST}:${PORTS.functions}/${PROJECT_ID}/us-central1`;
const AUTH_API_KEY = 'yumpals-local-only-key';
const PASSWORD_SUFFIX = 'YumPals-local-verification-2026!';
const REQUIRED_CONFIG_PORTS = Object.freeze({
  auth: PORTS.auth,
  firestore: PORTS.firestore,
  functions: PORTS.functions,
  hub: PORTS.hub,
  logging: PORTS.logging,
});

if (PROJECT_ID !== 'demo-yumpals-stage') {
  throw new Error('The verification project guard was changed unexpectedly.');
}

for (const url of [AUTH_BASE, FIRESTORE_BASE, FUNCTIONS_BASE]) {
  if (!url.startsWith(`http://${LOCAL_HOST}:`)) {
    throw new Error(`Refusing non-local verification endpoint: ${url}`);
  }
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.GCP_PROJECT = PROJECT_ID;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `${LOCAL_HOST}:${PORTS.auth}`;
process.env.FIRESTORE_EMULATOR_HOST = `${LOCAL_HOST}:${PORTS.firestore}`;

const requireFromFunctions = createRequire(path.join(ROOT, 'functions/package.json'));
const admin = requireFromFunctions('firebase-admin');
const requireBaselineConfig = () => path.join(ROOT, 'verification/yumpals/firebase.baseline.json');
const requireCandidateConfig = () => path.join(ROOT, 'firebase.yumpals-emulator.json');

let checks = 0;

function logPass(label, detail = '') {
  checks += 1;
  console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertConfig(configPath) {
  const config = loadJson(configPath);
  for (const [name, port] of Object.entries(REQUIRED_CONFIG_PORTS)) {
    if (config.emulators?.[name]?.port !== port) {
      throw new Error(`Config ${configPath} must bind ${name} to ${port}.`);
    }
  }
  if (config.emulators?.ui?.enabled !== false) {
    throw new Error(`Config ${configPath} must keep the Emulator UI disabled.`);
  }
  if (!['verification/yumpals', '.'].includes(config.functions?.[0]?.source)) {
    throw new Error(`Config ${configPath} must use the isolated YumPals Functions source.`);
  }
  if (!config.firestore?.rules) {
    throw new Error(`Config ${configPath} must select a checked-in rules fixture.`);
  }
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: LOCAL_HOST, port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function assertPortsFree() {
  for (const [name, port] of Object.entries(PORTS)) {
    if (await portOpen(port)) throw new Error(`${name} port ${port} is already listening.`);
  }
}

async function waitForPort(port, child, deadline) {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Firebase emulator process exited before becoming ready.');
    if (await portOpen(port)) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for local emulator port ${port}.`);
}

async function waitForCallableDefinition(child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Firebase emulator process exited before callable discovery.');
    try {
      const response = await fetch(callableUrl('yumpalsGetState'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401 || body?.error?.status === 'UNAUTHENTICATED') return;
    } catch {
      // The Functions emulator can bind its port before the exported callable is loaded.
    }
    await delay(250);
  }
  throw new Error('Timed out waiting for the yumpalsGetState callable definition.');
}

function startEmulators(configPath) {
  assertConfig(configPath);
  const output = [];
  const child = spawn(
    FIREBASE_BIN,
    [
      'emulators:start',
      '--config',
      configPath,
      '--project',
      PROJECT_ID,
      '--only',
      'auth,firestore,functions',
      '--log-verbosity',
      'INFO',
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        GCLOUD_PROJECT: PROJECT_ID,
        GCP_PROJECT: PROJECT_ID,
        FIREBASE_CONFIG: JSON.stringify({ projectId: PROJECT_ID }),
        FIREBASE_AUTH_EMULATOR_HOST: `${LOCAL_HOST}:${PORTS.auth}`,
        FIRESTORE_EMULATOR_HOST: `${LOCAL_HOST}:${PORTS.firestore}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const collect = (chunk) => {
    const lines = String(chunk).split(/\r?\n/u).filter(Boolean);
    output.push(...lines.slice(-30));
    if (output.length > 120) output.splice(0, output.length - 120);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.once('error', (error) => output.push(`process error: ${error.message}`));
  const deadline = Date.now() + 120000;
  const ready = Promise.all(Object.values(PORTS).map((port) => waitForPort(port, child, deadline)));
  return { child, output, ready };
}

async function stopEmulators(running) {
  if (!running?.child || running.child.exitCode !== null) return;
  const exited = new Promise((resolve) => running.child.once('exit', resolve));
  running.child.kill('SIGINT');
  await Promise.race([exited, delay(20000)]);
  if (running.child.exitCode === null) running.child.kill('SIGTERM');
  const deadline = Date.now() + 10000;
  while (running.child.exitCode === null && Date.now() < deadline) await delay(100);
}

async function withEmulators(configPath, work) {
  await assertPortsFree();
  const running = startEmulators(configPath);
  try {
    await running.ready;
    await waitForCallableDefinition(running.child);
    return await work();
  } catch (error) {
    const recent = running.output.filter((line) => !/token|password|secret|credential/iu.test(line)).slice(-12);
    if (recent.length) console.error(`Emulator diagnostics (local process only):\n${recent.join('\n')}`);
    throw error;
  } finally {
    await stopEmulators(running);
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const open = await Promise.all(Object.values(PORTS).map((port) => portOpen(port)));
      if (!open.some(Boolean)) break;
      await delay(100);
    }
  }
}

function authUrl(operation) {
  return `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${AUTH_API_KEY}`;
}

async function authPost(operation, body) {
  const response = await fetch(authUrl(operation), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Local Auth ${operation} failed with HTTP ${response.status}.`);
  if (!json.idToken || !json.localId) throw new Error(`Local Auth ${operation} returned no token/UID.`);
  return { uid: json.localId, token: json.idToken };
}

async function createPasswordUser(label) {
  return authPost('signUp', {
    email: `${label}@yumpals.invalid`,
    password: `${label}-${PASSWORD_SUFFIX}`,
    returnSecureToken: true,
  });
}

async function signInPassword(label) {
  return authPost('signInWithPassword', {
    email: `${label}@yumpals.invalid`,
    password: `${label}-${PASSWORD_SUFFIX}`,
    returnSecureToken: true,
  });
}

async function createAnonymousUser() {
  return authPost('signUp', { returnSecureToken: true });
}

function localAdminServices() {
  if (admin.apps.length === 0) admin.initializeApp({ projectId: PROJECT_ID });
  return { db: admin.firestore(), auth: admin.auth() };
}

function firestoreUrl(documentPath) {
  const encoded = documentPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${FIRESTORE_BASE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${encoded}`;
}

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, firestoreValue(child)])) },
    };
  }
  throw new Error(`Unsupported REST fixture value type: ${typeof value}`);
}

function firestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, firestoreValue(child)]));
}

async function firestoreRest(documentPath, { method = 'GET', token, fields } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (fields) headers['content-type'] = 'application/json';
  const response = await fetch(firestoreUrl(documentPath), {
    method,
    headers,
    body: fields ? JSON.stringify({ fields: firestoreFields(fields) }) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

function callableUrl(name) {
  return `${FUNCTIONS_BASE}/${name}`;
}

async function callCallable(name, token, data = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(callableUrl(name), {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function callableErrorCode(result, fallback = null) {
  return result.body?.error?.status || (result.status === 401 ? 'UNAUTHENTICATED' : fallback);
}

function expectCallableSuccess(label, result) {
  if (!result.body?.result || result.body.result.ok !== true) {
    throw new Error(`${label} did not return a callable success envelope.`);
  }
  logPass(label, `HTTP ${result.status}`);
  return result.body.result;
}

function expectCallableError(label, result, expectedCode) {
  const observed = callableErrorCode(result);
  if (observed !== expectedCode) {
    throw new Error(`${label} expected ${expectedCode}, observed ${observed || `HTTP ${result.status}`}.`);
  }
  logPass(label, observed);
}

function expectRestStatus(label, result, expectedStatus) {
  if (result.status !== expectedStatus) {
    throw new Error(`${label} expected HTTP ${expectedStatus}, observed HTTP ${result.status}.`);
  }
  logPass(label, `HTTP ${result.status}`);
}

function dateKeyForNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function fakeAdminJwt(uid) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      sub: uid,
      user_id: uid,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      firebase: { sign_in_provider: 'password' },
      yumpalsAdmin: true,
    }),
    'forged-local-signature',
  ].join('.');
}

function userStatePath(uid) {
  return `artifacts/${APP_ID}/yumpals/main/users/${uid}`;
}

function userDayPath(uid, dateKey) {
  return `${userStatePath(uid)}/days/${dateKey}`;
}

function userAuditCollection(db, uid) {
  return db.collection('artifacts').doc(APP_ID).collection('yumpals').doc('main')
    .collection('users').doc(uid).collection('audit');
}

async function countAudit(db, uid, type) {
  const snapshot = await userAuditCollection(db, uid).get();
  return snapshot.docs.filter((doc) => doc.data().type === type).length;
}

async function seedLegacyDocuments(db, suffix) {
  await db.doc(`artifacts/${APP_ID}`).set({ fixture: suffix });
  await db.doc(`artifacts/${APP_ID}/legacy/root`).set({ fixture: suffix });
  await db.doc(`artifacts/${APP_ID}/legacy/root/child/leaf`).set({ fixture: suffix });
  await db.doc('legacy/root').set({ fixture: suffix });
}

async function runBaseline() {
  const { db } = localAdminServices();
  const baselineUser = await createPasswordUser('baseline-student');
  const protectedRoot = `artifacts/${APP_ID}/yumpals/main`;
  const nestedLegacy = `artifacts/${APP_ID}/legacy/root`;

  expectRestStatus(
    'baseline authenticated write in YumPals namespace',
    await firestoreRest(protectedRoot, {
      method: 'PATCH',
      token: baselineUser.token,
      fields: { fixture: 'baseline-public-rules' },
    }),
    200,
  );
  expectRestStatus('baseline unauthenticated public read in YumPals namespace', await firestoreRest(protectedRoot), 200);
  expectRestStatus(
    'baseline authenticated write in nested legacy path',
    await firestoreRest(nestedLegacy, {
      method: 'PATCH',
      token: baselineUser.token,
      fields: { fixture: 'baseline-legacy' },
    }),
    200,
  );
  expectRestStatus('baseline unauthenticated public read in nested legacy path', await firestoreRest(nestedLegacy), 200);
  const adminDoc = await db.doc(protectedRoot).get();
  if (!adminDoc.exists) throw new Error('Baseline REST write was not visible to local Admin SDK.');
  logPass('baseline fixture is live in the local Firestore emulator', 'not a security approval');
}

async function runCandidate() {
  const { db, auth } = localAdminServices();
  const teacher = await createPasswordUser('teacher');
  const studentA = await createPasswordUser('student-a');
  const studentB = await createPasswordUser('student-b');
  const corruptUser = await createPasswordUser('corrupt-user');
  const anonymous = await createAnonymousUser();
  await auth.setCustomUserClaims(teacher.uid, { yumpalsAdmin: true });
  const teacherWithClaims = await signInPassword('teacher');
  logPass('teacher claim seeded with emulator Admin SDK only', 'custom claim not written to cloud');

  await seedLegacyDocuments(db, 'candidate');

  expectCallableError('callable missing token rejected', await callCallable('yumpalsGetState'), 'UNAUTHENTICATED');
  expectCallableError('callable anonymous token rejected', await callCallable('yumpalsGetState', anonymous.token), 'UNAUTHENTICATED');
  expectCallableError(
    'callable student cannot forge admin in request data',
    await callCallable('yumpalsUpdateSettings', studentA.token, { enabled: true, yumpalsAdmin: true, uid: teacher.uid }),
    'PERMISSION_DENIED',
  );
  expectCallableError(
    'callable malformed auth token rejected',
    await callCallable('yumpalsUpdateSettings', 'not-a-jwt', { enabled: true }),
    'UNAUTHENTICATED',
  );
  const forgedJwtResult = await callCallable('yumpalsUpdateSettings', fakeAdminJwt(studentA.uid), { enabled: true });
  if (forgedJwtResult.body?.result?.ok === true) {
    logPass('forged JWT behavior recorded as emulator limitation', 'unsigned-token acceptance is not production auth evidence');
  } else {
    const forgedCode = callableErrorCode(forgedJwtResult);
    if (!['UNAUTHENTICATED', 'PERMISSION_DENIED'].includes(forgedCode)) {
      throw new Error(`Forged admin JWT returned unexpected ${forgedCode || `HTTP ${forgedJwtResult.status}`}.`);
    }
    logPass('forged admin JWT behavior recorded by local emulator', forgedCode);
  }
  expectCallableError(
    'callable student cannot update teacher settings',
    await callCallable('yumpalsUpdateSettings', studentA.token, { enabled: true }),
    'PERMISSION_DENIED',
  );

  const enabled = expectCallableSuccess(
    'teacher enables YumPals in local stage',
    await callCallable('yumpalsUpdateSettings', teacherWithClaims.token, {
      enabled: true,
      holidayRest: true,
      growthSpeed: 'standard',
    }),
  );
  if (!enabled.settings.isAdmin || enabled.enabled !== true) throw new Error('Teacher settings response did not reflect the emulator claim.');

  const adoptedA = expectCallableSuccess(
    'UID A adopts same-name pet',
    await callCallable('yumpalsAdopt', studentA.token, {
      species: 'mossbit',
      name: 'Same Name',
      color: '#d94878',
      casing: 'berry',
    }),
  );
  const adoptedB = expectCallableSuccess(
    'UID B adopts same-name pet',
    await callCallable('yumpalsAdopt', studentB.token, {
      species: 'pufflet',
      name: 'Same Name',
      color: '#61c0bf',
      casing: 'mint',
    }),
  );
  if (adoptedA.pet.name !== adoptedB.pet.name || adoptedA.pet.species === adoptedB.pet.species) {
    throw new Error('Same-name pets were not kept as independent UID-owned records.');
  }
  const [stateA, stateB] = await Promise.all([
    db.doc(userStatePath(studentA.uid)).get(),
    db.doc(userStatePath(studentB.uid)).get(),
  ]);
  if (!stateA.exists || !stateB.exists || stateA.data().ownerUid !== studentA.uid || stateB.data().ownerUid !== studentB.uid) {
    throw new Error('UID-owned Admin SDK records were not distinct.');
  }
  logPass('same-name pets remain distinct in Firestore by UID', `${studentA.uid} and ${studentB.uid}`);

  const beforeDate = dateKeyForNow();
  const currentState = expectCallableSuccess('callable returns server Auckland date', await callCallable('yumpalsGetState', studentA.token));
  if (currentState.today.dateKey !== beforeDate) {
    throw new Error(`Server date mismatch: expected local Auckland ${beforeDate}, got ${currentState.today.dateKey}.`);
  }
  logPass('server date is authoritative for current Auckland day', currentState.today.dateKey);

  const [careFeedA, carePatA] = await Promise.all([
    callCallable('yumpalsCare', studentA.token, { action: 'feed', operationId: 'uid-a-feed' }),
    callCallable('yumpalsCare', studentA.token, { action: 'pat', operationId: 'uid-a-pat', dateKey: '2099-12-31' }),
  ]);
  expectCallableSuccess('UID A concurrent feed response', careFeedA);
  expectCallableSuccess('UID A concurrent pat response with spoofed date', carePatA);
  const afterConcurrentA = expectCallableSuccess('UID A state after concurrent care', await callCallable('yumpalsGetState', studentA.token));
  if (afterConcurrentA.today.feed !== true || afterConcurrentA.today.pat !== true || afterConcurrentA.pet.careDays !== 1) {
    throw new Error('Concurrent feed/pat did not converge to one complete care day.');
  }
  if (afterConcurrentA.today.dateKey === '2099-12-31') throw new Error('Client-supplied care date moved server state.');
  if (await countAudit(db, studentA.uid, 'care') !== 2) throw new Error('UID A care audit count was not exactly two.');
  const dayA = await db.doc(userDayPath(studentA.uid, afterConcurrentA.today.dateKey)).get();
  if (!dayA.exists || dayA.data().complete !== true) throw new Error('UID A daily completion was not atomic with care state.');
  logPass('concurrent care is atomic with exactly two UID A audits', 'one day, feed + pat');
  logPass('client date spoof is ignored by callable care', afterConcurrentA.today.dateKey);

  const duplicateResults = await Promise.all([
    callCallable('yumpalsCare', studentB.token, { action: 'feed', operationId: 'uid-b-duplicate' }),
    callCallable('yumpalsCare', studentB.token, { action: 'feed', operationId: 'uid-b-duplicate' }),
  ]);
  const duplicateSuccesses = duplicateResults.map((result, index) => expectCallableSuccess(`UID B duplicate race response ${index + 1}`, result));
  if (duplicateSuccesses.filter((result) => result.duplicate !== true).length !== 1) {
    throw new Error('Duplicate concurrent operation did not have exactly one writer.');
  }
  expectCallableSuccess('UID B second care action', await callCallable('yumpalsCare', studentB.token, {
    action: 'pat',
    operationId: 'uid-b-pat',
  }));
  const afterB = expectCallableSuccess('UID B state after duplicate care', await callCallable('yumpalsGetState', studentB.token));
  if (afterB.pet.careDays !== 1 || await countAudit(db, studentB.uid, 'care') !== 2) {
    throw new Error('Duplicate operation created a second audit or an incorrect care day.');
  }
  logPass('duplicate concurrent care has one write and two total UID B audits', 'feed + pat');

  const beforeDisableDoc = (await db.doc(userStatePath(studentA.uid)).get()).data();
  const beforeDisableAudits = await countAudit(db, studentA.uid, 'care');
  expectCallableSuccess('teacher disables YumPals', await callCallable('yumpalsUpdateSettings', teacherWithClaims.token, { enabled: false }));
  const disabledState = expectCallableSuccess('disabled state remains readable', await callCallable('yumpalsGetState', studentA.token));
  if (disabledState.pet.careDays !== beforeDisableDoc.careDays) throw new Error('Disabling changed the saved pet.');
  expectCallableError('disabled care does not write', await callCallable('yumpalsCare', studentA.token, {
    action: 'feed',
    operationId: 'disabled-write-check',
  }), 'FAILED_PRECONDITION');
  const afterDisableDoc = (await db.doc(userStatePath(studentA.uid)).get()).data();
  if (afterDisableDoc.careDays !== beforeDisableDoc.careDays || await countAudit(db, studentA.uid, 'care') !== beforeDisableAudits) {
    throw new Error('Disabled care changed state or audit count.');
  }
  logPass('disabled setting preserves pets and blocks care writes', 'state and audits unchanged');

  expectCallableSuccess('teacher re-enables YumPals', await callCallable('yumpalsUpdateSettings', teacherWithClaims.token, {
    enabled: true,
    growthSpeed: 'quick',
    holidayRest: false,
  }));
  const studentSettings = expectCallableSuccess('student reads current settings', await callCallable('yumpalsGetState', studentA.token));
  const teacherSettings = expectCallableSuccess('teacher reads current settings', await callCallable('yumpalsGetState', teacherWithClaims.token));
  if (studentSettings.settings.growthSpeed !== 'quick' || studentSettings.settings.isAdmin || !teacherSettings.settings.isAdmin) {
    throw new Error('Settings or teacher admin visibility was incorrect.');
  }
  logPass('settings are readable with correct admin visibility', 'quick growth, non-admin student');

  const corruptPath = userStatePath(corruptUser.uid);
  const corruptState = {
    schemaVersion: 1,
    ownerUid: corruptUser.uid,
    species: 'mossbit',
    name: 'Broken',
    color: '#d94878',
    casing: 'berry',
    reducedMotion: false,
    careDays: -4,
    earnedMilestones: [],
  };
  await db.doc(corruptPath).set(corruptState);
  expectCallableError('corrupted state read fails closed', await callCallable('yumpalsGetState', corruptUser.token), 'DATA_LOSS');
  expectCallableError('corrupted state care fails closed', await callCallable('yumpalsCare', corruptUser.token, {
    action: 'feed',
    operationId: 'corrupt-care',
  }), 'DATA_LOSS');
  expectCallableError('corrupted state profile update fails closed', await callCallable('yumpalsUpdatePet', corruptUser.token, { name: 'Still Broken' }), 'DATA_LOSS');
  const afterCorruption = (await db.doc(corruptPath).get()).data();
  if (JSON.stringify(afterCorruption) !== JSON.stringify(corruptState)) throw new Error('Corrupted state was rewritten.');
  logPass('corrupted persisted state is preserved and fails closed', 'no reset or repair write');

  const protectedPaths = [
    `artifacts/${APP_ID}/yumpals/main`,
    `artifacts/${APP_ID}/yumpals/main/config/settings`,
    `artifacts/${APP_ID}/yumpals/main/config/settings/audit/security-probe`,
    userStatePath(studentA.uid),
  ];
  const principals = [
    ['unauthenticated', undefined],
    ['anonymous', anonymous.token],
    ['student', studentA.token],
  ];
  for (const [principal, token] of principals) {
    for (const protectedPath of protectedPaths) {
      expectRestStatus(`candidate protected read denied: ${principal} ${protectedPath}`, await firestoreRest(protectedPath, { token }), 403);
    }
    expectRestStatus(
      `candidate protected write denied: ${principal}`,
      await firestoreRest(`artifacts/${APP_ID}/yumpals/main/probes/${principal}`, {
        method: 'PATCH',
        token,
        fields: { probe: principal },
      }),
      403,
    );
  }
  logPass('direct Firestore REST access is denied throughout the new namespace', 'unauthenticated, anonymous, student');

  expectRestStatus('candidate public read of artifact root preserved', await firestoreRest(`artifacts/${APP_ID}`), 200);
  expectRestStatus('candidate public read of nested legacy document preserved', await firestoreRest(`artifacts/${APP_ID}/legacy/root`), 200);
  expectRestStatus('candidate public read of nested legacy leaf preserved', await firestoreRest(`artifacts/${APP_ID}/legacy/root/child/leaf`), 200);
  expectRestStatus('candidate public read of non-artifact root preserved', await firestoreRest('legacy/root'), 200);
  expectRestStatus(
    'candidate authenticated write of artifact root preserved',
    await firestoreRest(`artifacts/${APP_ID}`, { method: 'PATCH', token: studentA.token, fields: { fixture: 'student-write' } }),
    200,
  );
  expectRestStatus(
    'candidate authenticated write of nested legacy document preserved',
    await firestoreRest(`artifacts/${APP_ID}/legacy/root`, { method: 'PATCH', token: studentA.token, fields: { fixture: 'student-write' } }),
    200,
  );
  expectRestStatus(
    'candidate authenticated write of non-artifact root preserved',
    await firestoreRest('legacy/root', { method: 'PATCH', token: studentA.token, fields: { fixture: 'student-write' } }),
    200,
  );
  expectRestStatus(
    'candidate unauthenticated write outside protected subtree remains denied',
    await firestoreRest(`artifacts/${APP_ID}/legacy/root`, { method: 'PATCH', fields: { fixture: 'unauth-write' } }),
    403,
  );
  logPass('candidate rules preserve baseline permissions outside protected subtree', 'root docs and nested legacy paths');

  const protectedRead = await firestoreRest(`artifacts/${APP_ID}/yumpals/main`, { token: studentA.token });
  if (protectedRead.status !== 403) throw new Error('Candidate protected namespace was reachable after regression checks.');
  logPass('candidate rules remain enforced after outside-subtree regression checks');
}

async function main() {
  if (process.env.YUMPALS_VERIFICATION_SENTINEL === '1') {
    throw new Error('Deterministic verification sentinel: nonzero exit is expected.');
  }
  if (process.env.YUMPALS_VERIFICATION_SENTINEL === 'cleanup') {
    await withEmulators(requireCandidateConfig(), async () => {
      throw new Error('Deterministic cleanup sentinel after emulator and callable readiness: nonzero exit is expected.');
    });
    throw new Error('Cleanup sentinel unexpectedly completed without propagating its work failure.');
  }
  const startedAt = Date.now();
  console.log(`YumPals local verification project: ${PROJECT_ID}`);
  console.log(`Endpoints: Firestore ${PORTS.firestore}, Auth ${PORTS.auth}, Functions ${PORTS.functions}, hub ${PORTS.hub}, logging ${PORTS.logging}; UI disabled`);
  console.log('No cloud project, production project, live credentials, or deployment target is used.');

  console.log('--- Phase 1: production-rule baseline fixture ---');
  await withEmulators(requireBaselineConfig(), runBaseline);

  console.log('--- Phase 2: candidate scoped rules and callable staging ---');
  await withEmulators(requireCandidateConfig(), runCandidate);

  console.log(`YUMPALS_SECURITY_VERIFICATION_PASS checks=${checks} elapsedMs=${Date.now() - startedAt}`);
}

main().catch((error) => {
  console.error(`YUMPALS_SECURITY_VERIFICATION_FAIL: ${error.message}`);
  process.exitCode = 1;
});
