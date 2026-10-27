import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markPalVisited, palGiftWaiting, PAL_VISITED_EVENT } from './visitReminder.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const target = () => { const events = []; return { events, dispatchEvent: e => events.push(e.type) }; };

test('the dot shows until today\'s visit, and again the next day', () => {
  const storage = memory(); const t = target();
  assert.equal(palGiftWaiting('a', '2026-10-28', storage), true, 'no record yet: invite a visit');
  markPalVisited('a', '2026-10-28', true, storage, t);
  assert.deepEqual(t.events, [PAL_VISITED_EVENT]);
  assert.equal(palGiftWaiting('a', '2026-10-28', storage), false);
  assert.equal(palGiftWaiting('a', '2026-10-29', storage), true);
  assert.equal(palGiftWaiting('b', '2026-10-28', storage), true, 'per student');
});

test('a student known to have no pal is never nagged', () => {
  const storage = memory();
  markPalVisited('c', '2026-10-27', false, storage, target());
  assert.equal(palGiftWaiting('c', '2026-10-28', storage), false);
});

test('no student or blocked storage never shows a dot', () => {
  assert.equal(palGiftWaiting(undefined, '2026-10-28', memory()), false);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(palGiftWaiting('d', '2026-10-28', broken), false);
  assert.doesNotThrow(() => markPalVisited('d', '2026-10-28', true, broken, target()));
});

test('the dot is wired to both nav buttons and cleared by the saved handheld', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(app, /palGiftWaiting\(user\?\.uid, currentDateKey\)/u);
  assert.match(app, /view !== 'yumpals-saved' && palGiftWaiting/u, 'hidden while on YumPals');
  assert.match(app, /label="Pals"[^\n]*dot=\{palDot\}/u);
  assert.match(app, /tab === 'yumpals-saved' && palDot/u);
  assert.match(app, /\(gift waiting\)/u, 'screen readers hear it');
  const handheld = readFileSync(new URL('./YumPalsSavedHandheld.jsx', import.meta.url), 'utf8');
  assert.match(handheld, /markPalVisited\(ownerUid, visitedDate, hasPal\)/u);
});
