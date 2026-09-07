import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAID_CARE_ICON_LABELS, PAID_CARE_ICON_MENU_IDS, PAID_CARE_ICON_ORDER, PAID_CARE_ICON_PIXELS, paidCareIconPixelsAreRectangular } from './paidCareIcons.js';

test('paid-care icons match the Gen 1 top/bottom order and have unique 8x8 grids', () => {
    assert.deepEqual(PAID_CARE_ICON_ORDER, ['food', 'lights', 'game', 'medicine', 'clean', 'status', 'discipline', 'attention']);
    assert.equal(new Set(PAID_CARE_ICON_ORDER).size, 8);
    assert.equal(paidCareIconPixelsAreRectangular(), true);
    for (const id of PAID_CARE_ICON_ORDER) {
        assert.ok(PAID_CARE_ICON_LABELS[id]);
        assert.ok(PAID_CARE_ICON_PIXELS[id].every((row) => [...row].every((cell) => cell === '.' || cell === 'a')));
    }
});

test('action icons resolve to non-empty secondary menus without replacing status or attention', () => {
    assert.deepEqual(PAID_CARE_ICON_MENU_IDS, {
        food: 'food',
        lights: 'lights',
        game: 'play',
        medicine: 'medicine',
        clean: 'clean',
        discipline: 'reminder',
    });
    assert.equal(PAID_CARE_ICON_MENU_IDS.status, undefined);
    assert.equal(PAID_CARE_ICON_MENU_IDS.attention, undefined);
});
