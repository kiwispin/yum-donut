import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedVisibility } from './useSavedVisibility.js';
test('saved visibility requires an enabled confirmed response belonging to this account', () => {
  assert.equal(confirmedVisibility({ schemaVersion: 1, ownerUid: 'a', enabled: true }, 'a'), true);
  for (const value of [null, {}, {schemaVersion:1,ownerUid:'a',enabled:false}, {schemaVersion:1,ownerUid:'b',enabled:true}, {schemaVersion:1,ownerUid:'a',enabled:'true'}]) {
    assert.equal(confirmedVisibility(value,'a'), false);
  }
});

test('the last YumPals answer is remembered per student on this device', async () => {
  const { rememberedVisibility, rememberVisibility } = await import('./useSavedVisibility.js');
  const values = new Map(); const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  assert.equal(rememberedVisibility('a', storage), false, 'nothing remembered yet');
  rememberVisibility('a', true, storage);
  assert.equal(rememberedVisibility('a', storage), true);
  assert.equal(rememberedVisibility('b', storage), false, 'per student');
  rememberVisibility('a', false, storage);
  assert.equal(rememberedVisibility('a', storage), false, 'switched off is remembered too');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(rememberedVisibility('a', broken), false); assert.doesNotThrow(() => rememberVisibility('a', true, broken));
  assert.equal(rememberedVisibility('', storage), false);
});
