import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('./YumPalsSavedHandheld.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./savedHandheld.css', import.meta.url), 'utf8');
const surround = readFileSync(new URL('./appSurround.css', import.meta.url), 'utf8');

function rule(css, selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')} \\{([^}]*)\\}`, 'u'));
  assert.ok(match, `missing ${selector} rule`);
  return match[1];
}

// Replaces the September guard for separate queue and sync boxes (owner-approved
// tidy-up, 28 October 2026): the rule it protected, that messages never move the
// page, now holds through one reserved status line above the device.
test('waiting care shares the reserved status line, so no message moves the page', () => {
  assert.doesNotMatch(component, /saved-queue-status|saved-sync/u, 'separate queue and sync boxes are gone');
  assert.match(component, /localMessage \|\| pendingMessage \|\| note \|\|/u, 'waiting care shows in the status line');
  assert.match(component, /Saving care…\$\{donutsAfter\}/u);
  assert.match(component, /needs checking\. Tap Reconnect\./u);

  const reserved = rule(styles, '.saved-top-status');
  for (const declaration of ['height: 2.8em', 'min-height: 2.8em', 'box-sizing: border-box']) assert.match(reserved, new RegExp(declaration.replace('.', '\\.'), 'u'));
  const withText = rule(surround, ".yumpals-embedded-saved .saved-handheld > p.saved-top-status[role='status']:not(:empty)");
  assert.match(withText, /min-height: 2\.8em/u, 'a one-line message fits the reserved height');
  assert.match(surround, /@media \(max-width: 360px\) \{[^@]*min-height: 4\.4em/u, 'narrow phones reserve two lines');

  assert.match(component, /className="paid-hint-size" aria-hidden="true"/u, 'the hint keeps its hidden sizing text');
  const hint = rule(surround, '.yumpals-embedded-saved .saved-handheld > p.saved-help.paid-demo-hint');
  assert.doesNotMatch(hint, /display:|height:/u);
});
