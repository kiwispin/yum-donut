import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('app navigation wraps complete labels instead of hiding the preview offscreen', () => {
  const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const nav = source.match(/<div className="([^"]+)" aria-label="App navigation">([\s\S]*?)<\/div>/);
  assert.ok(nav);
  assert.ok(nav[1].split(' ').includes('flex-wrap'));
  assert.doesNotMatch(nav[1], /overflow-x-auto|no-scrollbar/);
  assert.match(nav[2], /shrink-0/);
  assert.match(nav[2], /YumPals preview/);
});
