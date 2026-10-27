const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, request } = require('./paidCareFixture');
const { createPaidCareService } = require('../src/yumpals/paidCareService');
const { givingDateKey, gaveOn } = require('../src/yumpals/givingCheer');

// 2026-09-07 is a Monday; the fixture clock starts at noon Auckland that day.
const MONDAY = 'Mon Sep 07 2026';
function cheerSetup({ happiness = 1, giving = { given_today: 2, last_given_date: MONDAY }, elapsedCare = false } = {}) {
  const f = setup({ needs: { hunger: 4, happiness, cleanliness: 4, health: 4 } });
  Object.assign(f.refs, { giving: uid => `fixture/profiles/${uid}`, cheer: (uid, date) => `fixture/cheers/${uid}/${date}` });
  if (giving) f.db.seed('fixture/profiles/student-a', { balance: 30, ...giving });
  let clock = Date.parse('2026-09-07T00:00:00Z');
  const service = createPaidCareService({ db: f.db, refs: f.refs, walletAdapter: f.walletAdapter, now: () => clock, elapsedCare });
  return { ...f, service, load: () => service.getHandheldState(request()), at: iso => { clock = Date.parse(iso); } };
}

test('gift dates from the browser and the Teams bot convert to Auckland date keys', () => {
  assert.equal(givingDateKey('Wed Oct 28 2026'), '2026-10-28');
  assert.equal(givingDateKey('Mon Sep 07 2026'), '2026-09-07');
  for (const bad of ['Tue Sep 07 2026', 'Mon Sep 7 2026', 'Mon Foo 07 2026', 'Mon Feb 30 2026', '2026-09-07', '', null, 42]) {
    assert.equal(givingDateKey(bad), null, String(bad));
  }
});

test('a new profile with today\'s date but nothing given is not a gift', () => {
  assert.equal(gaveOn({ given_today: 0, last_given_date: MONDAY }, '2026-09-07'), false);
  assert.equal(gaveOn({ given_today: 1, last_given_date: MONDAY }, '2026-09-07'), true);
  assert.equal(gaveOn({ given_today: '1', last_given_date: MONDAY }, '2026-09-07'), false);
  assert.equal(gaveOn(null, '2026-09-07'), false);
});

test('the first load after a gift adds one free heart, saved with an audit record', async () => {
  for (const elapsedCare of [false, true]) {
    const f = cheerSetup({ elapsedCare });
    const walletBefore = f.db.read('fixture/wallets/student-a');
    const view = await f.load();
    assert.deepEqual(view.cheer, { date: '2026-09-07', gain: 1 });
    assert.equal(view.pet.needs.happiness, 2);
    const saved = f.db.read('fixture/pets/student-a').paidCare;
    assert.equal(saved.cheerDate, '2026-09-07');
    assert.equal(saved.needs.happiness, 2);
    assert.equal(saved.daily.spent, 0, 'not counted toward the care cap');
    assert.deepEqual(f.db.read('fixture/wallets/student-a'), walletBefore, 'wallet untouched');
    const audit = f.db.read('fixture/cheers/student-a/2026-09-07');
    assert.equal(audit.amount, 0);
    assert.equal(audit.gain, 1);
    assert.equal(audit.needsBefore.happiness, 1);
    assert.equal(audit.needsAfter.happiness, 2);
  }
});

test('only once per day, however many loads or gifts', async () => {
  const f = cheerSetup();
  await f.load();
  f.db.seed('fixture/profiles/student-a', { balance: 30, given_today: 5, last_given_date: MONDAY });
  const again = await f.load();
  assert.equal(Object.hasOwn(again, 'cheer'), false);
  assert.equal(again.pet.needs.happiness, 2);
});

test('full happiness still cheers but adds nothing', async () => {
  const f = cheerSetup({ happiness: 4 });
  const view = await f.load();
  assert.deepEqual(view.cheer, { date: '2026-09-07', gain: 0 });
  assert.equal(view.pet.needs.happiness, 4);
  assert.equal(f.db.read('fixture/pets/student-a').paidCare.cheerDate, '2026-09-07');
});

test('no gift, an old gift, a fresh profile or a garbled date never cheer', async () => {
  for (const giving of [null, { given_today: 3, last_given_date: 'Sun Sep 06 2026' }, { given_today: 0, last_given_date: MONDAY }, { given_today: 2, last_given_date: 'yesterday' }]) {
    const f = cheerSetup({ giving });
    const view = await f.load();
    assert.equal(Object.hasOwn(view, 'cheer'), false, JSON.stringify(giving));
    assert.equal(view.pet.needs.happiness, 1);
    assert.equal(f.db.read('fixture/pets/student-a').paidCare.cheerDate, undefined);
  }
});

test('weekends, calendar holidays, pauses, Holiday Mode and a disabled YumPals rest', async () => {
  const weekend = cheerSetup({ giving: { given_today: 1, last_given_date: 'Sat Sep 12 2026' } });
  weekend.at('2026-09-12T00:00:00Z');
  assert.equal(Object.hasOwn(await weekend.load(), 'cheer'), false, 'Saturday');

  // Calendar changes are effective-dated (history is immutable), so these run on Tuesday.
  const TUESDAY = { given_today: 1, last_given_date: 'Tue Sep 08 2026' };
  const from = (entry) => config => ({ ...config, calendar: [...config.calendar, { effectiveFrom: '2026-09-08', paused: false, holidays: [], absences: [], ...entry }] });
  const changes = [
    ['calendar holiday', from({ holidays: ['2026-09-08'] })],
    ['calendar pause', from({ paused: true })],
    ['absence', from({ absences: [{ from: '2026-09-08', to: '2026-09-09' }] })],
    ['YumPals disabled', config => ({ ...config, enabled: false })],
    ['control', config => config],
  ];
  for (const [label, change] of changes) {
    const f = cheerSetup({ giving: TUESDAY });
    f.at('2026-09-08T00:00:00Z');
    f.db.seed(f.refs.config('student-a'), change(f.db.read(f.refs.config('student-a'))));
    const view = await f.load();
    assert.equal(Object.hasOwn(view, 'cheer'), label === 'control', label);
  }

  const holiday = cheerSetup();
  Object.assign(holiday.refs, { holidayGlobal: () => 'fixture/global', holidayHistory: () => 'fixture/holidayHistory' });
  holiday.db.seed('fixture/global', { holiday_mode: true });
  holiday.db.seed('fixture/holidayHistory', { enabled: true, periods: [{ from: Date.parse('2026-09-06T00:00:00Z'), to: null }] });
  assert.equal(Object.hasOwn(await holiday.load(), 'cheer'), false, 'Holiday Mode');
});

test('without the giving refs the load behaves exactly as before', async () => {
  const f = setup({ needs: { hunger: 4, happiness: 1, cleanliness: 4, health: 4 } });
  f.db.seed('fixture/profiles/student-a', { given_today: 2, last_given_date: MONDAY });
  const view = await f.service.getHandheldState(request());
  assert.equal(Object.hasOwn(view, 'cheer'), false);
  assert.equal(view.pet.needs.happiness, 1);
});

test('a pal with no pet never reads or writes a cheer', async () => {
  const f = setup({ pet: false });
  Object.assign(f.refs, { giving: () => { throw new Error('should not read giving'); }, cheer: () => { throw new Error('should not write'); } });
  const view = await f.service.getHandheldState(request());
  assert.equal(view.pet, null);
});
