// Synthetic Auth + Firestore only. No Functions emulator, callable export or live credentials.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const PROJECT = 'demo-yumpals-ownership';
const HOST = '127.0.0.1';
const PORTS = { firestore: 8180, auth: 9199, hub: 4401, logging: 4501 };
const JAVA_HOME = '/tmp/yumpals-java.aAqx58/jdk-21.0.12.1+1-jre/Contents/Home';
const CLI = '/usr/local/bin/firebase';
const AUTH = `http://${HOST}:${PORTS.auth}`;
const FIRESTORE = `http://${HOST}:${PORTS.firestore}`;
let checks = 0;
let interrupted = false;
let child;
let exited = false;
let spawnError;
const output = [];

function guard() {
  assert.equal(PROJECT, 'demo-yumpals-ownership');
  assert.ok(PROJECT.startsWith('demo-'));
  for (const key of ['GCLOUD_PROJECT', 'GCP_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    if (process.env[key]) assert.equal(process.env[key], PROJECT, `Refusing conflicting ${key}`);
  }
  for (const [key, endpoint] of Object.entries({ FIRESTORE_EMULATOR_HOST: `${HOST}:${PORTS.firestore}`, FIREBASE_AUTH_EMULATOR_HOST: `${HOST}:${PORTS.auth}` })) {
    if (process.env[key]) assert.equal(process.env[key], endpoint, `Refusing non-local or unexpected ${key}`);
    process.env[key] = endpoint;
  }
  for (const base of [AUTH, FIRESTORE]) { const u = new URL(base); assert.equal(u.hostname, HOST); assert.equal(u.protocol, 'http:'); }
  process.env.GCLOUD_PROJECT = PROJECT;
  process.env.GCP_PROJECT = PROJECT;
}
function pass(label) { assert.equal(interrupted, false, 'Interrupted'); checks += 1; console.log(`PASS ${label}`); }
async function localFetch(url, options) {
  assert.ok([AUTH, FIRESTORE].includes(new URL(url).origin), 'Refusing non-loopback request');
  return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
}
function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port });
    const finish = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(300, () => finish(false)); socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
  });
}
function signalGroup(signal) {
  if (!child?.pid) return;
  try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
async function cleanup() {
  if (!child) return;
  for (const [signal, timeout] of [['SIGINT', 20000], ['SIGTERM', 5000], ['SIGKILL', 5000]]) {
    signalGroup(signal);
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const ports = await Promise.all(Object.values(PORTS).map(portOpen));
      if (exited && !ports.some(Boolean)) { console.log('OWNERSHIP_EMULATOR_CLEANUP_PASS'); return; }
      await delay(200);
    }
  }
  throw new Error('Owned emulator processes or ports did not shut down');
}

async function verify() {
  const require = createRequire(path.join(ROOT, 'functions/package.json'));
  const admin = require('firebase-admin');
  const { createOwnershipBootstrap, snapshotFingerprint, manifestFingerprint } = require('./src/yumpals/ownershipBootstrap');
  const { createUidWalletAdapter } = require('./src/yumpals/uidWalletAdapter');
  const { createPaidCareService } = require('./src/yumpals/paidCareService');
  const { createTeacherSettingsService } = require('./src/yumpals/teacherSettingsService');
  const { createYumPalsHandlers } = require('./src/yumpals/callables');
  const { yumPalsSettingsDoc } = require('./src/yumpals/paths');
  // Recheck immediately before SDK initialization. No ADC or real service account:
  // this ephemeral certificate exists only in memory and is never logged/saved.
  guard();
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const credential = admin.credential.cert({ projectId: PROJECT,
    clientEmail: `synthetic-emulator@${PROJECT}.iam.gserviceaccount.com`, privateKey });
  // Emulator clients must not request OAuth tokens, even if their configuration regresses.
  credential.getAccessToken = async () => { throw new Error('Refusing OAuth token request in emulator verification'); };
  const app = admin.initializeApp({ projectId: PROJECT, credential }, 'ownership-verification');
  let db;
  try {
    db = app.firestore();
    const auth = app.auth();
    const manifests = new Map();
    const refs = { publicProfile: (id) => db.doc(`ownershipFixture/main/public/${id}`), privateProfile: (uid) => db.doc(`ownershipFixture/main/private/${uid}`),
      mapping: (uid) => db.doc(`ownershipFixture/main/mappings/${uid}`), reverse: (id) => db.doc(`ownershipFixture/main/reverse/${id}`), audit: (id) => db.doc(`ownershipFixture/main/reviews/${id}`) };
    const service = createOwnershipBootstrap({ db, authAdmin: auth, refs, loadApprovedManifest: async (id) => manifests.get(id) });
    const password = 'Synthetic-local-only-2026!';
    for (const uid of ['synthetic-a', 'synthetic-b', 'synthetic-disabled']) {
      await auth.createUser({ uid, email: `${uid}@example.test`, password, disabled: uid === 'synthetic-disabled' });
    }
    const anonResponse = await localFetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-only`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
    });
    assert.equal(anonResponse.status, 200); const anonymous = await anonResponse.json();
    const opaque = { stamp: admin.firestore.Timestamp.fromMillis(123456), point: new admin.firestore.GeoPoint(-36, 174), ref: db.doc('ownershipFixture/main') };
    async function seed(uid, record, balance = 30) {
      await refs.publicProfile(record).set({ name: 'Same Name', uid, claimed: true, balance, bank_balance: 100.5, lifetime_given: 9, lifetime_received: 50, opaque });
      await refs.privateProfile(uid).set({ name: 'Same Name', balance, bank_balance: 100.5, given_today: 2, progress: ['keep'], opaque });
    }
    await seed('synthetic-a', 'record-a'); await seed('synthetic-b', 'record-b', 30.5);
    async function approve(reviewId, entries) {
      const reviewed = [];
      for (const [uid, publicProfileId] of entries) reviewed.push({ uid, publicProfileId,
        expectedPublicHash: snapshotFingerprint((await refs.publicProfile(publicProfileId).get()).data()),
        expectedPrivateHash: snapshotFingerprint((await refs.privateProfile(uid).get()).data()) });
      const manifest = { schemaVersion: 1, reviewId, approval: { operatorUid: 'synthetic-reviewer', source: 'synthetic local harness approval ONLY', approvedAtMs: 1000, decision: 'approved' }, entries: reviewed };
      manifests.set(reviewId, { manifest, approvedDigest: manifestFingerprint(manifest) }); return manifest;
    }
    await approve('initial', [['synthetic-a', 'record-a'], ['synthetic-b', 'record-b']]);
    assert.equal((await service.dryRun('initial')).ok, true);
    assert.equal((await refs.mapping('synthetic-a').get()).exists, false); pass('real Auth eligibility and dry-run without writes');
    const originalProfiles = await Promise.all(['a', 'b'].flatMap((suffix) => [refs.publicProfile(`record-${suffix}`), refs.privateProfile(`synthetic-${suffix}`)]).map(async (ref) => ({ ref, data: (await ref.get()).data() })));
    // These wrappers stage real Firestore writes, then abort the actual transaction.
    // They are financial rollback checks, separate from the process-cleanup sentinel.
    for (const failAfter of [1, 3]) {
      let staged = 0;
      const abortingDb = { runTransaction: (callback) => db.runTransaction((transaction) => {
        const wrapper = { get: (ref) => transaction.get(ref) };
        for (const method of ['update', 'set']) wrapper[method] = (...args) => {
          transaction[method](...args);
          staged += 1;
          if (staged === failAfter) throw new Error('OWNERSHIP_STAGED_ABORT');
          return wrapper;
        };
        return callback(wrapper);
      }) };
      const abortingService = createOwnershipBootstrap({ db: abortingDb, authAdmin: auth, refs, loadApprovedManifest: async (id) => manifests.get(id) });
      await assert.rejects(abortingService.apply('initial'), /OWNERSHIP_STAGED_ABORT/);
      assert.equal(staged, failAfter);
      for (const { ref, data } of originalProfiles) assert.deepEqual((await ref.get()).data(), data);
      for (const ref of [refs.mapping('synthetic-a'), refs.mapping('synthetic-b'), refs.reverse('record-a'), refs.reverse('record-b'), refs.audit('initial')]) assert.equal((await ref.get()).exists, false);
      pass(`real ownership transaction abort after ${failAfter} staged writes preserves profiles and absent mappings/audit`);
    }
    const applications = await Promise.all([service.apply('initial'), service.apply('initial')]);
    assert.equal(applications.filter((r) => !r.duplicate).length, 1);
    assert.equal((await refs.mapping('synthetic-b').get()).data().publicProfileId, 'record-b'); pass('same-name distinct mappings and concurrent review replay');
    const privateAfter = (await refs.privateProfile('synthetic-a').get()).data();
    assert.ok(privateAfter.opaque.stamp.isEqual(opaque.stamp)); assert.ok(privateAfter.opaque.point.isEqual(opaque.point));
    assert.ok(privateAfter.opaque.ref.isEqual(opaque.ref)); assert.deepEqual(privateAfter.progress, ['keep']); pass('actual SDK values and progress preserved');
    const auditBefore = (await refs.audit('initial').get()).data();
    const adapter = createUidWalletAdapter({ refs });
    const debitRefs = [refs.publicProfile('record-a'), refs.privateProfile('synthetic-a')];
    const beforeAbortedDebit = await Promise.all(debitRefs.map(async (ref) => (await ref.get()).data()));
    await assert.rejects(db.runTransaction(async (t) => {
      const wallet = await adapter.read(t, 'synthetic-a');
      await adapter.debit(t, wallet, 2);
      throw new Error('ADAPTER_STAGED_ABORT');
    }), /ADAPTER_STAGED_ABORT/);
    for (const [index, ref] of debitRefs.entries()) assert.deepEqual((await ref.get()).data(), beforeAbortedDebit[index]);
    assert.deepEqual((await refs.audit('initial').get()).data(), auditBefore);
    pass('real adapter staged-debit abort preserves both complete profiles and ownership audit');
    await db.runTransaction(async (t) => { const wallet = await adapter.read(t, 'synthetic-a'); await adapter.debit(t, wallet, 2); });
    for (const ref of [refs.publicProfile('record-a'), refs.privateProfile('synthetic-a')]) {
      const data = (await ref.get()).data(); assert.equal(data.balance, 28); assert.equal(data.bank_balance, 100.5); assert.ok(data.opaque.stamp.isEqual(opaque.stamp));
    }
    assert.deepEqual((await refs.audit('initial').get()).data(), auditBefore);
    assert.equal((await service.apply('initial')).duplicate, true); pass('real adapter atomic mirror debit preserves audit and replay');
    const careRefs = { config: () => db.doc('ownershipFixture/main/careConfigs/global'),
      pet: (uid) => db.doc(`ownershipFixture/main/pets/${uid}`),
      receipt: (uid, id) => db.doc(`ownershipFixture/main/paidReceipts/${uid}_${id}`),
      migration: (uid) => db.doc(`ownershipFixture/main/migrations/${uid}`) };
    let controlNow = Date.parse('2026-09-07T00:00:00Z');
    const controlRefs = { settings: careRefs.config, legacySettings: () => yumPalsSettingsDoc(db),
      receipt: (uid, id) => db.doc(`ownershipFixture/main/controlReceipts/${uid}_${id}`) };
    const legacySettings = { enabled: true, opaque, custom: ['preserve'] };
    await controlRefs.legacySettings().set(legacySettings);
    // Synthetic internal teacher claim, not deployed callable verification.
    const teacherAuth = { uid: 'synthetic-a', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'password' } } };
    const controls = createTeacherSettingsService({ db, refs: controlRefs, now: () => controlNow });
    const initialControls = { auth: teacherAuth, data: { operationId: 'initial', expectedVersion: null, expectedSettingsHash: null, enabled: true } };
    const abortControlsDb = { runTransaction: cb => db.runTransaction(async t => { await cb(t); throw new Error('SETTINGS_STAGED_ABORT'); }) };
    await assert.rejects(createTeacherSettingsService({ db: abortControlsDb, refs: controlRefs, now: () => controlNow }).updateSettings(initialControls), /SETTINGS_STAGED_ABORT/);
    assert.deepEqual((await controlRefs.legacySettings().get()).data(), legacySettings);
    assert.equal((await careRefs.config().get()).exists, false);
    assert.equal((await controlRefs.receipt('synthetic-a', 'initial').get()).exists, false);
    pass('real initial settings cutover abort preserves legacy SDK fields and absent config/receipt');
    await controls.updateSettings(initialControls);
    const closedLegacy = (await controlRefs.legacySettings().get()).data();
    assert.deepEqual(closedLegacy, { ...legacySettings, enabled: false, paidCareControl: { schemaVersion: 1, mode: 'paid', settingsPath: careRefs.config().path } });
    class LocalHttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
    const oldHandlers = createYumPalsHandlers({ db, FieldValue: admin.firestore.FieldValue, HttpsError: LocalHttpsError, now: () => controlNow });
    await assert.rejects(oldHandlers.getState({ auth: teacherAuth, data: {} }), { code: 'failed-precondition' });
    await assert.rejects(oldHandlers.adopt({ auth: teacherAuth, data: { name: 'Blocked', species: 'mossbit', casing: 'berry', color: '#d94878' } }), { code: 'failed-precondition' });
    await assert.rejects(oldHandlers.updateSettings({ auth: teacherAuth, data: { enabled: true } }), { code: 'failed-precondition' });
    assert.deepEqual((await controlRefs.legacySettings().get()).data(), closedLegacy);
    pass('real permanent cutover marker preserves fields and old read/adopt/settings handlers refuse');
    const careOptions = { refs: careRefs, walletAdapter: adapter, now: () => controlNow };
    const careService = createPaidCareService({ ...careOptions, db });
    const careAuth = { uid: 'synthetic-b', token: { firebase: { sign_in_provider: 'password' } } };
    const quote = await careService.getState({ auth: careAuth, data: {} });
    // Injected internal auth context, NOT deployed callable/token verification.
    // Real Auth eligibility was checked separately during ownership application.
    const purchase = { auth: careAuth, data: {
      action: 'adoption', operationId: 'fractional-adoption', expectedConfigVersion: quote.configVersion, expectedConfigHash: quote.configHash,
      adoption: { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878' },
    } };
    const fractionalRefs = [refs.publicProfile('record-b'), refs.privateProfile('synthetic-b')];
    const fractionalBefore = await Promise.all(fractionalRefs.map(async (ref) => (await ref.get()).data()));
    const abortDb = { runTransaction: (callback) => db.runTransaction(async (transaction) => {
      await callback(transaction); // Real mirror, pet and receipt writes have all been staged.
      throw new Error('PAID_SERVICE_STAGED_ABORT');
    }) };
    await assert.rejects(createPaidCareService({ ...careOptions, db: abortDb }).purchase(purchase), /PAID_SERVICE_STAGED_ABORT/);
    for (const [index, ref] of fractionalRefs.entries()) assert.deepEqual((await ref.get()).data(), fractionalBefore[index]);
    assert.equal((await careRefs.pet('synthetic-b').get()).exists, false);
    assert.equal((await careRefs.receipt('synthetic-b', purchase.data.operationId).get()).exists, false);
    pass('real fractional paid-service abort rolls back mirrors, new pet and receipt');
    const paid = await careService.purchase(purchase);
    const petAfter = (await careRefs.pet('synthetic-b').get()).data();
    assert.equal(paid.receipt.walletBefore, 30.5); assert.equal(paid.receipt.walletAfter, 25.5); assert.equal(paid.receipt.amount, 5);
    assert.deepEqual(petAfter.paidCare.needs, { hunger: 4, happiness: 4, cleanliness: 4, health: 4 });
    const duplicatePaid = await careService.purchase(purchase);
    assert.equal(duplicatePaid.duplicate, true); assert.deepEqual(duplicatePaid.receipt, paid.receipt);
    assert.deepEqual((await careRefs.pet('synthetic-b').get()).data(), petAfter);
    assert.deepEqual((await careRefs.receipt('synthetic-b', purchase.data.operationId).get()).data(), paid.receipt);
    for (const [index, ref] of fractionalRefs.entries()) assert.deepEqual((await ref.get()).data(), { ...fractionalBefore[index], balance: 25.5 });
    assert.deepEqual((await refs.audit('initial').get()).data(), auditBefore);
    pass('real fractional ownership-to-paid-service adoption and replay charge once, preserve savings/Given/SDK data');
    const setEnabled = async (enabled, operationId) => {
      const current = await controls.getSettings({ auth: teacherAuth, data: {} });
      return controls.updateSettings({ auth: teacherAuth, data: { operationId, expectedVersion: current.version, expectedSettingsHash: current.settingsHash, enabled } });
    };
    await setEnabled(false, 'off');
    controlNow = Date.parse('2026-09-14T00:00:00Z');
    const disabledQuote = await careService.getState({ auth: careAuth, data: {} });
    assert.deepEqual((await careRefs.pet('synthetic-b').get()).data(), petAfter);
    await assert.rejects(careService.purchase({ auth: careAuth, data: { operationId: 'blocked', action: 'pat', expectedConfigVersion: disabledQuote.configVersion, expectedConfigHash: disabledQuote.configHash } }), { code: 'DISABLED' });
    assert.equal((await careRefs.receipt('synthetic-b', 'blocked').get()).exists, false);
    for (const [index, ref] of fractionalRefs.entries()) assert.deepEqual((await ref.get()).data(), { ...fractionalBefore[index], balance: 25.5 });
    await setEnabled(true, 'on');
    const awake = await careService.getState({ auth: careAuth, data: {} });
    assert.deepEqual(awake.pet.paidCare.needs, petAfter.paidCare.needs);
    assert.equal(awake.pet.paidCare.checkpoint, '2026-09-13'); assert.ok(awake.pet.paidCare.pauseHistoryHash);
    assert.deepEqual((await controlRefs.legacySettings().get()).data(), closedLegacy);
    assert.equal((await controls.updateSettings(initialControls)).duplicate, true);
    assert.equal((await careService.purchase(purchase)).duplicate, true);
    pass('real global settings disable blocks charges and pet-state writes on reads, inclusive resume prevents catchup; original receipts replay');
    await approve('drift', [['synthetic-a', 'record-a']]);
    await refs.publicProfile('record-a').update({ balance: 27 }); await refs.privateProfile('synthetic-a').update({ balance: 27 });
    assert.equal((await service.dryRun('drift')).ok, false); await assert.rejects(service.apply('drift')); pass('reviewed financial drift refuses without rewriting');
    await approve('wrong-uid', [['synthetic-b', 'record-a']]);
    assert.equal((await service.dryRun('wrong-uid')).ok, false); pass('approved but incompatible existing UID refused');
    for (const [reviewId, entries] of [['duplicate-uid', [['synthetic-a', 'record-a'], ['synthetic-a', 'record-b']]], ['duplicate-public', [['synthetic-a', 'record-a'], ['synthetic-b', 'record-a']]]]) {
      await approve(reviewId, entries); await assert.rejects(service.apply(reviewId));
    }
    pass('duplicate UID and public record manifests refused');
    for (const [uid, record] of [['synthetic-disabled', 'disabled'], [anonymous.localId, 'anonymous'], ['synthetic-missing', 'missing']]) {
      await seed(uid, record); await approve(record, [[uid, record]]);
      assert.equal((await service.dryRun(record)).ok, false); await assert.rejects(service.apply(record));
    }
    pass('real disabled, anonymous and missing Auth identities refused');
    const login = await localFetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-only`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'synthetic-a@example.test', password, returnSecureToken: true }),
    });
    assert.equal(login.status, 200); const { idToken } = await login.json();
    for (const token of [null, anonymous.idToken, idToken]) {
      const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
      const url = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/ownershipFixture/main/mappings/synthetic-a`;
      assert.equal((await localFetch(url, { headers })).status, 403);
      assert.equal((await localFetch(url, { method: 'PATCH', headers, body: JSON.stringify({ fields: { probe: { booleanValue: true } } }) })).status, 403);
    }
    pass('local deny-all rules reject unauthenticated, anonymous and signed-in REST access (NOT production rules)');
  } finally {
    try { if (db) await db.terminate(); }
    finally { await app.delete(); }
  }
}

async function main() {
  guard();
  const config = JSON.parse(fs.readFileSync(path.join(DIR, 'firebase.ownership.json'), 'utf8'));
  assert.equal(config.functions, undefined);
  for (const [key, port] of Object.entries(PORTS)) { assert.equal(config.emulators[key].host, HOST); assert.equal(config.emulators[key].port, port); assert.equal(await portOpen(port), false, `${port} must be free`); }
  assert.equal(config.emulators.ui.enabled, false); assert.equal(config.firestore.rules, 'ownership.firestore.rules');
  fs.accessSync(path.join(JAVA_HOME, 'bin/java')); fs.accessSync(CLI);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yumpals-ownership-verification-'));
  fs.writeFileSync(path.join(temp, 'firebase.json'), JSON.stringify(config));
  fs.copyFileSync(path.join(DIR, 'ownership.firestore.rules'), path.join(temp, config.firestore.rules));
  const onSignal = () => { interrupted = true; signalGroup('SIGINT'); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  const startedAt = Date.now();
  try {
    // Deliberately do not inherit credentials/tokens. XDG config is isolated.
    child = spawn(CLI, ['emulators:start', '--config', path.join(temp, 'firebase.json'), '--project', PROJECT, '--only', 'auth,firestore'], {
      cwd: temp, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
        PATH: `${path.dirname(process.execPath)}:${JAVA_HOME}/bin:/usr/local/bin:/usr/bin:/bin`, JAVA_HOME,
        TMPDIR: temp, XDG_CONFIG_HOME: path.join(temp, 'config'), CI: 'true', FIREBASE_CLI_DISABLE_TELEMETRY: '1',
        GCLOUD_PROJECT: PROJECT, GCP_PROJECT: PROJECT, FIREBASE_CONFIG: JSON.stringify({ projectId: PROJECT }),
        FIRESTORE_EMULATOR_HOST: `${HOST}:${PORTS.firestore}`, FIREBASE_AUTH_EMULATOR_HOST: `${HOST}:${PORTS.auth}`,
      },
    });
    child.once('exit', () => { exited = true; }); child.once('error', (error) => { spawnError = error; exited = true; });
    const collect = (chunk) => { output.push(String(chunk)); if (output.length > 50) output.shift(); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const deadline = Date.now() + 120000;
    while (true) {
      if (spawnError) throw spawnError;
      assert.equal(exited || interrupted, false, 'Emulators exited/interrupted before readiness');
      if ((await Promise.all(Object.values(PORTS).map(portOpen))).every(Boolean) && output.join('').includes('All emulators ready')) break;
      assert.ok(Date.now() < deadline, 'Emulator readiness timeout'); await delay(250);
    }
    if (process.env.YUMPALS_OWNERSHIP_SENTINEL === 'cleanup') throw new Error('Intentional cleanup sentinel after readiness');
    await verify();
    assert.equal(interrupted, false);
  } finally {
    await cleanup(); process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    console.log(`Local emulator logs retained: ${temp}`);
  }
  console.log(`OWNERSHIP_VERIFICATION_PASS checks=${checks} elapsedMs=${Date.now() - startedAt}`);
}
main().catch((error) => { console.error(`OWNERSHIP_VERIFICATION_FAIL: ${error.message}`); process.exitCode = 1; });
