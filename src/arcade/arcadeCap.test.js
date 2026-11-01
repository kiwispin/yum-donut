import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCADE_DAILY_CAP, arcadeEarnedOn, capArcadePrize } from './arcadeCap.js';

test('the daily arcade allowance is three donuts', () => {
    assert.equal(ARCADE_DAILY_CAP, 3);
});

test('only today\'s count is carried forward', () => {
    assert.equal(arcadeEarnedOn({ arcade_earned_today: 2, arcade_earned_date: '2026-11-02' }, '2026-11-02'), 2);
    assert.equal(arcadeEarnedOn({ arcade_earned_today: 2, arcade_earned_date: '2026-11-01' }, '2026-11-02'), 0);
    assert.equal(arcadeEarnedOn({}, '2026-11-02'), 0);
    assert.equal(arcadeEarnedOn(null, '2026-11-02'), 0);
});

test('a broken count does not block or inflate the allowance', () => {
    for (const value of [NaN, -1, 1.5, '2', null]) {
        assert.equal(arcadeEarnedOn({ arcade_earned_today: value, arcade_earned_date: '2026-11-02' }, '2026-11-02'), 0);
    }
});

test('prizes are trimmed to what is left of the allowance', () => {
    assert.equal(capArcadePrize(1, 0), 1);
    assert.equal(capArcadePrize(2, 1), 2);
    assert.equal(capArcadePrize(2, 2), 1);
    assert.equal(capArcadePrize(5, 0), 3);
    assert.equal(capArcadePrize(10, 1), 2);
    assert.equal(capArcadePrize(1, 3), 0);
    assert.equal(capArcadePrize(1, 7), 0);
});
