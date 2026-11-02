import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('espree');
function handlers(source) {
  const result = new Map();
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && /^handle/u.test(node.id?.name || '') && node.init) {
      const key = node.id.name; const values = result.get(key) || [];
      values.push(source.slice(...node.init.range)); result.set(key, values);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true, ecmaFeatures: { jsx: true } }));
  return result;
}
test('YumPals-only release preserves every existing named action handler from the pre-rebuild baseline', () => {
  const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const baseline = execFileSync('git', ['show', '5cc08a4:src/App.jsx'], { encoding: 'utf8', maxBuffer: 2_000_000 });
  const original = handlers(baseline); const current = handlers(source);
  assert.ok(original.size > 30);
  for (const [name, bodies] of original) {
    if (name === 'handleHolidayToggle') { // Explicitly approved connection of Holiday Mode to pet-clock pauses.
      assert.match(current.get(name)[0], /yumpalsSetHolidayMode/);
      continue;
    }
    if (name === 'handleAddUser') {
      assert.match(current.get(name)[0], /yumpalsManageStudentAccount/);
      assert.match(current.get(name)[0], /action: 'add'/);
      continue;
    }
    if (name === 'handleWinBonus') { // Explicitly approved shared daily cap on Arcade donut prizes.
      assert.match(current.get(name)[0], /capArcadePrize\(won, earnedToday, held\)/);
      assert.match(current.get(name)[0], /arcade_earned_today/);
      continue;
    }
    if (name === 'handlePayInterest') { // Explicitly approved: bank interest is switched off.
      assert.equal(current.has(name), false);
      continue;
    }
    if (name === 'handlePurchase') { // Explicitly approved weekly limit and shared daily stock (hot chocolate).
      assert.match(current.get(name)[0], /shopLimitBlock\(\{ weeklyLimit, purchasedThisWeek, dailyStock, soldToday \}\)/);
      assert.match(current.get(name)[0], /DAILY_SHOP_LIMIT/);
      continue;
    }
    if (name === 'handleSaveShopItem') { // Explicitly approved: saves the weekly limit and daily stock too.
      assert.match(current.get(name)[0], /weeklyLimit: newWeeklyLimit/);
      assert.match(current.get(name)[0], /dailyStock: newDailyStock/);
      continue;
    }
    if (name === 'handleGiveDonut') { // Explicitly approved: students' gifts come out of their wallet, then bank.
      assert.match(current.get(name)[0], /payForGift\(\{ wallet, bank \}, totalAmount\)/);
      assert.match(current.get(name)[0], /DAILY_LIMIT/);
      continue;
    }
    if (name === 'handleResetPassword') {
      assert.match(current.get(name)[0], /yumpalsManageStudentAccount/);
      assert.match(current.get(name)[0], /action: 'set-password'/);
      continue;
    }
    assert.deepEqual(current.get(name), bodies, `${name} must remain parked, not replaced`);
  }
  assert.equal(source.includes('ProtectedBankView'), false);
  assert.equal(source.includes('createProtectedGift'), false);
});
