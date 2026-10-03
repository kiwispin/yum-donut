import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPaidCareController, paidCareJournalKey } from './paidCareClient.js';
import { createPaidCareTransport } from './paidCareTransport.js';
const require = createRequire(import.meta.url);
const { setup, request } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');
function testLocks() {
  let tail = Promise.resolve();
  return { request: (_name, _options, callback) => { const run = tail.then(callback, callback); tail = run.catch(() => {}); return run; } };
}
function fixture({ fast = true, latency = 0, pet = true, needs = { hunger: 0, happiness: 4, cleanliness: 0, health: 4 }, edit = v => v, onQueued = () => {}, autoRecover = false } = {}) {
  const f = setup({ pet, needs });
  f.refs.refusal = (uid, id) => `fixture/refusals/${uid}/${id}`;
  class HttpsError extends Error { constructor(code, message, details) { super(message); Object.assign(this, { code, details }); } }
  const api = createPaidCareCallables({ ...f, HttpsError, ready: () => true, now: () => Date.parse('2026-09-09T00:00:00Z') });
  let calls = []; let sequence = 0; let identity = { uid: 'student-a', isAnonymous: false, sandbox: false };
  const entries = new Map(); const events = []; const locks = testLocks();
  const user = { uid: 'student-a', isAnonymous: false, getIdToken: async () => 'synthetic' };
  const transport = createPaidCareTransport({ projectId: 'demo-speed', enabled: true, getCurrentUser: () => user,
    fetchImpl: async (url, options) => {
      const data = JSON.parse(options.body).data;
      if (!fast) delete data.includeState;
      const method = url.endsWith('yumpalsPurchaseCare') ? 'purchase' : 'getState';
      calls.push(method);
      if (latency) await new Promise(resolve => setTimeout(resolve, latency));
      return { ok: true, json: async () => ({ result: await edit(await api[method](request('student-a', data)), method) }) };
    } });
  const options = { ownerUid: 'student-a', projectId: 'demo-speed', enabled: true,
    getIdentity: () => identity, transport, operationId: () => `speed-${++sequence}`,
    storage: { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) },
    locks, onQueued, autoRecover, onConfirmed: e => events.push(e) };
  const controller = createPaidCareController(options);
  return { ...f, api, controller, create: () => createPaidCareController(options), transport, events, entries, calls: () => calls, resetCalls: () => { calls = []; }, setIdentity: v => { identity = v; } };
}
test('normal care uses one request and authoritative snapshot, legacy response still refreshes', async t => {
  const measured = {};
  for (const fast of [false, true]) {
    const f = fixture({ fast, latency: 120 }); const c = f.controller;
    await c.start(); f.resetCalls(); c.prepare('meal');
    const start = performance.now(); await Promise.all([c.confirm(), c.confirm()]);
    measured[fast ? 'newMs' : 'oldMs'] = Math.round(performance.now() - start);
    assert.deepEqual(f.calls(), fast ? ['purchase'] : ['purchase', 'getState']);
    assert.equal(c.getState().busy, false); assert.equal(c.getState().pending, false);
    assert.equal(c.getState().quote.wallet.balance, 28); assert.equal(f.events.length, 1);
    assert.deepEqual(c.getState().quote.pet.needs, f.db.read(f.refs.pet('student-a')).paidCare.needs);
    assert.equal(f.entries.has(paidCareJournalKey('demo-speed', 'student-a')), false);
  }
  t.diagnostic(`Controlled 120ms/request: ${JSON.stringify(measured)}; not a live-network benchmark.`);
});
test('old clients receive unchanged envelope; opt-in state is not persisted in receipt', async () => {
  const f = fixture(); const view = await f.api.getState(request());
  const payload = { operationId: 'legacy', action: 'meal', expectedConfigVersion: view.configVersion, expectedConfigHash: view.configHash };
  const old = await f.api.purchase(request('student-a', payload));
  assert.deepEqual(Object.keys(old).sort(), ['duplicate', 'outcome']);
  const dup = await f.api.purchase(request('student-a', { ...payload, includeState: true }));
  assert.equal(dup.duplicate, true); assert.equal('state' in dup, false);
  assert.equal('state' in f.db.read(f.refs.receipt('student-a', 'legacy')), false);
});
test('locally detected no-effect care sends no purchase and never replays old balance', async () => {
  const f = fixture(); const c = f.controller; await c.start(); c.prepare('meal'); await c.confirm();
  c.prepare('meal'); await c.confirm(); // now full
  f.resetCalls(); c.prepare('meal'); await c.confirm();
  assert.deepEqual(f.calls(), []);
  assert.equal(c.getState().pending, false); assert.match(c.getState().message, /No donuts spent/);
});
test('invalid authoritative state cannot release journal or animate a success', async () => {
  for (const corrupt of [s => { s.ownerUid = 'another-student'; }, s => { s.wallet.balance++; }, s => { s.serverNowMs++; }, s => { s.pet = null; }]) {
    const f = fixture({ edit: (v, method) => { if (method === 'purchase' && v.state) corrupt(v.state); return v; } });
    const c = f.controller; await c.start(); c.prepare('meal'); await c.confirm();
    assert.equal(c.getState().pending, true); assert.equal(f.events.length, 0); assert.equal(f.entries.has(paidCareJournalKey('demo-speed', 'student-a')), true);
  }
});
test('adoption returns saved pet with one purchase request', async () => {
  const f = fixture({ pet: false }); const c = f.controller; await c.start(); f.resetCalls();
  c.prepare('adoption', { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878' }); await c.confirm();
  assert.deepEqual(f.calls(), ['purchase']); assert.equal(c.getState().quote.pet.name, 'Niblet'); assert.equal(c.getState().quote.wallet.balance, 25);
});
test('commit failure cannot return a successful state; retry recovers without double debit', async () => {
  const f = fixture(); const c = f.controller; await c.start(); f.db.failCommit = true;
  c.prepare('meal'); await c.confirm(); assert.equal(c.getState().pending, true); assert.equal(f.events.length, 0);
  assert.equal(f.db.read('fixture/wallets/student-a').balance, 30);
  await c.retry(); assert.equal(c.getState().pending, false); assert.equal(c.getState().quote.wallet.balance, 28);
  assert.equal(f.events.length, 0);
});
test('lost fast response, gift and retry use latest balance without a second charge', async () => {
  let lose = true;
  const f = fixture({ edit: (v, method) => { if (method === 'purchase' && lose) { lose = false; throw Error('Lost reply'); } return v; } });
  const c = f.controller; await c.start(); c.prepare('meal'); await c.confirm();
  assert.equal(c.getState().pending, true); assert.equal(f.db.read('fixture/wallets/student-a').balance, 28);
  const wallet = f.db.read('fixture/wallets/student-a'); f.db.seed('fixture/wallets/student-a', { ...wallet, balance: 38 });
  f.resetCalls(); await c.retry();
  assert.deepEqual(f.calls(), ['purchase', 'getState']); assert.equal(c.getState().quote.wallet.balance, 38);
  assert.equal(f.events.length, 0); assert.equal(f.entries.has(paidCareJournalKey('demo-speed', 'student-a')), false);
});
test('concurrent opt-in requests return committed snapshot once and no extra fields', async () => {
  const f = fixture(); const view = await f.api.getState(request());
  const data = { operationId: 'concurrent-fast', action: 'meal', expectedConfigVersion: view.configVersion, expectedConfigHash: view.configHash, includeState: true };
  const results = await Promise.all([f.api.purchase(request('student-a', data)), f.api.purchase(request('student-a', data))]);
  assert.equal(results.filter(r => r.duplicate).length, 1);
  const fresh = results.find(r => !r.duplicate);
  assert.deepEqual(Object.keys(fresh.state).sort(), Object.keys(view).sort());
  assert.equal(fresh.state.wallet.balance, 28); assert.equal(f.db.read('fixture/wallets/student-a').balance, 28);
  assert.deepEqual(fresh.state.pet.needs, f.db.read(f.refs.pet('student-a')).paidCare.needs);
});
test('local care begins before delayed payment, and ordinary care can queue with authoritative reservations', async () => {
  const queued = [];
  const f = fixture({ latency: 200, onQueued: e => queued.push(e) });
  const c = f.controller; await c.start(); c.prepare('meal');
  const saving = c.confirm();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(queued.length, 1); assert.equal(f.entries.has(paidCareJournalKey('demo-speed', 'student-a')), true);
  assert.equal(c.getState().pending, true); assert.equal(c.getState().quote.wallet.balance, 30);
  c.prepare('snack'); await c.confirm(); assert.equal(queued.length, 2);
  await saving; assert.equal(c.getState().quote.wallet.balance, 27); assert.equal(f.events.length, 2);
});
test('automatic recovery reuses operation after a lost reply without replaying local animation', async () => {
  let lose = true; const queued = [];
  const f = fixture({ autoRecover: true, onQueued: e => queued.push(e), edit: (v, method) => {
    if (method === 'purchase' && lose) { lose = false; throw Error('lost'); } return v;
  } });
  const c = f.controller; await c.start(); c.prepare('meal'); await c.confirm();
  assert.equal(c.getState().pending, true); assert.ok(c.getState().quote.pet);
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.equal(c.getState().pending, false); assert.equal(c.getState().quote.wallet.balance, 28);
  assert.equal(queued.length, 1); assert.equal(f.events.length, 0); assert.equal(f.entries.has(paidCareJournalKey('demo-speed', 'student-a')), false);
  c.dispose();
});
test('opening can reuse the already-loaded identity-bound state without another request', async () => {
  const f = fixture(); const c = f.controller; await c.start(); f.resetCalls();
  await c.start(); assert.deepEqual(f.calls(), []);
  assert.equal(c.getState().quote.wallet.balance, 30);
  f.setIdentity({ uid: 'student-b', isAnonymous: false, sandbox: false });
  await c.start(); assert.equal(c.getState().quote, null);
});

test('background refresh does not erase a price confirmation and concurrent refreshes share one read', async () => {
  let release; let hold = false;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture({ edit: async (value, method) => { if (hold && method === 'getState') await gate; return value; } });
  const c = f.controller; await c.start(); f.resetCalls(); hold = true;
  const reads = [c.refresh(), c.refresh(), c.refresh()];
  c.prepare('meal'); const confirmation = c.getState().confirmation;
  release(); await Promise.all(reads);
  assert.deepEqual(f.calls(), ['getState']);
  assert.deepEqual(c.getState().confirmation, confirmation);
  await c.confirm(); assert.equal(c.getState().quote.wallet.balance, 28);
});

test('late background snapshot cannot rewind a newer paid-care receipt or its warm cache', async () => {
  let release; let entered; let hold = false;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const f = fixture({ edit: async (value, method) => { if (hold && method === 'getState') { entered(); await gate; } return value; } });
  const c = f.controller; await c.start(); hold = true;
  const reading = c.refresh(); await ready;
  c.prepare('meal'); await c.confirm();
  assert.equal(c.getState().quote.wallet.balance, 28);
  release(); await reading;
  assert.equal(c.getState().quote.wallet.balance, 28);
  assert.equal(f.transport.peek('student-a').wallet.balance, 28);
  f.resetCalls(); await c.start(); assert.deepEqual(f.calls(), []);
  assert.equal(c.getState().quote.pet.needs.hunger, 2);
});

test('recent same-session cache displays immediately and refreshes behind the screen', async t => {
  let clock = Date.now(); t.mock.method(Date, 'now', () => clock);
  let release; let hold = false;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture({ edit: async (value, method) => { if (hold && method === 'getState') await gate; return value; } });
  await f.controller.start(); f.controller.dispose();
  const c = f.create(); clock += 11000; hold = true; f.resetCalls();
  assert.equal(f.transport.peek('student-a'), null);
  assert.equal(f.transport.peekRecent('student-a').wallet.balance, 30);
  const opening = c.start();
  assert.equal(c.getState().quote.wallet.balance, 30);
  release(); await opening; assert.deepEqual(f.calls(), ['getState']);
  clock += 61000; assert.equal(f.transport.peekRecent('student-a'), null);
  assert.equal(f.transport.peekRecent('student-b'), null);
});

test('changed configuration during background refresh withdraws, rather than silently changes, confirmation', async () => {
  const f = fixture(); const c = f.controller; await c.start(); c.prepare('meal');
  const config = f.db.read(f.refs.config('student-a'));
  f.db.seed(f.refs.config('student-a'), { ...config, version: 'changed', prices: { ...config.prices, meal: 3 } });
  await c.refresh(); assert.equal(c.getState().confirmation, null);
  assert.match(c.getState().message, /choose again/);
  f.resetCalls(); await c.confirm(); assert.deepEqual(f.calls(), []);
});
