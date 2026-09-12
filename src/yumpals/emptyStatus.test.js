import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('./YumPalsSavedHandheld.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./savedHandheld.css', import.meta.url), 'utf8');

function rule(selector) {
  const match = styles.match(new RegExp(`${selector} \\{([^}]*)\\}`, 'u'));
  assert.ok(match, `missing ${selector} rule`);
  return match[1];
}

test('empty queue and sync statuses hide chrome without giving back reserved layout', () => {
  assert.match(component, /className=\{`saved-queue-status \$\{hasQueue \? 'has-content' : 'is-empty'\}`\}/u);
  assert.match(component, /className=\{`saved-sync \$\{syncMessage \? 'has-content' : 'is-empty'\}`\}/u);

  const queueBase = rule('\\.saved-queue-status');
  const queueEmpty = rule('\\.saved-queue-status\\.is-empty');
  const syncEmpty = rule("\\.yumpals-embedded-saved \\.saved-handheld > p\\.saved-sync\\.is-empty\\[role='status'\\]");
  for (const declaration of ['height: 4.6em', 'min-height: 4.6em', 'margin: 10px auto']) assert.match(queueBase, new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.match(queueEmpty, /background: transparent/u); assert.match(queueEmpty, /border-color: transparent/u); assert.match(queueEmpty, /box-shadow: none/u);
  assert.match(syncEmpty, /background: transparent/u); assert.match(syncEmpty, /border-color: transparent/u); assert.match(syncEmpty, /box-shadow: none/u);
  assert.doesNotMatch(queueEmpty, /height:|margin:|padding:/u); assert.doesNotMatch(syncEmpty, /height:|margin:|padding:/u);
});
