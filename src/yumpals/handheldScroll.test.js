import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handheldScrollTarget, PHONE_QUERY } from './handheldScroll.js';

// Live measurements, 390×844 phone: device 513px tall starting at 453px,
// pinned header 80px, bottom icon bar 73px.
const phone = { deviceTop: 453, deviceHeight: 513, scrollY: 0, viewportHeight: 844, topInset: 80, bottomInset: 73 };

test('on a 390×844 phone the handheld is centred between the header and bottom bar', () => {
  const target = handheldScrollTarget(phone);
  const onScreenTop = phone.deviceTop - target;
  assert.ok(onScreenTop >= 88, 'below the pinned header');
  assert.ok(onScreenTop + phone.deviceHeight <= 844 - 73 - 8, 'above the bottom icon bar');
  assert.equal(Math.round(onScreenTop - 88), Math.round((844 - 73 - 8) - (onScreenTop + 513)), 'centred');
});

test('a handheld already fully visible is left alone', () => {
  assert.equal(handheldScrollTarget({ ...phone, deviceTop: 200 }), null);
});

test('when the handheld is taller than the free space, its top goes right under the header', () => {
  const se = { ...phone, viewportHeight: 560 };
  const target = handheldScrollTarget(se);
  assert.equal(se.deviceTop - target, 80);
});

test('the target accounts for the current scroll and never goes negative', () => {
  assert.equal(handheldScrollTarget({ ...phone, scrollY: 100, deviceTop: 353 }), handheldScrollTarget(phone));
  assert.equal(handheldScrollTarget({ ...phone, deviceTop: -50, scrollY: 0 }), 0);
});

test('the saved handheld scrolls only once, only on phones, and not after the student scrolls', () => {
  const component = readFileSync(new URL('./YumPalsSavedHandheld.jsx', import.meta.url), 'utf8');
  assert.equal(PHONE_QUERY, '(max-width: 767px)', 'matches the bottom icon bar breakpoint (md:hidden)');
  assert.match(component, /autoScrolled\.current/u);
  assert.match(component, /userScrolled\.current/u);
  assert.match(component, /prefers-reduced-motion: reduce/u);
});
