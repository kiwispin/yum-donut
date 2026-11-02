import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeekKey, stockLeft, shopLimitBlock } from './shopLimits.js';

test('weeks run Monday to Sunday', () => {
    assert.equal(getWeekKey('2026-11-02'), '2026-11-02'); // Monday
    assert.equal(getWeekKey('2026-11-06'), '2026-11-02'); // Friday
    assert.equal(getWeekKey('2026-11-08'), '2026-11-02'); // Sunday
    assert.equal(getWeekKey('2026-11-09'), '2026-11-09'); // next Monday
    assert.equal(getWeekKey('2027-01-01'), '2026-12-28'); // across the new year
});

test('stock left never goes below zero, and no stock means no stock limit', () => {
    assert.equal(stockLeft(3, 1), 2);
    assert.equal(stockLeft(3, 5), 0);
    assert.equal(stockLeft(null, 5), null);
});

test('an item with no limits can always be bought', () => {
    assert.equal(shopLimitBlock({ dailyLimit: null, weeklyLimit: null, dailyStock: null, purchasedToday: 9 }), null);
});

test('a stock of 0 switches the item off', () => {
    assert.equal(shopLimitBlock({ dailyStock: 0 }), 'off');
});

test('shared stock sells out for everyone', () => {
    assert.equal(shopLimitBlock({ dailyStock: 3, soldToday: 2 }), null);
    assert.equal(shopLimitBlock({ dailyStock: 3, soldToday: 3 }), 'sold_out');
});

test('one a week per person, and the per-person daily limit still applies', () => {
    assert.equal(shopLimitBlock({ dailyStock: 3, soldToday: 1, weeklyLimit: 1, purchasedThisWeek: 1 }), 'weekly');
    assert.equal(shopLimitBlock({ dailyStock: 3, soldToday: 1, weeklyLimit: 1, purchasedThisWeek: 0 }), null);
    assert.equal(shopLimitBlock({ dailyLimit: 2, purchasedToday: 2 }), 'daily');
});
