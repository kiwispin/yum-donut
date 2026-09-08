// Invoked only by the guarded runner after its original 17 checks.
import assert from 'node:assert/strict';
import { createTeacherSettingsController, settingsJournalKey } from '../../src/yumpals/teacherSettingsClient.js';
import { createPaidSettingsTransport } from '../../src/yumpals/paidSettingsTransport.js';

const PROJECT = 'demo-yumpals-ownership';
const ORIGIN = 'http://127.0.0.1:5101';
const AUTH = 'http://127.0.0.1:9199';
const FIRESTORE = 'http://127.0.0.1:8180';
const GET = 'yumpalsGetPaidSettings'; const UPDATE = 'yumpalsUpdatePaidSettings';
const NAMES = new Set([GET, UPDATE, 'testNotReadyGetPaidSettings', 'testNotReadyUpdatePaidSettings']);

export function routeSettingsUrl(url) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, `https://us-central1-${PROJECT}.cloudfunctions.net`, 'Refusing non-fixture origin');
  assert.equal(parsed.search, ''); assert.equal(parsed.hash, ''); assert.equal(parsed.username, ''); assert.equal(parsed.password, '');
  const name = parsed.pathname.slice(1);
  assert.ok([GET, UPDATE].includes(name), 'Refusing unsupported paid Settings route');
  assert.equal(url, `${parsed.origin}/${name}`, 'Refusing non-exact route');
  return `${ORIGIN}/${PROJECT}/us-central1/${name}`;
}

export async function verifySettingsHttp({ db, auth, controlRefs, careRefs, walletRefs, paidOperationId, anonymous, password, localFetch, pass }) {
  const docData = async ref => { const snapshot = await ref.get(); return snapshot.exists ? snapshot.data() : null; };
  const audits = async () => {
    const result = [];
    for (const uid of ['synthetic-a', 'synthetic-teacher']) {
      const collection = controlRefs.receipt(uid, 'placeholder').parent;
      const snapshot = await collection.get();
      result.push(...snapshot.docs.map(doc => [doc.ref.path, doc.data()]));
    }
    return result.sort(([a], [b]) => a.localeCompare(b));
  };
  const controlSnapshot = async () => ({ settings: await docData(controlRefs.settings()), legacy: await docData(controlRefs.legacySettings()), audits: await audits() });
  const protectedRefs = [walletRefs.publicProfile('record-a'), walletRefs.publicProfile('record-b'), walletRefs.privateProfile('synthetic-a'), walletRefs.privateProfile('synthetic-b'),
    careRefs.pet('synthetic-a'), careRefs.pet('synthetic-b'), careRefs.receipt('synthetic-b', paidOperationId), walletRefs.audit('initial')];
  const protectedBefore = await Promise.all(protectedRefs.map(docData));
  assert.ok(protectedBefore[6], 'Core paid receipt must exist before HTTP verification');
  assert.equal(protectedBefore[6].operationId, paidOperationId);
  assert.equal(protectedBefore[6].ownerUid, 'synthetic-b'); assert.equal(protectedBefore[6].status, 'COMMITTED'); assert.equal(protectedBefore[6].amount, 5);
  const legacyBefore = await docData(controlRefs.legacySettings());
  async function signIn(uid) {
    const response = await localFetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-only`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${uid}@example.test`, password, returnSecureToken: true }),
    });
    assert.equal(response.status, 200, 'Synthetic sign-in failed');
    const body = await response.json();
    assert.equal(typeof body.idToken, 'string', 'Missing synthetic ID token');
    return body.idToken;
  }
  async function call(name, data, token) {
    assert.ok(NAMES.has(name));
    const response = await localFetch(`${ORIGIN}/${PROJECT}/us-central1/${name}`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ data }) });
    const body = await response.json();
    return { status: response.status, body };
  }
  const resultOf = response => { assert.equal(response.status, 200); assert.ok(Object.hasOwn(response.body, 'result')); assert.equal(Object.hasOwn(response.body, 'error'), false); return response.body.result; };
  const errorOf = (response, status, code, reason) => {
    assert.equal(response.status, status); assert.equal(response.body.error?.status, code);
    if (reason) assert.equal(response.body.error?.details?.reason, reason);
    assert.equal(Object.hasOwn(response.body, 'result'), false);
  };
  const studentToken = await signIn('synthetic-b');
  await auth.setCustomUserClaims('synthetic-a', { yumpalsAdmin: true });
  await auth.createUser({ uid: 'synthetic-teacher', email: 'synthetic-teacher@example.test', password });
  await auth.setCustomUserClaims('synthetic-teacher', { yumpalsAdmin: true });
  const teacherToken = await signIn('synthetic-a');
  const otherToken = await signIn('synthetic-teacher');
  const initialRequest = { operationId: 'initial', expectedVersion: null, expectedSettingsHash: null, enabled: true };
  const beforeDenials = await controlSnapshot();
  for (const [token, status, code] of [[null, 401, 'UNAUTHENTICATED'], ['malformed-token', 401, 'UNAUTHENTICATED'], [anonymous.idToken, 401, 'UNAUTHENTICATED'], [studentToken, 403, 'PERMISSION_DENIED']]) {
    for (const name of [GET, UPDATE]) errorOf(await call(name, name === GET ? {} : initialRequest, token), status, code);
  }
  for (const extra of [{ role: 'teacher' }, { auth: { uid: 'synthetic-a', token: { yumpalsAdmin: true } } }, { uid: 'synthetic-a', yumpalsAdmin: true }]) {
    errorOf(await call(UPDATE, { ...initialRequest, ...extra }, studentToken), 403, 'PERMISSION_DENIED');
    errorOf(await call(UPDATE, { ...initialRequest, ...extra }, teacherToken), 400, 'INVALID_ARGUMENT', 'INVALID_SETTINGS');
  }
  for (const name of ['testNotReadyGetPaidSettings', 'testNotReadyUpdatePaidSettings']) errorOf(await call(name, name.startsWith('testNotReadyGet') ? {} : initialRequest, teacherToken), 400, 'FAILED_PRECONDITION', 'ROLLOUT_NOT_READY');
  errorOf(await call(GET, false, teacherToken), 400, 'INVALID_ARGUMENT', 'INVALID_SETTINGS');
  assert.deepEqual(await controlSnapshot(), beforeDenials);
  pass('HTTP real emulator tokens enforce teacher claim/readiness/input; all refusals preserve settings/legacy/audits (not signature proof)');

  const get = async token => resultOf(await call(GET, {}, token));
  const updateRequest = (quote, enabled, id) => ({ operationId: id, expectedVersion: quote.version, expectedSettingsHash: quote.settingsHash, enabled });
  const current = await get(teacherToken);
  assert.deepEqual(current.settings, await docData(controlRefs.settings()));
  const offRequest = updateRequest(current, false, 'http-off');
  const off = resultOf(await call(UPDATE, offRequest, teacherToken)); assert.equal(off.enabled, false);
  const freshOff = await get(teacherToken);
  const on = resultOf(await call(UPDATE, updateRequest(freshOff, true, 'http-on'), teacherToken)); assert.equal(on.enabled, true);
  const beforeReplay = await controlSnapshot();
  const historical = resultOf(await call(UPDATE, initialRequest, teacherToken)); assert.equal(historical.duplicate, true);
  assert.deepEqual(historical.receipt, await docData(controlRefs.receipt('synthetic-a', 'initial')));
  assert.deepEqual(await controlSnapshot(), beforeReplay);
  const beforeConflict = await controlSnapshot();
  errorOf(await call(UPDATE, { ...offRequest, operationId: 'http-stale' }, teacherToken), 409, 'ABORTED', 'SETTINGS_CONFLICT');
  assert.deepEqual(await controlSnapshot(), beforeConflict);
  pass('HTTP saved quotes, off/on, original historical receipt replay and definite stale CAS preserve permanent cutover');

  // Real frontend controller -> real pinned transport -> local routed HTTP -> actual callable/service.
  // No fetch ever goes to the external demo URL. All token/body/options remain intact.
  const storageValues = new Map();
  const storage = { getItem: key => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value), removeItem: key => storageValues.delete(key) };
  let submissions = 0; let loseNextSuccess = true; let serial = 0;
  const user = { uid: 'synthetic-a', isAnonymous: false, getIdToken: () => signIn('synthetic-a') };
  const transport = createPaidSettingsTransport({ projectId: PROJECT, enabled: true, getCurrentUser: () => user, fetchImpl: async (url, options) => {
    const localUrl = routeSettingsUrl(url);
    if (url.endsWith(`/${UPDATE}`)) submissions++;
    const response = await localFetch(localUrl, options);
    if (url.endsWith(`/${UPDATE}`) && response.ok && loseNextSuccess) {
      // Consume the actual response before simulating loss, proving the server committed.
      const body = await response.json(); assert.ok(body.result?.receipt); loseNextSuccess = false;
      throw new Error('Intentional HTTP response loss after commit');
    }
    return response;
  } });
  const makeController = () => createTeacherSettingsController({ ownerUid: user.uid, projectId: PROJECT, enabled: true,
    getIdentity: () => ({ uid: user.uid, isAnonymous: false, sandbox: false }), transport, storage, operationId: () => `controller-${++serial}` });
  const controller = makeController(); await controller.start();
  assert.equal(controller.getState().status, 'ready'); controller.setDraft(!controller.getState().quote.enabled);
  const beforeCount = (await audits()).length;
  await controller.save(); assert.equal(controller.getState().pending, true); assert.equal(submissions, 1);
  const key = settingsJournalKey(PROJECT, user.uid); const journal = storage.getItem(key); assert.ok(journal);
  const envelope = JSON.parse(journal);
  assert.deepEqual(Object.keys(envelope).sort(), ['ownerUid', 'projectId', 'request', 'schemaVersion']);
  assert.equal(envelope.schemaVersion, 1); assert.equal(envelope.ownerUid, user.uid); assert.equal(envelope.projectId, PROJECT);
  const pending = envelope.request;
  assert.deepEqual(Object.keys(pending).sort(), ['enabled', 'expectedSettingsHash', 'expectedVersion', 'operationId']);
  assert.equal(/idToken|authorization|token|bearer|password|credential/iu.test(journal), false, 'Journal must contain no credential fields or tokens');
  const originalReceipt = await docData(controlRefs.receipt(user.uid, pending.operationId)); assert.ok(originalReceipt);
  assert.equal((await audits()).length, beforeCount + 1);
  assert.ok(!journal.includes(teacherToken)); assert.ok(!journal.includes('Bearer'));
  const otherCurrent = await get(otherToken);
  resultOf(await call(UPDATE, updateRequest(otherCurrent, !pending.enabled, 'other-after-loss'), otherToken));
  const newer = await get(otherToken); const afterOther = await controlSnapshot();
  controller.dispose(); const remounted = makeController(); await remounted.start();
  assert.equal(submissions, 1); assert.equal(remounted.getState().pending, true);
  await remounted.retry();
  assert.equal(submissions, 2); assert.equal(remounted.getState().pending, false); assert.equal(storage.getItem(key), null);
  assert.equal(remounted.getState().quote.enabled, newer.enabled); assert.equal(remounted.getState().quote.version, newer.version);
  assert.deepEqual(await docData(controlRefs.receipt(user.uid, pending.operationId)), originalReceipt);
  assert.deepEqual(await controlSnapshot(), afterOther);
  assert.equal((await audits()).length, beforeCount + 2);
  pass('full HTTP controller chain recovers committed lost response via same journal/receipt, no auto replay, fresh latest teacher setting');

  // A genuine HTTP409 through the actual transport clears only this controller journal.
  const oldQuote = remounted.getState().quote;
  const secondCurrent = await get(otherToken);
  resultOf(await call(UPDATE, updateRequest(secondCurrent, !secondCurrent.enabled, 'other-before-conflict'), otherToken));
  remounted.setDraft(!oldQuote.enabled); const beforeControllerConflict = await controlSnapshot();
  await remounted.save(); assert.equal(storage.getItem(key), null); assert.equal(remounted.getState().pending, false);
  assert.equal(remounted.getState().quote.version, (await get(otherToken)).version);
  assert.deepEqual(await controlSnapshot(), beforeControllerConflict); remounted.dispose();
  pass('full HTTP controller recognizes definite 409 CAS, clears matching pending and fetches current without new receipt');

  const beforeRest = await controlSnapshot();
  for (const token of [null, anonymous.idToken, studentToken, teacherToken]) {
    for (const ref of [controlRefs.settings(), controlRefs.receipt('synthetic-a', 'initial')]) {
      const url = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${ref.path}`;
      const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
      assert.equal((await localFetch(url, { headers })).status, 403);
      assert.equal((await localFetch(url, { method: 'PATCH', headers, body: JSON.stringify({ fields: { probe: { booleanValue: true } } }) })).status, 403);
    }
  }
  assert.deepEqual(await controlSnapshot(), beforeRest);
  assert.deepEqual(await docData(controlRefs.legacySettings()), legacyBefore);
  for (const [index, ref] of protectedRefs.entries()) assert.deepEqual(await docData(ref), protectedBefore[index]);
  pass('HTTP Settings leave complete wallets/pets/paid receipt/ownership audit untouched; 16 local deny-all REST checks (not production rules)');
}
