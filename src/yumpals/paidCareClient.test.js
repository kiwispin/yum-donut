import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPaidCareController, paidCareJournalKey, validateHandheldView } from './paidCareClient.js';
import { createPaidCareTransport } from './paidCareTransport.js';
const require = createRequire(import.meta.url);
const { setup } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');
function fixture({ balance = 30.5 } = {}) {
  const f = setup({ balance });
  f.refs.refusal = (uid, id) => `fixture/refusals/${uid}/${id}`;
  class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
  const api = createPaidCareCallables({ ...f, HttpsError, ready: () => true, now: () => Date.parse('2026-09-09T00:00:00Z') });
  let identity = { uid: 'student-a', isAnonymous: false, sandbox: false }; let count = 0; let lose = false;
  const entries = new Map(); const events = [];
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const transport = async (name, data) => {
    if (name === 'yumpalsPurchaseCare') count++;
    const result = await api[name === 'yumpalsGetPaidCareState' ? 'getState' : 'purchase']({ data, auth: { uid: identity.uid, token: { firebase: { sign_in_provider: 'password' } } } });
    if (lose && name === 'yumpalsPurchaseCare') { lose = false; throw new Error('LOST'); }
    return result;
  };
  const options = { ownerUid: 'student-a', projectId: 'demo-paid-care', enabled: true, getIdentity: () => identity,
    transport, storage, operationId: () => `operation-${count + 1}`, onConfirmed: value => events.push(value) };
  return { ...f, api, options, entries, events, count: () => count, lose: () => { lose = true; }, identity: value => { identity = value; } };
}
test('actual wrapper/service chain: explicit confirmation, cost journal, lost reply + gift + remount replay latest wallet', async () => {
  const f = fixture(); let c = createPaidCareController(f.options);
  await c.start(); assert.equal(f.count(), 0);
  c.prepare('meal'); assert.equal(f.count(), 0); f.lose(); await c.confirm();
  assert.equal(c.getState().pending, true); assert.equal(f.events.length, 0);
  const raw = [...f.entries.values()][0]; const saved = JSON.parse(raw);
  assert.deepEqual(Object.keys(saved).sort(), ['ownerUid', 'projectId', 'quotedCost', 'request', 'schemaVersion']);
  assert.equal(saved.quotedCost, 2); assert.equal(Object.hasOwn(saved.request, 'quotedCost'), false);
  assert.equal(/token|authorization|password/iu.test(raw), false);
  const wallet = f.db.read('fixture/wallets/student-a');
  f.db.seed('fixture/wallets/student-a', { ...wallet, balance: wallet.balance + 10 });
  const config = f.db.read(f.refs.config('student-a'));
  f.db.seed(f.refs.config('student-a'), { ...config, version: 'new-price', prices: { ...config.prices, meal: 3 } });
  c.dispose(); c = createPaidCareController(f.options); await c.start(); assert.equal(f.count(), 1);
  await c.retry(); assert.equal(f.count(), 2); assert.equal(c.getState().pending, false);
  assert.equal(c.getState().quote.wallet.balance, 38.5); assert.equal(f.events.length, 0);
  assert.equal(c.getState().quote.prices.meal, 3);
  c.prepare('pat'); await c.confirm(); assert.equal(f.events.length, 1);
});
test('terminal refusal unlocks; raw business HTTP errors do not clear a pending request', async () => {
  const f = fixture({ balance: 0 }); const c = createPaidCareController(f.options); await c.start(); c.prepare('meal'); await c.confirm();
  assert.equal(c.getState().pending, false); assert.equal(f.events.length, 0);
  const options = { ...f.options, transport: async (name, ...args) => {
    if (name === 'yumpalsPurchaseCare') throw { details: { reason: 'INSUFFICIENT_FUNDS' } };
    return f.options.transport(name, ...args);
  } };
  const d = createPaidCareController(options); await d.start(); d.prepare('meal'); await d.confirm();
  assert.equal(d.getState().pending, true); assert.equal(f.entries.size, 1);
});
test('quoted cost and exact fractional subtraction tampering refuse journal cleanup', async () => {
  for (const edit of [o => { o.amount = 2; }, o => { o.walletAfter = 0.1; }, o => { o.request.extra = true; }]) {
    const f = fixture({ balance: 1.1 });
    const options = { ...f.options, transport: async (...args) => {
      const value = await f.options.transport(...args);
      if (args[0] === 'yumpalsPurchaseCare') edit(value.outcome);
      return value;
    } };
    const c = createPaidCareController(options); await c.start(); c.prepare('snack'); await c.confirm();
    assert.equal(c.getState().pending, true); assert.equal(f.events.length, 0);
  }
});
test('storage failures, replacement journals and UUID failures prevent new dispatch', async () => {
  const f = fixture(); const c = createPaidCareController(f.options); await c.start(); c.prepare('meal');
  f.entries.set(paidCareJournalKey('demo-paid-care', 'student-a'), 'another-controller');
  await c.confirm(); assert.equal(f.count(), 0); assert.equal(c.getState().storageBlocked, true);
  f.entries.clear();
  const d = createPaidCareController({ ...f.options, operationId: () => { throw new Error('NO_UUID'); } });
  await d.start(); d.prepare('meal'); await d.confirm(); assert.equal(f.count(), 0);
});
test('late original success after account switch preserves original journal and emits no event', async () => {
  const f = fixture(); let release; let reached;
  const held = new Promise(resolve => { release = resolve; }); const entered = new Promise(resolve => { reached = resolve; });
  const c = createPaidCareController({ ...f.options, transport: async (...args) => {
    const value = await f.options.transport(...args);
    if (args[0] === 'yumpalsPurchaseCare') { reached(); await held; }
    return value;
  } });
  await c.start(); c.prepare('meal'); const saving = c.confirm(); await entered;
  f.identity({ uid: 'student-b', isAnonymous: false, sandbox: false }); release(); await saving;
  assert.equal(f.entries.size, 1); assert.equal(f.events.length, 0);
});
test('safe view rejects unknown wallet and extra private fields rather than defaulting', async () => {
  const f = fixture(); const c = createPaidCareController(f.options); await c.start(); const view = c.getState().quote;
  for (const wallet of [null, {}, { available: true }, { available: false, balance: 0 }, { available: true, balance: NaN }]) {
    assert.throws(() => validateHandheldView({ ...view, wallet }, 'student-a'));
  }
  assert.throws(() => validateHandheldView({ ...view, secret: true }, 'student-a'));
});
test('pinned transport refuses session switch during token wait and ambiguous envelopes', async () => {
  let release; let calls = 0;
  const original = { uid: 'student-a', isAnonymous: false, getIdToken: () => new Promise(resolve => { release = resolve; }) };
  let user = original;
  const transport = createPaidCareTransport({ projectId: 'demo-paid-care', enabled: true, getCurrentUser: () => user,
    fetchImpl: async () => { calls++; return {}; } });
  const req = transport('yumpalsGetPaidCareState', {}, { ownerUid: 'student-a', isActive: () => true });
  user = { ...original }; release('synthetic-token'); await assert.rejects(req); assert.equal(calls, 0);
  user = { ...original, getIdToken: async () => 'synthetic-token' };
  for (const body of [{ result: {}, error: { status: 'FAILED_PRECONDITION' } }, { error: { status: 'ABORTED', details: { reason: 'INSUFFICIENT_FUNDS' } } }]) {
    const t = createPaidCareTransport({ projectId: 'demo-paid-care', enabled: true, getCurrentUser: () => user,
      fetchImpl: async (_url, options) => { assert.equal(options.redirect, 'error'); return { ok: false, status: 409, json: async () => body }; } });
    await assert.rejects(t('yumpalsPurchaseCare', { operationId: 'test', action: 'meal', expectedConfigVersion: 'test', expectedConfigHash: 'a'.repeat(64) }, { ownerUid: 'student-a', isActive: () => true }), { details: { reason: 'UNAVAILABLE' } });
  }
});
test('invalid adoption never journals or dispatches; valid adoption is normalized before confirmation', async () => {
  const f = fixture(); const c = createPaidCareController(f.options); await c.start();
  for (const change of [{ name: 'a'.repeat(17) }, { name: '<bad>' }, { species: 'unknown' }, { casing: 'unknown' }, { color: 'pink' }]) {
    c.prepare('adoption', { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878', ...change }); await c.confirm();
    assert.equal(f.count(), 0); assert.equal(f.entries.size, 0); assert.match(c.getState().message, /1–16/);
  }
  c.prepare('adoption', { name: '  Ｎiblet ', species: 'mossbit', casing: ' BERRY ', color: ' #D94878 ' });
  assert.deepEqual(c.getState().confirmation.adoption, { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878' });
});
test('throwing presentation callback cannot misreport confirmed payment or prevent fresh read', async () => {
  const f = fixture(); const c = createPaidCareController({ ...f.options, onConfirmed: () => { throw new Error('PRESENTATION'); } });
  await c.start(); c.prepare('meal'); await c.confirm();
  assert.equal(c.getState().pending, false); assert.equal(f.entries.size, 0);
  assert.equal(c.getState().quote.wallet.balance, 28.5); assert.equal(c.getState().message, 'Purchase confirmed.');
});
test('transport validates exact request before token acquisition; safe view checks clock and pet identity', async () => {
  let tokens = 0;
  const user = { uid: 'student-a', isAnonymous: false, getIdToken: async () => { tokens++; return 'test'; } };
  const t = createPaidCareTransport({ projectId: 'demo-paid-care', enabled: true, getCurrentUser: () => user });
  for (const payload of [{}, { action: 'meal' }, { operationId: 'test', action: 'meal', expectedConfigVersion: 'v1', expectedConfigHash: 'a'.repeat(64), cost: 2 }]) await assert.rejects(t('yumpalsPurchaseCare', payload, { ownerUid: user.uid, isActive: () => true }));
  assert.equal(tokens, 0);
  const f = fixture(); const c = createPaidCareController(f.options); await c.start(); const view = c.getState().quote;
  assert.throws(() => validateHandheldView({ ...view, aucklandHour: (view.aucklandHour + 1) % 24 }, 'student-a'));
  for (const change of [{ species: 'wrong' }, { name: 'a'.repeat(17) }, { earnedMilestones: ['trick', 'trick'] }, { sleepDate: '2099-01-01' }]) {
    assert.throws(() => validateHandheldView({ ...view, pet: { ...view.pet, ...change } }, 'student-a'));
  }
});
test('reordered terminal request keys validate without changing binding; replacement journal survives cleanup', async () => {
  for (const replacement of [false, true]) {
    const f = fixture(); const key = paidCareJournalKey('demo-paid-care', 'student-a');
    const c = createPaidCareController({ ...f.options, transport: async (...args) => {
      const value = await f.options.transport(...args);
      if (args[0] === 'yumpalsPurchaseCare') {
        value.outcome.request = Object.fromEntries(Object.entries(value.outcome.request).reverse());
        if (replacement) f.entries.set(key, 'replacement');
      }
      return value;
    } });
    await c.start(); c.prepare('meal'); await c.confirm();
    assert.equal(c.getState().pending, replacement);
    assert.equal(f.entries.get(key), replacement ? 'replacement' : undefined);
  }
});
test('double confirmation dispatches once; disposal ignores delayed read and disabled states explain blocking', async () => {
  const f = fixture(); let release; let reached;
  const held = new Promise(resolve => { release = resolve; }); const entered = new Promise(resolve => { reached = resolve; });
  const c = createPaidCareController({ ...f.options, transport: async (...args) => {
    const result = await f.options.transport(...args);
    if (args[0] === 'yumpalsPurchaseCare') { reached(); await held; } return result;
  } });
  await c.start(); c.prepare('meal'); const first = c.confirm(); await entered; await c.confirm(); assert.equal(f.count(), 1);
  c.dispose(); release(); await first; assert.equal(f.entries.size, 1);
  const d = createPaidCareController({ ...f.options, enabled: false }); await d.start(); assert.match(d.getState().message, /not ready/);
});
test('refresh and prepare after account switch never emit the old pet, balance or confirmation', async () => {
  for (const action of ['refresh', 'prepare']) {
    const f = fixture(); const emitted = [];
    const c = createPaidCareController({ ...f.options, onChange: value => emitted.push(value) });
    await c.start(); c.prepare('meal'); assert.ok(c.getState().quote.pet);
    const key = paidCareJournalKey('demo-paid-care', 'student-a'); f.entries.set(key, 'preserve-original-journal');
    f.identity({ uid: 'student-b', isAnonymous: false, sandbox: false }); emitted.length = 0;
    if (action === 'refresh') await c.refresh(); else c.prepare('snack');
    assert.equal(emitted.length, 1); assert.equal(emitted[0].quote, null); assert.equal(emitted[0].confirmation, null);
    assert.equal(f.entries.get(key), 'preserve-original-journal');
    assert.match(emitted[0].message, /sign in/);
  }
});
test('read failures have actionable allowlisted copy, including inherited reason rejection', async () => {
  for (const [reason, pattern] of [['MIGRATION_REQUIRED', /teacher to update/], ['UNAUTHENTICATED', /sign in again/],
    ['ROLLOUT_NOT_READY', /not ready/], ['PERMISSION_DENIED', /teacher to check access/], ['constructor', /Please refresh/], ['toString', /Please refresh/]]) {
    const f = fixture(); const c = createPaidCareController({ ...f.options, transport: async () => { throw { details: { reason } }; } });
    await c.start(); assert.match(c.getState().message, pattern); assert.equal(c.getState().quote, null);
  }
});
test('unexpected no-effect adoption refusal has safe fallback copy, never undefined', async () => {
  const f = fixture(); const c = createPaidCareController({ ...f.options, transport: async (...args) => {
    const result = await f.options.transport(...args);
    if (args[0] === 'yumpalsPurchaseCare') { assert.equal(result.outcome.status, 'REFUSED'); result.outcome.reason = 'NO_EFFECT'; }
    return result;
  } });
  await c.start(); c.prepare('adoption', { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878' }); await c.confirm();
  assert.equal(c.getState().pending, false); assert.match(c.getState().message, /not needed right now/);
  assert.doesNotMatch(c.getState().message, /undefined/);
});
