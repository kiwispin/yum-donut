import assert from 'node:assert/strict';
import { test } from 'node:test';
import { YUMPALS_SPRITES } from './yumpalsSprites.js';

test('every original creature sprite is a rectangular 16x16 pixel grid', () => {
    for (const sprite of Object.values(YUMPALS_SPRITES)) {
        assert.equal(sprite.pixels.length, 16, `${sprite.name} row count`);
        for (const row of sprite.pixels) assert.equal([...row].length, 16, `${sprite.name} row width`);
    }
});
