import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('app navigation has a single scrollable row with explicit controls and active item visibility', () => {
  const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(source, /<AppNavigation activeView=\{view\}>/);
  assert.match(source, /aria-current=\{view === tab/);
  const component = readFileSync(new URL('./AppNavigation.jsx', import.meta.url), 'utf8');
  assert.match(component, /Show more navigation items/);
  assert.match(component, /Show previous navigation items/);
  assert.match(component, /ResizeObserver/);
  assert.match(component, /prefers-reduced-motion/);
  const css = readFileSync(new URL('./appNavigation.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /flex-wrap/);
  assert.match(css, /overflow-x: auto/);
});
