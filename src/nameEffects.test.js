import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameEffect, nameEffectClass, avatarBorderClass, rowThemeClass, shopPreview } from './nameEffects.js';

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
    assert.equal(nameEffectClass({ rainbow_name: true }), 'rainbow-text');
});

test('a gold border beats a silver one, and no border is no class', () => {
    assert.equal(avatarBorderClass({ gold_border: true, silver_border: true }), 'gold-border');
    assert.equal(avatarBorderClass({ silver_border: true }), 'silver-border');
    assert.equal(avatarBorderClass({}), '');
    assert.equal(avatarBorderClass(undefined), '');
});

test('a Leaderboard row follows the name effect, then a gold border', () => {
    assert.equal(rowThemeClass({ neon_name: true, gold_border: true }), 'row-neon');
    assert.equal(rowThemeClass({ rainbow_name: true }), 'row-rainbow');
    assert.equal(rowThemeClass({ flame_name: true }), 'row-flame');
    assert.equal(rowThemeClass({ gold_border: true }), 'row-gold');
    assert.equal(rowThemeClass({ silver_border: true }), '');
    assert.equal(rowThemeClass(undefined), '');
});

test('the Shop previews only the items that change how a student looks', () => {
    assert.deepEqual(shopPreview('neon_name'), { neon_name: true });
    assert.equal(nameEffect(shopPreview('rainbow_name')), 'rainbow');
    assert.equal(avatarBorderClass(shopPreview('gold_border')), 'gold-border');
    assert.equal(shopPreview('raffle_ticket'), null);
    assert.equal(shopPreview('hot_chocolate'), null);
});
