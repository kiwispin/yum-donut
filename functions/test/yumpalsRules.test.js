const assert = require('node:assert/strict');
const test = require('node:test');
const { getAucklandDateParts, growthForCareDays } = require('../src/yumpals/rules');

test('backend rules keep milestone stages and earned unlocks stable', () => {
  assert.equal(growthForCareDays(5, 'standard').stage, 'budding');
  assert.equal(growthForCareDays(10, 'standard').stage, 'junior');
  assert.deepEqual(growthForCareDays(5, 'gentle', ['trick', 'accessory']).completed, ['trick', 'accessory']);
});

test('backend Auckland date helper handles both sides of 2026 DST transitions', () => {
  assert.equal(getAucklandDateParts(Date.parse('2026-04-04T13:59:59.000Z')).dateKey, '2026-04-05');
  assert.equal(getAucklandDateParts(Date.parse('2026-04-04T14:00:00.000Z')).dateKey, '2026-04-05');
  assert.equal(getAucklandDateParts(Date.parse('2026-09-26T13:59:59.000Z')).dateKey, '2026-09-27');
  assert.equal(getAucklandDateParts(Date.parse('2026-09-26T14:00:00.000Z')).dateKey, '2026-09-27');
});
