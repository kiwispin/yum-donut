import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameEffect, nameEffectClass } from './nameEffects.js';

test('a bought Neon Name shows even when the student also has rainbow or flame', () => {
    assert.equal(nameEffect({ neon_name: true, flame_name: true }), 'neon');
    assert.equal(nameEffect({ neon_name: true, rainbow_name: true, flame_name: true }), 'neon');
});

test('a bought Rainbow Name beats the flame earned in typing training', () => {
    assert.equal(nameEffect({ rainbow_name: true, flame_name: true }), 'rainbow');
    assert.equal(nameEffect({ flame_name: true }), 'flame');
});

test('a student with no effect, or no profile yet, gets the plain style', () => {
    assert.equal(nameEffect({}), null);
    assert.equal(nameEffect(undefined), null);
    assert.equal(nameEffectClass({}, 'text-slate-800'), 'text-slate-800');
    assert.equal(nameEffectClass(null), '');
});

test('each effect maps to its CSS class', () => {
    assert.equal(nameEffectClass({ neon_name: true }, 'text-slate-800'), 'neon-text');
    assert.equal(nameEffectClass({ flame_name: true }), 'flame-text');
    assert.match(nameEffectClass({ rainbow_name: true }), /animate-text-rainbow/);
});
