const test = require('node:test');
const assert = require('node:assert/strict');
const { initialClock, advanceElapsed } = require('../src/yumpals/elapsedCare');
const { aucklandNow } = require('../src/yumpals/paidCareEngine');
const HOUR = 3600000;
const start = Date.parse('2026-09-07T10:00:00+12:00');
const config = { calendar: [{effectiveFrom:'2026-01-01',paused:false,holidays:[],absences:[]}], pauses:[] };
const state = () => ({ needs:{hunger:4,happiness:4,cleanliness:4,health:4},elapsedClock:initialClock(start) });
const advance = (s, hours, c = config) => advanceElapsed(s,c,start+hours*HOUR,ms=>aucklandNow(ms).date);
test('offline wall time creates care needs without midnight or login duration',()=>{
 assert.equal(advance(state(),7.99).needs.hunger,4);
 assert.deepEqual(advance(state(),24).needs,{hunger:1,happiness:2,cleanliness:3,health:4});
});
test('frequent reads and one offline catch-up produce identical state',()=>{
 let s=state();for(let i=1;i<=120;i++)s=advance(s,i/4);
 assert.deepEqual(s,advance(state(),30));
 assert.deepEqual(advance(s,30),s);
 assert.throws(()=>advance(s,29),{code:'CLOCK_REVERSED'});
});
test('existing pets start a clock without losing existing needs',()=>{
 const s={needs:{hunger:2,happiness:3,cleanliness:1,health:4}};
 assert.deepEqual(advance(s,200).needs,s.needs);
});
test('holidays and disabled-date intervals freeze time, weekends do not',()=>{
 const paused={...config,pauses:[{from:'2026-09-07',to:'2026-09-08'}]};
 assert.deepEqual(advance(state(),24,paused).needs,state().needs);
 const weekend={...state(),elapsedClock:initialClock(Date.parse('2026-09-12T10:00:00+12:00'))};
 assert.equal(advanceElapsed(weekend,config,weekend.elapsedClock.at+8*HOUR,ms=>aucklandNow(ms).date).needs.hunger,3);
});
test('health declines only after sustained depleted needs; meters never become debt',()=>{
 assert.equal(advance(state(),55).needs.health,4);
 assert.equal(advance(state(),56).needs.health,3);
 assert.deepEqual(advance(state(),240).needs,{hunger:0,happiness:0,cleanliness:0,health:0});
});
test('DST uses actual hours rather than date-length assumptions',()=>{
 const s=state();s.elapsedClock=initialClock(Date.parse('2026-09-27T00:00:00+12:00'));
 const next=advanceElapsed(s,config,s.elapsedClock.at+8*HOUR,ms=>aucklandNow(ms).date);
 assert.equal(next.needs.hunger,3);
});
