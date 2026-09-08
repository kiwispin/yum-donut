import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { emailCandidates } = require('../../functions/src/yumpals/appWalletAdapter');
export async function verifyAppConnection({ db, auth, password, localFetch, pass }) {
  const uid = 'release-learner'; const name = 'Release Learner'; const email = emailCandidates(name)[0];
  await auth.createUser({ uid, email, password });
  const root = 'artifacts/yum-donut-school';
  const publicRef = db.doc(`${root}/public/data/users/${name}`);
  const privateRef = db.doc(`${root}/users/${uid}/profile/data`);
  const petRef = db.doc(`${root}/yumpals/main/users/${uid}`);
  const stamp = new Date('2026-09-01T00:00:00Z');
  await publicRef.set({ uid, claimed: true, name, balance: 17.5, bank_balance: 156, lifetime_given: 137, opaque: { stamp } });
  await privateRef.set({ balance: 17.5, bank_balance: 156, progress: { keep: true } });
  const login = await localFetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-only', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  assert.equal(login.status, 200); const token = (await login.json()).idToken;
  const call = async (endpoint, data, credential = token) => {
    assert.ok(['appCheckPaidRead', 'appCheckPaidPurchase', 'appCheckGameRead', 'appCheckGameChoose'].includes(endpoint));
    const response = await localFetch(`http://127.0.0.1:5101/demo-yumpals-ownership/us-central1/${endpoint}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(credential ? { authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify({ data }),
    });
    return { status: response.status, body: await response.json() };
  };
  const read = await call('appCheckPaidRead', {}); assert.equal(read.status, 200, JSON.stringify(read.body));
  const view = read.body.result; assert.equal(view.wallet.balance, 17.5); assert.equal(view.pet, null); assert.equal(view.enabled, true);
  assert.equal((await petRef.get()).exists, false); assert.equal((await publicRef.get()).data().balance, 17.5);
  assert.equal((await call('appCheckPaidRead', {}, null)).status, 401);
  pass('narrow app binding reads an actual Auth-linked legacy wallet without migration, adoption or charges');
  const request = { operationId: 'release-adopt', action: 'adoption', expectedConfigVersion: view.configVersion, expectedConfigHash: view.configHash,
    adoption: { name: 'Blob', species: 'mossbit', casing: 'berry', color: '#d94878' } };
  const results = await Promise.all([call('appCheckPaidPurchase', request), call('appCheckPaidPurchase', request)]);
  for (const result of results) assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(results.map(r => r.body.result.duplicate).sort(), [false, true]);
  const pub = (await publicRef.get()).data(); const priv = (await privateRef.get()).data();
  assert.equal(pub.balance, 12.5); assert.equal(priv.balance, 12.5); assert.equal(pub.bank_balance, 156); assert.equal(pub.lifetime_given, 137);
  assert.deepEqual(priv.progress, { keep: true }); assert.equal(pub.opaque.stamp.toMillis(), stamp.getTime());
  assert.equal(Object.hasOwn(pub, 'ownerUid'), false);
  const replay = await call('appCheckPaidPurchase', request); assert.equal(replay.body.result.duplicate, true);
  assert.deepEqual((await publicRef.get()).data(), pub); assert.deepEqual((await privateRef.get()).data(), priv);
  pass('narrow app HTTP concurrent adoption charges once and preserves bank, Given and actual SDK values without ownership migration');
  await publicRef.update({ name: 'Different Account' });
  const mismatch = await call('appCheckPaidRead', {}); assert.equal(mismatch.status, 200); assert.equal(mismatch.body.result.wallet.available, false);
  assert.equal(Object.hasOwn(mismatch.body.result.wallet, 'balance'), false);
  await publicRef.update({ name });
  const duplicate = db.doc(`${root}/public/data/users/duplicate-fixture`); await duplicate.set(pub);
  const ambiguous = await call('appCheckPaidRead', {}); assert.equal(ambiguous.body.result.wallet.available, false);
  await duplicate.delete(); // Removes only this explicitly created local synthetic fixture.
  assert.equal((await publicRef.get()).data().balance, 12.5); assert.equal((await privateRef.get()).data().balance, 12.5);
  pass('narrow app Auth-name disagreement and duplicate UID links hide unavailable funds without zeroing or choosing an account');
}
