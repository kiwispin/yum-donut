import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedVisibility } from './useSavedVisibility.js';
test('saved visibility requires an enabled confirmed response belonging to this account', () => {
  assert.equal(confirmedVisibility({ schemaVersion: 1, ownerUid: 'a', enabled: true }, 'a'), true);
  for (const value of [null, {}, {schemaVersion:1,ownerUid:'a',enabled:false}, {schemaVersion:1,ownerUid:'b',enabled:true}, {schemaVersion:1,ownerUid:'a',enabled:'true'}]) {
    assert.equal(confirmedVisibility(value,'a'), false);
  }
});
