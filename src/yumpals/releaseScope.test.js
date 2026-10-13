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
