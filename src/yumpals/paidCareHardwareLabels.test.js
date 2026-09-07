import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('casing labels and accessible names stay A SELECT, B CONFIRM, C CANCEL in every screen state', () => {
    const source = readFileSync(new URL('./YumPalsHandheldDemo.jsx', import.meta.url), 'utf8');
    const hardware = source.split('aria-label="YumPals hardware controls">')[1].split('</div>')[0];
    const buttons = [...hardware.matchAll(/<button\b[\s\S]*?<\/button>/gu)].map(([button]) => button);
    assert.equal(buttons.length, 3);
    for (const [index, [letter, label]] of [['A', 'SELECT'], ['B', 'CONFIRM'], ['C', 'CANCEL']].entries()) {
        assert.ok(buttons[index].includes(`aria-label="${letter} ${label}"`));
        assert.ok(buttons[index].includes(`<strong>${letter}</strong><span>${label}</span>`));
    }
    assert.ok(source.includes('A SELECT · B CONFIRM · C CANCEL'));
    assert.ok(source.includes('A = LEFT · B = RIGHT'), 'game directions remain inside the LCD');
});
