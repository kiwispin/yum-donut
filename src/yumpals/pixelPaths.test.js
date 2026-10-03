import test from 'node:test';
import assert from 'node:assert/strict';
import { pixelPaths } from './pixelPaths.js';
import { YUMPALS_SPRITES, YUMPALS_FOOD_PIXELS, YUMPALS_HEART_PIXELS } from './yumpalsSprites.js';
import { PAID_CARE_ICON_PIXELS } from './paidCareIcons.js';
import { PAID_CARE_PROP_PIXELS } from './paidCareDemo.js';

test('compact paths reconstruct every original pet frame, icon, food, heart and prop pixel exactly', () => {
  const drawings = [...Object.values(YUMPALS_SPRITES).flatMap(sprite => Object.values(sprite.frames)),
    ...Object.values(YUMPALS_FOOD_PIXELS), YUMPALS_HEART_PIXELS, ...Object.values(PAID_CARE_ICON_PIXELS), ...Object.values(PAID_CARE_PROP_PIXELS)];
  for (const pixels of drawings) {
    const result = pixels.map(row => Array(row.length).fill(null));
    const paths = pixelPaths(pixels);
    assert.equal(pixelPaths(pixels), paths, 'static paths are compiled only once');
    for (const [cell, d] of paths) for (const match of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
      const [, x, y, length, back] = match.map(Number);
      assert.equal(length, back);
      for (let i = x; i < x + length; i++) { assert.equal(result[y][i], null); result[y][i] = cell; }
    }
    assert.deepEqual(result.map(row => row.join('')), pixels);
  }
});
