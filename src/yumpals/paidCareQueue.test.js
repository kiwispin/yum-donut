import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPaidCareController, paidCareJournalKey, paidCareNamespaceKey, paidCareSequenceKey } from './paidCareClient.js';
const require = createRequire(import.meta.url);
const { setup, request } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');

function locks() {
  let tail = Promise.resolve();
  return { request: (_name, _options, callback) => { const run = tail.then(callback, callback); tail = run.catch(() => {}); return run; } };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture({ balance = 10, needs = { hunger: 0, happiness: 4, cleanliness: 0, health: 4 }, transportEdit = value => value, transportBefore = () => {}, transportAfter = () => {} } = {}) {
  const f = setup({ balance, needs });
  f.refs.refusal = (uid, id) => `fixture/refusals/${uid}/${id}`;
  class HttpsError extends Error { constructor(code, message, details) { super(message); Object.assign(this, { code, details }); } }
  const api = createPaidCareCallables({ ...f, HttpsError, ready: () => true, now: () => Date.parse('2026-09-09T00:00:00Z') });
  let currentIdentity = { uid: 'student-a', isAnonymous: false, sandbox: false }; const entries = new Map(); const lock = locks(); const calls = []; let active = 0; let maxActive = 0;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const transport = async (name, data) => {
    calls.push({ name, data: structuredClone(data) });
    if (name === 'yumpalsGetPaidCareState') return api.getState(request('student-a', data));
    active += 1; maxActive = Math.max(maxActive, active);
    try { await transportBefore(calls.filter(call => call.name === 'yumpalsPurchaseCare').length, f); const value = await api.purchase(request('student-a', { ...data, includeState: true })); const edited = transportEdit(value, calls.filter(call => call.name === 'yumpalsPurchaseCare').length, f); await transportAfter(calls.filter(call => call.name === 'yumpalsPurchaseCare').length, f); return edited; }
    finally { active -= 1; }
  };
  const options = { ownerUid: 'student-a', projectId: 'queue-test', enabled: true, getIdentity: () => currentIdentity, transport, storage, locks: lock, operationId: () => 'fixture-count-id' };
  return { ...f, options, api, entries, calls, setIdentity: identity => { currentIdentity = identity; }, maxActive: () => maxActive, journal: () => JSON.parse(entries.get(paidCareJournalKey('queue-test', 'student-a'))), namespace: () => entries.get(paidCareNamespaceKey('queue-test', 'student-a')), sequence: () => entries.get(paidCareSequenceKey('queue-test', 'student-a')) };
}
async function load(f, extra = {}) { const c = createPaidCareController({ ...f.options, ...extra }); await c.start(); return c; }
function queue(c, action) { c.prepare(action); assert.ok(c.getState().confirmation, `${action} should be confirmable`); return c.confirm(); }

test('10 second response still lets a second ordinary care confirmation queue in under 250ms', async () => {
  const gate = deferred(); const f = fixture({ transportAfter: async (n) => { if (n === 1) await gate.promise; } }); const queued = []; const c = await load(f, { onQueued: value => queued.push(value) });
  const first = queue(c, 'meal'); await tick();
  const start = performance.now(); const second = queue(c, 'clean'); await second; const elapsed = performance.now() - start;
  assert.ok(elapsed < 250, `second confirmation took ${elapsed}ms`); assert.equal(queued.length, 2); assert.equal(c.getState().queue.length, 2); assert.equal(c.getState().quote.wallet.balance, 10); assert.equal(c.getState().projected.wallet.balance, 7); assert.equal(f.maxActive(), 1);
  gate.resolve(); await first; assert.equal(c.getState().pending, false); assert.equal(f.db.read('fixture/wallets/student-a').balance, 7); c.dispose();
});

test('local wallet reservation rejects a tail before it can overdraw fractional or whole funds', async () => {
  const gate = deferred(); const f = fixture({ balance: 2, transportAfter: async (n) => { if (n === 1) await gate.promise; } }); const c = await load(f);
  const first = queue(c, 'meal'); await tick(); c.prepare('clean'); assert.equal(c.getState().confirmation, null); assert.match(c.getState().message, /enough saved donuts/); assert.equal(c.getState().queue.length, 1);
  gate.resolve(); await first; assert.equal(f.db.read('fixture/wallets/student-a').balance, 0); c.dispose();
});

test('refused head releases its reservation and rebases a valid tail against a fresh read', async () => {
  let changed = false; const f = fixture({ transportBefore: async (n, db) => { if (n === 1 && !changed) { changed = true; const pet = db.db.read(db.refs.pet('student-a')); pet.paidCare.needs.hunger = 4; db.db.seed(db.refs.pet('student-a'), pet); } } }); const c = await load(f);
  const first = queue(c, 'meal'); await tick(); const second = queue(c, 'clean'); await Promise.all([first, second]);
  assert.equal(c.getState().pending, false); assert.equal(f.db.read('fixture/wallets/student-a').balance, 9); assert.equal(f.db.read(f.refs.pet('student-a')).paidCare.needs.cleanliness, 2);
  assert.deepEqual(f.calls.filter(call => call.name === 'yumpalsPurchaseCare').map(call => call.data.action), ['meal', 'clean']); c.dispose();
});

test('lost reply keeps the unresolved head and later care waits for the same operation proof', async () => {
  const gate = deferred(); let lose = true; const f = fixture({ transportBefore: async n => { if (n === 1) await gate.promise; }, transportEdit: (value, n) => { if (n === 1 && lose) { lose = false; throw new Error('LOST_REPLY'); } return value; } }); const c = await load(f);
  const first = queue(c, 'meal'); await tick(); const second = queue(c, 'clean'); await second; gate.resolve(); await first;
  assert.equal(c.getState().pending, true); assert.equal(c.getState().queue[0].phase, 'uncertain'); const savedIds = c.getState().queue.map(item => item.operationId);
  await c.retry(); assert.equal(c.getState().pending, false); assert.equal(f.db.read('fixture/wallets/student-a').balance, 7); assert.deepEqual(f.calls.filter(call => call.name === 'yumpalsPurchaseCare').map(call => call.data.operationId), [savedIds[0], savedIds[0], savedIds[1]]); c.dispose();
});

test('reload recovers a durable uncertain journal without replaying a new operation ID', async () => {
  let lose = true; const f = fixture({ transportEdit: (value) => { if (lose) { lose = false; throw new Error('LOST_REPLY'); } return value; } }); const c = await load(f); await queue(c, 'meal'); assert.equal(c.getState().pending, true); const operationId = c.getState().queue[0].operationId; c.dispose();
  const reloaded = await load(f, { autoRecover: true }); assert.equal(reloaded.getState().pending, false); assert.equal(f.db.read('fixture/wallets/student-a').balance, 8); assert.equal(f.calls.filter(call => call.name === 'yumpalsPurchaseCare').map(call => call.data.operationId).join(','), `${operationId},${operationId}`); reloaded.dispose();
});

test('session switch during a delayed reply preserves the old journal and emits no new confirmation', async () => {
  const gate = deferred(); const f = fixture({ transportAfter: async (n) => { if (n === 1) await gate.promise; } }); const events = []; const c = await load(f, { onConfirmed: value => events.push(value) }); const first = queue(c, 'meal'); await tick(); f.setIdentity({ uid: 'student-b', isAnonymous: false, sandbox: false }); gate.resolve(); await first; assert.ok(f.entries.has(paidCareJournalKey('queue-test', 'student-a'))); assert.equal(events.length, 0); c.dispose();
});

test('duplicate confirmation clicks create one durable operation and one network request', async () => {
  const f = fixture(); const c = await load(f); c.prepare('meal'); const first = c.confirm(); const second = c.confirm(); await Promise.all([first, second]); const purchases = f.calls.filter(call => call.name === 'yumpalsPurchaseCare'); assert.equal(purchases.length, 1); assert.equal(c.getState().pending, false); c.dispose();
});

test('same-account tabs share the namespace/counter and never overwrite each other queue entries', async () => {
  const gate = deferred(); const f = fixture({ transportAfter: async (n) => { if (n === 1) await gate.promise; } }); const a = await load(f); const b = await load(f);
  const first = queue(a, 'meal'); await tick(); const second = queue(b, 'clean'); await second; assert.equal(f.journal().entries.length, 2); assert.notEqual(f.journal().entries[0].request.operationId, f.journal().entries[1].request.operationId); assert.equal(f.namespace().length, 32); assert.equal(f.sequence(), '2'); gate.resolve(); await first; assert.equal(f.db.read('fixture/wallets/student-a').balance, 7); assert.equal(f.entries.has(paidCareJournalKey('queue-test', 'student-a')), false); a.dispose(); b.dispose();
});

test('a config change never silently reprices a queued tail', async () => {
  const f = fixture({ transportAfter: async (n, db) => { if (n === 1) { const config = db.db.read(db.refs.config('student-a')); db.db.seed(db.refs.config('student-a'), { ...config, version: 'changed', prices: { ...config.prices, clean: 3 } }); } } }); const c = await load(f);
  const first = queue(c, 'meal'); await tick(); const second = queue(c, 'clean'); await Promise.all([first, second]); assert.equal(c.getState().pending, false); assert.equal(f.db.read('fixture/wallets/student-a').balance, 8); assert.equal(c.getState().quote.prices.clean, 3); c.dispose();
});

test('legacy v1 single-pending journal migrates and retries its exact operation', async () => {
  const f = fixture(); const warm = await load(f); const quote = warm.getState().quote; warm.dispose();
  const legacyRequest = { operationId: 'legacy-single', action: 'meal', expectedConfigVersion: quote.configVersion, expectedConfigHash: quote.configHash };
  f.entries.set(paidCareJournalKey('queue-test', 'student-a'), JSON.stringify({ schemaVersion: 1, ownerUid: 'student-a', projectId: 'queue-test', request: legacyRequest, quotedCost: 2 }));
  const recovered = await load(f, { autoRecover: true });
  assert.equal(recovered.getState().pending, false); assert.equal(f.db.read('fixture/wallets/student-a').balance, 8);
  assert.deepEqual(f.calls.filter(call => call.name === 'yumpalsPurchaseCare').map(call => call.data.operationId), ['legacy-single']); recovered.dispose();
});

test('missing cross-tab lock fails closed before a new operation is written', async () => {
  const f = fixture(); const c = await load(f, { locks: {} }); c.prepare('meal'); await c.confirm();
  assert.equal(c.getState().storageBlocked, true); assert.equal(c.getState().pending, false); assert.equal(f.calls.filter(call => call.name === 'yumpalsPurchaseCare').length, 0); c.dispose();
});

test('account switch while waiting for the queue lock writes neither a journal nor a request', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; }); const f = fixture(); const waitingLock = { request: async (_name, _options, callback) => { await gate; return callback(); } };
  const c = await load(f, { locks: waitingLock }); c.prepare('meal'); const confirming = c.confirm(); f.setIdentity({ uid: 'student-b', isAnonymous: false, sandbox: false }); release(); await confirming;
  assert.equal(f.entries.has(paidCareJournalKey('queue-test', 'student-a')), false); assert.equal(f.calls.filter(call => call.name === 'yumpalsPurchaseCare').length, 0); c.dispose();
});

test('adoption and guessing game remain excluded while ordinary care is queued', async () => {
  const gate = deferred(); const f = fixture({ transportAfter: async n => { if (n === 1) await gate.promise; } }); const c = await load(f);
  const first = queue(c, 'meal'); await tick(); c.prepare('game'); assert.equal(c.getState().confirmation, null); assert.match(c.getState().message, /cannot be queued|Finish saving/);
  c.prepare('adoption', { name: 'Another', species: 'mossbit', casing: 'berry', color: '#d94878' }); assert.equal(c.getState().confirmation, null); assert.match(c.getState().message, /cannot be queued|ready after/);
  gate.resolve(); await first; c.dispose();
});
