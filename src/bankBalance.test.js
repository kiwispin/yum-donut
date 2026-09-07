import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBankBalance, resolveBankBalance } from './bankBalance.js';

test('legacy missing public bank permits a first deposit without losing savings', () => {
    assert.equal(resolveBankBalance(0, undefined), 0);
    assert.equal(resolveBankBalance(156, undefined), 156);
    assert.equal(resolveBankBalance(undefined, 156), 156);
    assert.equal(resolveBankBalance(undefined, undefined), 0);
});

test('corrupted or conflicting balances remain blocked', () => {
    for (const value of [NaN, Infinity, -1, null, '0']) {
        assert.equal(getBankBalance(value), null);
        assert.equal(resolveBankBalance(156, value), null);
    }
    assert.equal(resolveBankBalance(156, 206), null);
    assert.equal(resolveBankBalance(206, 206), 206);
});
