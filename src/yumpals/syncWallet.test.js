import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { synchronizePetWallet } from './syncWallet.js';
const { FakeDb } = createRequire(import.meta.url)('../../functions/test/paidCareFixture');
test('paid-pet synchronization retries a concurrent debit rather than restoring an old public event', async () => {
  const db = new FakeDb(); db.seed('public', { uid: 'a', claimed: true, balance: 17 }); db.seed('private', { balance: 16, given: 137 });
  let release; let seen; const entered = new Promise(r => { seen = r; }); let first = true;
  const pending = db.runTransaction(t => synchronizePetWallet({ ...t, get: async ref => {
    const result = await t.get(ref);
    if (ref === 'private' && first) { first = false; seen(); await new Promise(r => { release = r; }); }
    return result;
  } }, { publicRef: 'public', privateRef: 'private', uid: 'a', isActive: () => true }));
  await entered;
  await db.runTransaction(async t => {
    const p = (await t.get('public')).data(); const q = (await t.get('private')).data();
    t.set('public', { ...p, balance: 15 }); t.set('private', { ...q, balance: 15 });
  });
  release(); await pending; assert.equal(db.read('private').balance, 15); assert.equal(db.read('private').given, 137); assert.ok(db.conflicts > 0);
});
test('pet synchronization refuses missing balances, wrong owners and changed sessions without zero defaults', async () => {
  for (const [pub, priv, isActive] of [
    [{ uid: 'a', claimed: true, balance: 17 }, {}, () => true],
    [{ uid: 'b', claimed: true, balance: 17 }, { balance: 16 }, () => true],
    [{ uid: 'a', claimed: true, balance: 17 }, { balance: 16 }, () => false],
  ]) {
    const db = new FakeDb(); db.seed('public', pub); db.seed('private', priv); const before = structuredClone([...db.values]);
    await assert.rejects(db.runTransaction(t => synchronizePetWallet(t, { publicRef: 'public', privateRef: 'private', uid: 'a', isActive })));
    assert.deepEqual([...db.values], before);
  }
});
