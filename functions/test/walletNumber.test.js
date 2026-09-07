const test = require('node:test');
const assert = require('node:assert/strict');
const { walletNumber, debitAfter } = require('../src/yumpals/walletNumber');

test('numeric wallet domain preserves fractions, tiny values and safe boundary without coercion', () => {
  for (const value of [0, 0.1, 1.1, 10.3, 30.5, Number.MIN_VALUE, Number.EPSILON, Number.MAX_SAFE_INTEGER]) assert.equal(walletNumber(value), true);
  for (const value of [undefined, null, false, true, '', '30', {}, [], NaN, Infinity, -Infinity, -1, -Number.MIN_VALUE, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(walletNumber(value), false);
    assert.equal(debitAfter(value, 1), null);
  }
  for (const [before, amount] of [[1.1, 1], [10.3, 2], [30.5, 5], [Number.MAX_SAFE_INTEGER, 1], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]]) {
    assert.equal(debitAfter(before, amount), before - amount);
    assert.equal(debitAfter(before, amount) + amount, before);
  }
  for (const before of [0, 0.1, Number.MIN_VALUE, Number.EPSILON]) assert.equal(debitAfter(before, 1), null);
  for (const amount of [0, -1, 0.1, 1.5, '1', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(debitAfter(30.5, amount), null);
  assert.equal(debitAfter(2 ** 52 - 0.5, 1), 2 ** 52 - 1.5);
  assert.equal(debitAfter(1.0000000000000002, 1), Number.EPSILON);
});
