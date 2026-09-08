import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { advancePreviewNeeds } from './elapsedDemo.js';
const require = createRequire(import.meta.url);
const { advanceElapsed, initialClock } = require('../../functions/src/yumpals/elapsedCare.js');
test('preview matches server wall-time needs through offline neglect', () => {
 const needs={hunger:4,happiness:4,cleanliness:4,health:4};
 for (const hours of [1,8,12,24,32,56,80,120]) {
  const server=advanceElapsed({needs,elapsedClock:initialClock(0)},{calendar:[{effectiveFrom:'1970-01-01',paused:false,holidays:[],absences:[]}]},hours*3600000,()=> '1970-01-01');
  assert.deepEqual(advancePreviewNeeds(needs,null,hours*60).needs,server.needs);
 }
});
