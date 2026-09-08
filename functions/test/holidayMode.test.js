const test = require('node:test');
const assert = require('node:assert/strict');
const { FakeDb } = require('./paidCareFixture');
const { createHolidayMode, withHolidayMode } = require('../src/yumpals/holidayMode');
const { advanceElapsed, initialClock } = require('../src/yumpals/elapsedCare');
class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }
test('Holiday Mode and private clock history commit atomically and replay safely',async()=>{
 const db=new FakeDb();db.seed('global',{holiday_mode:false,keep:42});let time=100;
 const change=createHolidayMode({db,globalRef:'global',historyRef:'history',receiptRef:(_,id)=>`receipt/${id}`,HttpsError,now:()=>time});
 const auth={uid:'teacher',token:{yumpalsAdmin:true,firebase:{sign_in_provider:'password'}}};
 const on={auth,data:{enabled:true,expected:false,operationId:'on'}};
 db.failCommit=true;await assert.rejects(change(on));assert.equal(db.read('global').holiday_mode,false);assert.equal(db.read('history'),undefined);
 await change(on);time=200;await change({auth,data:{enabled:false,expected:true,operationId:'off'}});await change(on);
 assert.deepEqual(db.read('history'),{enabled:false,periods:[{from:100,to:200}]});
 assert.deepEqual(db.read('global'),{holiday_mode:false,keep:42});
 await assert.rejects(change({...on,auth:{uid:'student',token:{}}}),{code:'permission-denied'});
 const refs={holidayGlobal:()=> 'global',holidayHistory:()=> 'history'};
 assert.equal((await db.runTransaction(t=>withHolidayMode(t,{enabled:true},refs))).enabled,true);
 db.seed('global',{holiday_mode:true});assert.equal((await db.runTransaction(t=>withHolidayMode(t,{enabled:true},refs))).enabled,false);
});
test('offline holiday excludes exact partial-hour interval, not the whole start/end days',()=>{
 const hour=3600000;const state={needs:{hunger:4,happiness:4,cleanliness:4,health:4},elapsedClock:initialClock(0)};
 const config={calendar:[{effectiveFrom:'1970-01-01',paused:false,holidays:[],absences:[]}],holidayPeriods:[{from:3.5*hour,to:27.5*hour}]};
 const advance=h=>advanceElapsed(state,config,h*hour,()=> '1970-01-01');
 assert.equal(advance(31.9).needs.hunger,4);assert.equal(advance(32).needs.hunger,3);
});
