const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, request } = require('./paidCareFixture');
const { createPaidCareService } = require('../src/yumpals/paidCareService');
test('disabled school period is excluded on return without losing pet data',async()=>{
 const f=setup();let now=Date.parse('2026-09-07T00:00:00Z');
 const service=createPaidCareService({...f,now:()=>now,elapsedCare:true});
 await service.getHandheldState(request());
 const c=f.db.read(f.refs.config('student-a'));
 f.db.seed(f.refs.config('student-a'),{...c,enabled:false,pauses:[{from:'2026-09-07',to:null}]});
 now+=48*3600000;
 assert.equal((await service.getHandheldState(request())).enabled,false);
 f.db.seed(f.refs.config('student-a'),{...c,enabled:true,pauses:[{from:'2026-09-07',to:'2026-09-09'}]});
 assert.deepEqual((await service.getHandheldState(request())).pet.needs,{hunger:4,happiness:4,cleanliness:4,health:4});
});
test('saved clock persists once, catches up offline, and never debits on read',async()=>{
 const f=setup();let now=Date.parse('2026-09-07T00:00:00Z');
 const service=createPaidCareService({...f,now:()=>now,elapsedCare:true});
 const before=f.db.read('fixture/wallets/student-a');
 await service.getHandheldState(request());
 now+=24*3600000;
 const next=await service.getHandheldState(request());
 assert.deepEqual(next.pet.needs,{hunger:1,happiness:2,cleanliness:3,health:4});
 assert.deepEqual(f.db.read('fixture/wallets/student-a'),before);
 assert.deepEqual((await service.getHandheldState(request())).pet.needs,next.pet.needs);
 const purchase=request('student-a',{action:'meal',operationId:'elapsed-meal',expectedConfigVersion:next.configVersion,expectedConfigHash:next.configHash});
 await service.purchase(purchase);await service.purchase(purchase);
 assert.equal(f.db.read('fixture/wallets/student-a').balance,before.balance-2);
});
