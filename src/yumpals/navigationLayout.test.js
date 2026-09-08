import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('app navigation uses a labelled disclosure without sideways scrolling', () => {
  const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(source, /<AppNavigation activeView=\{view\}>/);
  assert.match(source, /aria-current=\{view === tab/);
  const component = readFileSync(new URL('./AppNavigation.jsx', import.meta.url), 'utf8');
  assert.match(component, /'give', 'yumpals', 'yumpals-saved'/);
  assert.match(component, /aria-expanded/);
  assert.match(component, /Explore YumDonut/);
  assert.match(component, /Escape/);
  const css = readFileSync(new URL('./appNavigation.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /flex-wrap/);
  assert.doesNotMatch(css, /overflow-x: auto/);
});
