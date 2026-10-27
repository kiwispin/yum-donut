const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, request } = require('./paidCareFixture');
const { createPaidCareService } = require('../src/yumpals/paidCareService');

const DAY = 86400000;
const NOW = Date.parse('2026-09-07T00:00:00Z'); // Monday noon Auckland.
const clockAt = at => ({ version: 1, at, hunger: 0, happiness: 0, cleanliness: 0, health: 0 });

function visitSetup({ needs = { hunger: 1, happiness: 3, cleanliness: 2, health: 4 }, lastSeen = NOW - 2 * 3600000, giving = null } = {}) {
  const f = setup({ needs });
  Object.assign(f.refs, { visit: (uid, date) => `fixture/visits/${uid}/${date}` });
  if (giving) {
    Object.assign(f.refs, { giving: uid => `fixture/profiles/${uid}`, cheer: (uid, date) => `fixture/cheers/${uid}/${date}` });
    f.db.seed('fixture/profiles/student-a', giving);
  }
  const pet = f.db.read('fixture/pets/student-a');
  if (lastSeen !== null) pet.paidCare.elapsedClock = clockAt(lastSeen);
  f.db.seed('fixture/pets/student-a', pet);
  let clock = NOW;
  const service = createPaidCareService({ db: f.db, refs: f.refs, walletAdapter: f.walletAdapter, now: () => clock, elapsedCare: true });
  return { ...f, load: () => service.getHandheldState(request()), at: ms => { clock = ms; } };
}

test('the first visit of the day gives one free heart in the lowest need, with a record', async () => {
  const f = visitSetup();
  const walletBefore = f.db.read('fixture/wallets/student-a');
  const view = await f.load();
  assert.deepEqual(view.visit, { date: '2026-09-07', welcomeBack: false, gains: { hunger: 1, happiness: 0, cleanliness: 0, health: 0 } });
  assert.equal(view.pet.needs.hunger, 2);
  const saved = f.db.read('fixture/pets/student-a').paidCare;
  assert.equal(saved.visitDate, '2026-09-07');
  assert.equal(saved.daily.spent, 0, 'not counted toward the care cap');
  assert.deepEqual(f.db.read('fixture/wallets/student-a'), walletBefore, 'wallet untouched');
  const record = f.db.read('fixture/visits/student-a/2026-09-07');
  assert.equal(record.type, 'daily_visit');
  assert.equal(record.amount, 0);
  assert.equal(record.needsBefore.hunger, 1);
  assert.equal(record.needsAfter.hunger, 2);
});

test('only once per day; the next day gives another', async () => {
  const f = visitSetup();
  await f.load();
  const again = await f.load();
  assert.equal(Object.hasOwn(again, 'visit'), false);
  f.at(NOW + DAY);
  const tomorrow = await f.load();
  assert.equal(tomorrow.visit.date, '2026-09-08');
});

test('ties go to food first, then happy, clean and health', async () => {
  const f = visitSetup({ needs: { hunger: 2, happiness: 2, cleanliness: 2, health: 2 } });
  assert.deepEqual((await f.load()).visit.gains, { hunger: 1, happiness: 0, cleanliness: 0, health: 0 });
  const g = visitSetup({ needs: { hunger: 4, happiness: 3, cleanliness: 1, health: 1 } });
  assert.deepEqual((await g.load()).visit.gains, { hunger: 0, happiness: 0, cleanliness: 1, health: 0 });
});

test('after 7+ days away, a welcome back adds a heart to every need that is not full', async () => {
  const f = visitSetup({ needs: { hunger: 0, happiness: 1, cleanliness: 4, health: 2 }, lastSeen: NOW - 8 * DAY });
  const view = await f.load();
  assert.equal(view.visit.welcomeBack, true);
  // Eight days of normal fading happen first; then every need below full gets +1.
  const record = f.db.read('fixture/visits/student-a/2026-09-07');
  assert.equal(record.type, 'welcome_back');
  for (const key of ['hunger', 'happiness', 'cleanliness', 'health']) {
    assert.equal(view.visit.gains[key], record.needsBefore[key] < 4 ? 1 : 0, key);
    assert.equal(record.needsAfter[key], Math.min(4, record.needsBefore[key] + 1), key);
  }
  const sixDays = visitSetup({ lastSeen: NOW - 6 * DAY });
  assert.equal((await sixDays.load()).visit.welcomeBack, false);
});

test('a full pal is still greeted but gains nothing; unknown last visit is a daily gift', async () => {
  const f = visitSetup({ needs: { hunger: 4, happiness: 4, cleanliness: 4, health: 4 } });
  const view = await f.load();
  assert.deepEqual(view.visit.gains, { hunger: 0, happiness: 0, cleanliness: 0, health: 0 });
  const unknown = visitSetup({ lastSeen: null });
  assert.equal((await unknown.load()).visit.welcomeBack, false);
});

test('paused pals get no gift: disabled, calendar holiday, Holiday Mode', async () => {
  const disabled = visitSetup();
  disabled.db.seed(disabled.refs.config('student-a'), { ...disabled.db.read(disabled.refs.config('student-a')), enabled: false });
  assert.equal(Object.hasOwn(await disabled.load(), 'visit'), false, 'disabled');

  const holiday = visitSetup();
  holiday.at(NOW + DAY);
  const config = holiday.db.read(holiday.refs.config('student-a'));
  holiday.db.seed(holiday.refs.config('student-a'), { ...config, calendar: [...config.calendar, { effectiveFrom: '2026-09-08', paused: false, holidays: ['2026-09-08'], absences: [] }] });
  assert.equal(Object.hasOwn(await holiday.load(), 'visit'), false, 'calendar holiday');

  const mode = visitSetup();
  Object.assign(mode.refs, { holidayGlobal: () => 'fixture/global', holidayHistory: () => 'fixture/holidayHistory' });
  mode.db.seed('fixture/global', { holiday_mode: true });
  mode.db.seed('fixture/holidayHistory', { enabled: true, periods: [{ from: NOW - DAY, to: null }] });
  assert.equal(Object.hasOwn(await mode.load(), 'visit'), false, 'Holiday Mode');
});

test('weekends get the gift (pals keep fading on weekends)', async () => {
  const f = visitSetup();
  f.at(Date.parse('2026-09-12T00:00:00Z')); // Saturday noon Auckland.
  assert.equal((await f.load()).visit.date, '2026-09-12');
});

test('visit gift and giving cheer both apply in one load, all reads before writes', async () => {
  const f = visitSetup({ needs: { hunger: 1, happiness: 1, cleanliness: 4, health: 4 }, giving: { given_today: 1, last_given_date: 'Mon Sep 07 2026' } });
  const view = await f.load();
  assert.deepEqual(view.visit.gains, { hunger: 1, happiness: 0, cleanliness: 0, health: 0 });
  assert.deepEqual(view.cheer, { date: '2026-09-07', gain: 1 });
  assert.equal(view.pet.needs.hunger, 2);
  assert.equal(view.pet.needs.happiness, 2);
});

test('without the visit ref the load is unchanged', async () => {
  const f = setup({ needs: { hunger: 1, happiness: 3, cleanliness: 2, health: 4 } });
  const view = await f.service.getHandheldState(request());
  assert.equal(Object.hasOwn(view, 'visit'), false);
  assert.equal(view.pet.needs.hunger, 1);
});
