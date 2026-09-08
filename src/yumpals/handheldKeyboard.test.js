import test from 'node:test';
import assert from 'node:assert/strict';
import { ignoreHandheldKey } from './handheldKeyboard.js';
test('hardware and icon focus allow letter shortcuts but preserve native activation', () => {
 const button = { closest: () => true };
 const target = { closest: selector => selector === 'button' ? button : null };
 for (const key of ['a','b','c','Escape','ArrowRight']) assert.equal(ignoreHandheldKey({key,target}),false);
 for (const key of ['Enter',' ']) assert.equal(ignoreHandheldKey({key,target}),true);
 assert.equal(ignoreHandheldKey({key:'a',target,repeat:true}),true);
 assert.equal(ignoreHandheldKey({key:'a',target,metaKey:true}),true);
 assert.equal(ignoreHandheldKey({key:'a',target:{isContentEditable:true}}),true);
 assert.equal(ignoreHandheldKey({key:'a',target:{closest:()=>({closest:()=>false})}}),true);
});
