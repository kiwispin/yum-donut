// Only called after the existing 22 groups by the guarded local runner.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPaidCareController } from '../../src/yumpals/paidCareClient.js';
import { createPaidCareTransport } from '../../src/yumpals/paidCareTransport.js';
const require = createRequire(import.meta.url);
const { createTeacherSettingsService } = require('../../functions/src/yumpals/teacherSettingsService.js');
const { createPaidCareService } = require('../../functions/src/yumpals/paidCareService.js');
const { createUidWalletAdapter } = require('../../functions/src/yumpals/uidWalletAdapter.js');
const PROJECT = 'demo-yumpals-ownership';
const GET = 'yumpalsGetPaidCareState'; const BUY = 'yumpalsPurchaseCare';
export function routePaidCareUrl(url) {
  const prefix = `https://us-central1-${PROJECT}.cloudfunctions.net/`;
  assert.ok([`${prefix}${GET}`, `${prefix}${BUY}`].includes(url), 'Refusing non-exact paid fixture route');
  return `http://127.0.0.1:5101/${PROJECT}/us-central1/${url.slice(prefix.length)}`;
}
export async function verifyPaidCareHttp({ db, controlRefs, careRefs, walletRefs, anonymous, password, localFetch, pass }) {
  const data = async ref => { const s = await ref.get(); return s.exists ? s.data() : null; };
  const adminRequest = { auth: { uid: 'synthetic-a', token: { yumpalsAdmin: true, firebase: { sign_in_provider: 'password' } } }, data: {} };
  // Explicit trusted synthetic setup, not an HTTP authorization assertion.
  const controls = createTeacherSettingsService({ db, refs: controlRefs, now: () => Date.parse('2026-09-16T00:00:00Z') });
  const quote = await controls.getSettings(adminRequest);
  await controls.updateSettings({ ...adminRequest, data: { operationId: 'paid-http-enable', expectedVersion: quote.version, expectedSettingsHash: quote.settingsHash, enabled: true } });
  async function token(uid) {
    const response = await localFetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-only', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${uid}@example.test`, password, returnSecureToken: true }),
    });
    assert.equal(response.status, 200); const body = await response.json(); assert.equal(typeof body.idToken, 'string'); return body.idToken;
  }
  async function call(name, payload, credential) {
    assert.ok([GET, BUY].includes(name));
    const response = await localFetch(`http://127.0.0.1:5101/${PROJECT}/us-central1/${name}`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(credential ? { authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify({ data: payload }) });
    return { status: response.status, body: await response.json() };
  }
  const bToken = await token('synthetic-b');
  const refs = [walletRefs.publicProfile('record-b'), walletRefs.privateProfile('synthetic-b')];
  const before = await Promise.all(refs.map(data));
  // Synthetic SDK/progress extras for projection/preservation checks, not live data.
  await careRefs.pet('synthetic-b').update({ opaqueFixture: before[0].opaque, fixtureProgress: ['keep-http'] });
  const petBefore = await data(careRefs.pet('synthetic-b'));
  const protectedRefs = [...refs, careRefs.pet('synthetic-b'), controlRefs.settings(), controlRefs.legacySettings()];
  const protectedBefore = await Promise.all(protectedRefs.map(data));
  for (const credential of [null, 'malformed-token', anonymous.idToken]) {
    for (const name of [GET, BUY]) assert.equal((await call(name, {}, credential)).status, 401);
  }
  for (const payload of [false, 1, [], { uid: 'synthetic-a' }]) assert.equal((await call(GET, payload, bToken)).status, 400);
  assert.deepEqual(await Promise.all(protectedRefs.map(data)), protectedBefore);
  const view = (await call(GET, {}, bToken)).body.result;
  assert.equal(view.ownerUid, 'synthetic-b'); assert.equal(view.wallet.balance, 25.5);
  assert.equal(view.pet.name, 'Niblet'); assert.equal(view.pet.unknown, undefined);
  assert.equal(view.pet.opaqueFixture, undefined); assert.equal(view.pet.fixtureProgress, undefined);
  assert.deepEqual(await Promise.all(refs.map(data)), before);
  const unmapped = (await call(GET, {}, await token('synthetic-teacher'))).body.result;
  assert.deepEqual(unmapped.wallet, { available: false }); assert.equal(unmapped.pet, null);
  pass('paid HTTP real student auth, strict inputs, safe owner view and unavailable unmapped wallet without auto-charge');
  const buy = (action, operationId, q = view) => ({ action, operationId, expectedConfigVersion: q.configVersion, expectedConfigHash: q.configHash });
  const bedtime = buy('bedtime', 'http-paid-bedtime');
  const response = await call(BUY, bedtime, bToken); assert.equal(response.status, 200);
  assert.equal(response.body.result.outcome.walletAfter, 24.5);
  const original = await data(careRefs.receipt('synthetic-b', bedtime.operationId));
  assert.equal((await call(BUY, bedtime, bToken)).body.result.duplicate, true);
  assert.deepEqual(await data(careRefs.receipt('synthetic-b', bedtime.operationId)), original);
  for (const [index, ref] of refs.entries()) assert.deepEqual(await data(ref), { ...before[index], balance: 24.5 });
  pass('paid HTTP fractional bedtime and immutable same-ID replay preserve complete mirror metadata');
  // Inclusive resume leaves full needs. This is explicit synthetic setup to try
  // a beneficial meal, not evidence of elapsed/offline deterioration.
  await careRefs.pet('synthetic-b').update({ 'paidCare.needs.hunger': 2 });
  const entries = new Map(); let updates = 0; let drop = true; let animations = 0;
  const user = { uid: 'synthetic-b', isAnonymous: false, getIdToken: () => token('synthetic-b') };
  const transport = createPaidCareTransport({ projectId: PROJECT, enabled: true, getCurrentUser: () => user,
    fetchImpl: async (url, options) => {
      const routed = routePaidCareUrl(url); if (url.endsWith(BUY)) updates++;
      const response = await localFetch(routed, options);
      if (drop && url.endsWith(BUY) && response.ok) { drop = false; const body = await response.json(); assert.equal(body.result.outcome.status, 'COMMITTED'); throw new Error('Intentional lost paid response'); }
      return response;
    } });
  const options = { ownerUid: user.uid, projectId: PROJECT, enabled: true, getIdentity: () => ({ uid: user.uid, isAnonymous: false, sandbox: false }),
    transport, storage: { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) },
    operationId: () => 'http-paid-lost', onConfirmed: () => { animations++; } };
  let controller = createPaidCareController(options); await controller.start(); controller.prepare('meal'); await controller.confirm();
  assert.equal(controller.getState().pending, true);
  const journal = JSON.parse([...entries.values()][0]);
  assert.deepEqual(Object.keys(journal).sort(), ['ownerUid', 'projectId', 'quotedCost', 'request', 'schemaVersion']);
  assert.equal(journal.quotedCost, 2); assert.equal(/token|authorization|password/iu.test(JSON.stringify(journal)), false);
  const receipt = await data(careRefs.receipt(user.uid, 'http-paid-lost')); assert.equal(receipt.amount, 2);
  await db.runTransaction(async t => { const wallets = await Promise.all(refs.map(ref => t.get(ref))); refs.forEach((ref, index) => t.update(ref, { balance: wallets[index].data().balance + 3 })); });
  controller.dispose(); controller = createPaidCareController(options); await controller.start(); assert.equal(updates, 1);
  await controller.retry(); assert.equal(updates, 2); assert.equal(controller.getState().pending, false);
  assert.equal(controller.getState().quote.wallet.balance, 25.5); assert.equal(animations, 0);
  assert.deepEqual(await data(careRefs.receipt(user.uid, 'http-paid-lost')), receipt);
  for (const [index, ref] of refs.entries()) assert.deepEqual(await data(ref), { ...before[index], balance: 25.5 });
  pass('paid HTTP actual pinned controller retains lost purchase, replays once after gift and refreshes latest wallet without celebration');
  const full = await data(careRefs.pet(user.uid));
  // Synthetic state setup only, to make the refusal then eligibility change explicit.
  await careRefs.pet(user.uid).update({ 'paidCare.needs.hunger': 4 });
  const refusedRequest = buy('meal', 'http-paid-refused');
  const refused = (await call(BUY, refusedRequest, bToken)).body.result;
  assert.equal(refused.outcome.status, 'REFUSED'); assert.equal(refused.outcome.reason, 'NO_EFFECT');
  const audit = await data(careRefs.refusal(user.uid, refusedRequest.operationId));
  await careRefs.pet(user.uid).update({ 'paidCare.needs.hunger': 0 });
  assert.equal((await call(BUY, refusedRequest, bToken)).body.result.duplicate, true);
  assert.deepEqual(await data(careRefs.refusal(user.uid, refusedRequest.operationId)), audit);
  assert.equal(await data(careRefs.receipt(user.uid, refusedRequest.operationId)), null);
  assert.equal((await data(careRefs.pet(user.uid))).paidCare.needs.hunger, 0);
  assert.equal((await data(refs[0])).balance, 25.5);
  assert.deepEqual((await data(careRefs.pet(user.uid))).earnedMilestones, full.earnedMilestones);
  const petFinal = await data(careRefs.pet(user.uid));
  for (const key of Object.keys(petBefore).filter(key => key !== 'paidCare')) assert.deepEqual(petFinal[key], petBefore[key]);
  controller.dispose();
  pass('paid HTTP immutable terminal no-effect refusal prevents later same-ID charge after changed needs');
  // Internal synthetic auth and injected ABORTED, not an HTTP test hook. This
  // exercises actual SDK callback retries after a real protected adapter read.
  for (const method of ['getHandheldState', 'purchase']) {
    const actual = createUidWalletAdapter({ refs: walletRefs }); let attempts = 0; const rawAttempts = []; const facades = [];
    const retryDb = { runTransaction: cb => db.runTransaction(raw => { rawAttempts.push(raw); return cb(raw); }) };
    const walletAdapter = { debit: actual.debit, read: async (t, uid) => {
      facades.push(t); const wallet = await actual.read(t, uid); attempts++;
      if (attempts === 1) throw Object.assign(new Error('Intentional synthetic retry after wallet read'), { code: 10 });
      return wallet;
    } };
    const service = createPaidCareService({ db: retryDb, refs: careRefs, walletAdapter, now: () => Date.parse('2026-09-16T00:00:00Z') });
    const result = await service[method]({ auth: { uid: user.uid, token: { firebase: { sign_in_provider: 'password' } } },
      data: method === 'purchase' ? buy('snack', 'sdk-retry-snack') : {} });
    assert.equal(attempts, 2); assert.equal(rawAttempts[0], rawAttempts[1]); assert.notEqual(facades[0], facades[1]);
    assert.equal(method === 'purchase' ? result.receipt.walletAfter : result.wallet.balance, method === 'purchase' ? 24.5 : 25.5);
  }
  pass('real SDK reused-transaction ABORTED retries succeed through attempt-scoped view and purchase adapter facades');
}
