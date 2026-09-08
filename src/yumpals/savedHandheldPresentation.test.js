import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { build } from 'rolldown';
import { paidRoutePolicy, savedSleep, savedEffect, savedNoEffect, savedChargeLocked, savedContextMatches } from './savedHandheldPresentation.js';
import { createPaidCareController } from './paidCareClient.js';
const require = createRequire(import.meta.url);
const { setup } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');
test('paid priority suppresses legacy independently of authentication; saved route requires exact real UID', () => {
  for (const legacy of [false, true]) {
    assert.deepEqual(paidRoutePolicy({ paid: true, legacy, uid: 'a', authUid: 'a', anonymous: false, sandbox: false }), { legacyAllowed: false, savedAvailable: true });
    for (const change of [{ uid: undefined }, { authUid: 'b' }, { anonymous: true }, { sandbox: true }]) assert.equal(paidRoutePolicy({ paid: true, legacy, uid: 'a', authUid: 'a', anonymous: false, sandbox: false, ...change }).savedAvailable, false);
  }
  assert.equal(paidRoutePolicy({ paid: false, legacy: true }).legacyAllowed, true);
});
test('sleep uses trusted 19–07 Auckland hour/date and paid evening coverage, never client clock', () => {
  const q = { aucklandDate: '2026-09-16', aucklandHour: 12, pet: { sleepDate: '2026-09-16' } };
  assert.deepEqual(savedSleep(q), { sleeping: false, dim: false });
  assert.deepEqual(savedSleep({ ...q, aucklandHour: 19 }), { sleeping: true, dim: true });
  assert.deepEqual(savedSleep({ ...q, aucklandDate: '2026-09-17', aucklandHour: 0 }), { sleeping: true, dim: true });
  assert.deepEqual(savedSleep({ ...q, aucklandDate: '2026-09-17', aucklandHour: 7 }), { sleeping: false, dim: false });
});
test('actual controller integration: helper no-effect selection creates no purchase; explicit beneficial confirm costs once', async () => {
  const f = setup(); f.refs.refusal = (uid, id) => `refused/${uid}/${id}`;
  const api = createPaidCareCallables({ ...f, HttpsError: Error, ready: () => true, now: () => Date.parse('2026-09-07T00:00:00Z') });
  let purchases = 0; const journal = new Map();
  const c = createPaidCareController({ ownerUid: 'student-a', projectId: 'demo-presentation', enabled: true, getIdentity: () => ({ uid: 'student-a', isAnonymous: false, sandbox: false }),
    operationId: () => 'meal', storage: { getItem: k => journal.get(k) ?? null, setItem: (k, v) => journal.set(k, v), removeItem: k => journal.delete(k) },
    transport: async (name, data) => { if (name === 'yumpalsPurchaseCare') purchases++; return api[name === 'yumpalsPurchaseCare' ? 'purchase' : 'getState']({ data, auth: { uid: 'student-a', token: { firebase: { sign_in_provider: 'password' } } } }); } });
  await c.start(); let quote = c.getState().quote;
  assert.match(savedNoEffect(quote, 'meal'), /I’m full! No meal needed/); assert.doesNotMatch(savedEffect(quote, 'meal'), /\+0/);
  assert.equal(purchases, 0); assert.equal(journal.size, 0);
  const p = f.db.read(f.refs.pet('student-a')); p.paidCare.needs.hunger = 2; f.db.seed(f.refs.pet('student-a'), p); await c.refresh(); quote = c.getState().quote;
  assert.equal(savedNoEffect(quote, 'meal'), null); assert.equal(savedEffect(quote, 'meal'), '+2 Food hearts');
  c.prepare('meal'); assert.equal(purchases, 0); await c.confirm(); assert.equal(purchases, 1); assert.equal(c.getState().quote.wallet.balance, 28);
});
test('context mask and charge locks reject old account/project or unavailable wallet', () => {
  const base = { enabled: true, ownerUid: 'a', projectId: 'demo-a', identity: { uid: 'a', isAnonymous: false, sandbox: false }, state: { ownerUid: 'a', projectId: 'demo-a' } };
  assert.equal(savedContextMatches(base), true);
  for (const change of [{ enabled: false }, { ownerUid: 'b' }, { projectId: 'demo-b' }, { identity: { uid: 'b', isAnonymous: false, sandbox: false } }]) assert.equal(savedContextMatches({ ...base, ...change }), false);
  assert.equal(savedChargeLocked({ quote: { enabled: true, wallet: { available: false } } }), true);
  assert.equal(savedChargeLocked({ pending: true, quote: { enabled: true, wallet: { available: true, balance: 17 } } }), true);
});
test('actual component renders fixed hardware labels, eight pixel icons and no automatic pet or zero balance', async () => {
  // Compile the actual JSX in memory using installed build tooling, then render
  // with installed React server renderer. No browser, files or dependencies added.
  const result = await build({ input: path.resolve('src/yumpals/YumPalsSavedHandheld.jsx'), platform: 'node', external: ['react', 'react/jsx-runtime'],
    plugins: [{ name: 'test-css', load: id => id.endsWith('.css') ? 'export default {}' : null }], output: { format: 'cjs' }, write: false });
  const filename = path.resolve('src/yumpals/render-test.cjs');
  const compiled = new Module(filename); compiled.filename = filename; compiled.paths = require.resolve.paths('react');
  compiled._compile(result.output.find(item => item.type === 'chunk').code, filename);
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  const markup = renderToStaticMarkup(React.createElement(compiled.exports.default || compiled.exports, { ownerUid: 'a', projectId: 'demo-test', enabled: true,
    getIdentity: () => ({ uid: 'a', isAnonymous: false, sandbox: false }), transport: () => { throw new Error('Render must not call transport'); } }));
  for (const label of ['A SELECT', 'B CONFIRM', 'C CANCEL']) assert.ok(markup.includes(`aria-label="${label}"`));
  assert.equal((markup.match(/class="saved-pixels saved-icon"/g) || []).length, 8);
  assert.ok(markup.includes('DONUTS —')); assert.equal(markup.includes('0 DONUTS'), false); assert.equal(markup.includes('data-frame-key'), false);
});
