import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeekKey, stockLeft, shopLimitBlock, aucklandHour, aucklandWeekday, isFoodOpen, isFoodOpenAt } from './shopLimits.js';

test('food and drink are on sale from 7am until 5pm', () => {
    assert.equal(isFoodOpen(6, 1), false);
    assert.equal(isFoodOpen(7, 1), true);
    assert.equal(isFoodOpen(16, 5), true);
    assert.equal(isFoodOpen(17, 3), false);
    assert.equal(isFoodOpen(0, 3), false);
});

test('food and drink are not on sale at the weekend', () => {
    assert.equal(isFoodOpen(10, 6), false); // Saturday
    assert.equal(isFoodOpen(10, 0), false); // Sunday
});

test('the weekday is read on Auckland time', () => {
    assert.equal(aucklandWeekday(new Date('2026-11-02T20:30:00Z')), 2); // Tuesday 9:30am in Auckland, Monday in UTC
    assert.equal(aucklandWeekday(new Date('2026-11-06T22:00:00Z')), 6); // Saturday 11am
    assert.equal(isFoodOpenAt(new Date('2026-11-02T20:30:00Z')), true);
    assert.equal(isFoodOpenAt(new Date('2026-11-06T22:00:00Z')), false);
    assert.equal(isFoodOpenAt(new Date('2026-11-06T03:59:00Z')), true); // Friday 4:59pm
    assert.equal(isFoodOpenAt(new Date('2026-11-06T04:00:00Z')), false); // Friday 5pm
});

test('the hour is read on Auckland time', () => {
    assert.equal(aucklandHour(new Date('2026-11-02T20:30:00Z')), 9); // NZDT, UTC+13
    assert.equal(aucklandHour(new Date('2026-06-01T05:00:00Z')), 17); // NZST, UTC+12
    assert.equal(aucklandHour(new Date('2026-11-02T11:00:00Z')), 0); // midnight
});

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
