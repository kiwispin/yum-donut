const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppWalletAdapter, emailCandidates } = require('../src/yumpals/appWalletAdapter');
const { createPaidCareService } = require('../src/yumpals/paidCareService');
const { setup } = require('./paidCareFixture');
function fixture() {
  const f = setup({ needs: { hunger: 0, happiness: 4, cleanliness: 4, health: 4 } });
  const identities = new Map([['student-a', { uid: 'student-a', disabled: false, email: emailCandidates('Lara')[0], providerData: [{ providerId: 'password' }] }]]);
  const adapter = createAppWalletAdapter({ authAdmin: { getUser: async uid => identities.get(uid) },
    publicProfiles: () => ({ where: (field, op, uid) => { assert.equal(field, 'uid'); assert.equal(op, '=='); return { limit: n => { assert.equal(n, 2); return { queryUid: uid }; } }; } }),
    privateProfile: uid => ({ path: `private/${uid}` }) });
  f.db.seed('public/lara', { uid: 'student-a', name: 'Lara', claimed: true, balance: 17.5, bank_balance: 156, lifetime_given: 137, cosmetics: { keep: true } });
  f.db.seed('private/student-a', { balance: 17.5, bank_balance: 156, progress: { keep: true } });
  const db = { runTransaction: callback => f.db.runTransaction(t => callback({
    get: async ref => {
      if (ref?.queryUid) {
        const docs = [];
        for (const [path, data] of f.db.values) if (path.startsWith('public/') && data.uid === ref.queryUid) {
          const snap = await t.get(path); docs.push({ ...snap, ref: { path } });
        }
        return { docs };
      }
      return t.get(ref?.path || ref);
    }, set: (ref, data) => t.set(ref?.path || ref, data),
  })) };
  return { ...f, adapter, identities, transactionDb: db, service: createPaidCareService({ db, refs: f.refs, walletAdapter: adapter, now: () => Date.parse('2026-09-07T00:00:00Z') }) };
}
test('YumPals app bridge charges both existing mirrors once with no bank/Given/progress migration', async () => {
  const f = fixture(); const first = await f.service.purchase(f.purchaseRequest('meal'));
  assert.equal(first.receipt.amount, 2); assert.equal(f.db.read('public/lara').balance, 15.5);
  assert.equal(f.db.read('private/student-a').balance, 15.5);
  assert.equal(f.db.read('public/lara').bank_balance, 156); assert.equal(f.db.read('public/lara').lifetime_given, 137);
  assert.deepEqual(f.db.read('private/student-a').progress, { keep: true });
  assert.equal(Object.hasOwn(f.db.read('public/lara'), 'ownerUid'), false);
  const after = structuredClone([...f.db.values]); assert.equal((await f.service.purchase(f.purchaseRequest('meal'))).duplicate, true);
  assert.deepEqual([...f.db.values], after);
});
test('real Auth email must agree with exactly one existing claimed UID profile; names never come from purchase input', async () => {
  for (const mutate of [
    f => { f.identities.get('student-a').email = emailCandidates('Lara C')[0]; },
    f => { f.identities.get('student-a').disabled = true; },
    f => { f.identities.get('student-a').providerData = []; },
    f => f.db.values.delete('private/student-a'),
    f => f.db.seed('public/duplicate', f.db.read('public/lara')),
    f => f.db.seed('private/student-a', { balance: 50 }),
    f => f.db.seed('private/student-a', { uid: 'other', balance: 17.5 }),
    f => f.db.seed('private/student-a', { balance: null }),
  ]) {
    const f = fixture(); mutate(f); const before = structuredClone([...f.db.values]);
    await assert.rejects(f.service.purchase(f.purchaseRequest('meal'))); assert.deepEqual([...f.db.values], before);
  }
});
test('bridge preserves missing bank fields rather than inventing savings and rolls back failed pet receipt', async () => {
  const f = fixture(); const pub = f.db.read('public/lara'); delete pub.bank_balance; f.db.seed('public/lara', pub);
  const before = structuredClone([...f.db.values]); f.db.failCommit = true;
  await assert.rejects(f.service.purchase(f.purchaseRequest('meal'))); assert.deepEqual([...f.db.values], before);
  await f.service.purchase(f.purchaseRequest('meal')); assert.equal(Object.hasOwn(f.db.read('public/lara'), 'bank_balance'), false);
  assert.equal(f.db.read('private/student-a').bank_balance, 156);
});
test('bridge accepts existing legacy email and keeps future hashed names distinct', async () => {
  const f = fixture(); f.identities.get('student-a').email = emailCandidates('Lara')[1];
  await f.service.purchase(f.purchaseRequest('meal'));
  assert.notEqual(emailCandidates('Lara')[0], emailCandidates('Lara C')[0]);
  assert.notEqual(emailCandidates('Lara C')[0], emailCandidates('LaraC')[0]);
});
