import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payForGift } from './giving.js';

test('a gift comes out of the wallet when it can cover it', () => {
    assert.deepEqual(payForGift({ wallet: 10, bank: 50 }, 3), { wallet: 7, bank: 50 });
    assert.deepEqual(payForGift({ wallet: 3, bank: 0 }, 3), { wallet: 0, bank: 0 });
});

test('the bank covers whatever the wallet cannot', () => {
    assert.deepEqual(payForGift({ wallet: 2, bank: 50 }, 5), { wallet: 0, bank: 47 });
    assert.deepEqual(payForGift({ wallet: 0, bank: 5 }, 5), { wallet: 0, bank: 0 });
});

test('a gift is refused when wallet and bank together are short', () => {
    assert.equal(payForGift({ wallet: 2, bank: 2 }, 5), null);
    assert.equal(payForGift({ wallet: 0, bank: 0 }, 1), null);
});
