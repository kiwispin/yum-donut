import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('app navigation uses a labelled disclosure without sideways scrolling', () => {
  const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(source, /<AppNavigation activeView=\{view\}>/);
  assert.match(source, /aria-current=\{view === tab/);
  const component = readFileSync(new URL('./AppNavigation.jsx', import.meta.url), 'utf8');
  assert.match(component, /'give', 'goal', 'feed', 'arcade', 'bank', 'shop'/);
  assert.match(component, /const MORE_ONLY = new Set\(\['yumpals', 'yumpals-saved', 'training', 'yumpals-preview'\]\)/);
  assert.match(component, /!hasMoreOnly && total <= available/);
  assert.match(component, /ResizeObserver/);
  assert.match(component, /aria-expanded/);
  assert.doesNotMatch(component, /Explore YumDonut/);
  assert.match(component, /app-navigation-overflow/);
  assert.match(component, /ArrowDown/);
  assert.match(component, /Home/);
  assert.match(component, /onBlur/);
  assert.match(component, /Escape/);
  const css = readFileSync(new URL('./appNavigation.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /flex-wrap/);
  assert.doesNotMatch(css, /overflow-x: auto/);
  assert.match(css, /right: 0/);
  assert.match(css, /width: 232px/);
  assert.match(css, /prefers-reduced-motion/);
});
