import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PAID_CARE_ICON_HELP, paidCareHelpIcon } from './paidCareIcons.js';
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

test('icon help follows selection, hover and keyboard focus then restores the selection', () => {
    assert.deepEqual(Object.keys(PAID_CARE_ICON_HELP), PAID_CARE_ICON_ORDER);
    for (let index = 0; index < 8; index += 1) {
        assert.equal(paidCareHelpIcon(index, null, null), PAID_CARE_ICON_ORDER[index]);
        assert.equal(paidCareHelpIcon(0, index, null), PAID_CARE_ICON_ORDER[index]);
        assert.equal(paidCareHelpIcon(0, null, index), PAID_CARE_ICON_ORDER[index]);
        assert.ok(PAID_CARE_ICON_HELP[PAID_CARE_ICON_ORDER[index]].length > 15);
    }
    assert.equal(paidCareHelpIcon(2, 4, 3), 'clean');
    assert.equal(paidCareHelpIcon(2, null, 3), 'medicine');
    assert.equal(paidCareHelpIcon(2, null, null), 'game');
    assert.equal(paidCareHelpIcon(null, null, null), null);
    assert.match(PAID_CARE_ICON_HELP.status, /No charge/);
    assert.match(PAID_CARE_ICON_HELP.attention, /No charge/);
});

test('tabbing from hovered Food to Lights clears stale hover before showing focus help', () => {
    const source = readFileSync(new URL('./YumPalsHandheldDemo.jsx', import.meta.url), 'utf8');
    const focusBody = source.match(/onFocus=\{\(\) => \{([^}]+)\}\}/u)?.[1];
    assert.ok(focusBody, 'icon focus handler is present');
    let hovered = 0;
    let focused = 0;
    const onHover = (index) => { hovered = index; };
    const onFocusIcon = (index) => { focused = index; };
    const handleFocus = new Function('onHover', 'onFocusIcon', 'absoluteIndex', focusBody);
    handleFocus(onHover, onFocusIcon, 1);
    assert.equal(paidCareHelpIcon(0, hovered, focused), 'lights');
    onHover(3);
    assert.equal(paidCareHelpIcon(0, hovered, focused), 'medicine', 'fresh hover still takes over');
});
