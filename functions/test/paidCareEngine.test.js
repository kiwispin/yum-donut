const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultConfig, validateConfig, migrateLegacyPet, advancePet, purchaseEffect, aucklandNow } = require('../src/yumpals/paidCareEngine');
const { legacy } = require('./paidCareFixture');
const UID = 'student-a';
const now = (date) => Date.parse(`${date}T00:00:00Z`);
const config = () => ({ ...defaultConfig('2026-01-01'), enabled: true });
const adopted = (settings = config(), date = '2026-09-07') => migrateLegacyPet(legacy(), UID, settings, now(date));

test('migration preserves every old field/progress, initializes full needs once, and never repairs corruption', () => {
  const original = legacy();
  original.opaqueTimestamp = { toMillis: () => 123 }; // preserve SDK-style opaque fields by reference.
  const settings = config();
  const pet = migrateLegacyPet(original, UID, settings, now('2026-09-07'));
  for (const key of Object.keys(original)) assert.equal(pet[key], original[key]);
  assert.deepEqual(pet.paidCare.needs, { hunger: 4, happiness: 4, cleanliness: 4, health: 4 });
  assert.deepEqual(migrateLegacyPet(pet, UID, settings, now('2026-10-01')), pet);
  assert.throws(() => migrateLegacyPet({ ...original, ownerUid: 'other' }, UID, settings, now('2026-09-07')));
  assert.throws(() => migrateLegacyPet({ ...original, careDays: NaN }, UID, settings, now('2026-09-07')));
});

test('whole Auckland dates skip adoption day and the current incomplete day, even at midnight', () => {
  const settings = config();
  const pet = adopted(settings);
  assert.deepEqual(advancePet(pet, UID, settings, Date.parse('2026-09-08T11:59:59Z')).paidCare.needs, pet.paidCare.needs);
  const next = advancePet(pet, UID, settings, Date.parse('2026-09-08T12:00:00Z'));
  assert.equal(next.paidCare.checkpoint, '2026-09-08');
  assert.deepEqual(next.paidCare.needs, { hunger: 3, happiness: 3, cleanliness: 3, health: 4 });
  assert.deepEqual(advancePet(next, UID, settings, Date.parse('2026-09-08T12:01:00Z')), next);
  assert.equal(next.careDays, 12);
});

test('Auckland DST spring and autumn boundaries use calendar dates, not 24-hour intervals', () => {
  assert.deepEqual(aucklandNow(Date.parse('2026-09-26T13:59:59Z')), { date: '2026-09-27', hour: 1 });
  assert.deepEqual(aucklandNow(Date.parse('2026-09-26T14:00:00Z')), { date: '2026-09-27', hour: 3 });
  assert.deepEqual(aucklandNow(Date.parse('2026-04-04T13:59:59Z')), { date: '2026-04-05', hour: 2 });
  assert.deepEqual(aucklandNow(Date.parse('2026-04-04T14:00:00Z')), { date: '2026-04-05', hour: 2 });
  for (const [friday, monday] of [['2026-09-25', '2026-09-28'], ['2026-04-03', '2026-04-06']]) {
    const pet = adopted(config(), friday);
    assert.deepEqual(advancePet(pet, UID, config(), now(monday)).paidCare.needs, pet.paidCare.needs);
  }
});

test('effective pause history, holidays and overlapping absences freeze each date only once', () => {
  const settings = config();
  settings.calendar[0].holidays = ['2026-09-08'];
  settings.calendar[0].absences = [{ from: '2026-09-08', to: '2026-09-09' }, { from: '2026-09-09', to: '2026-09-10' }];
  settings.calendar.push({ effectiveFrom: '2026-09-11', paused: true, holidays: [], absences: [] });
  settings.calendar.push({ effectiveFrom: '2026-09-15', paused: false, holidays: [], absences: [] });
  const result = advancePet(adopted(settings), UID, settings, now('2026-09-16'));
  assert.deepEqual(result.paidCare.needs, { hunger: 3, happiness: 3, cleanliness: 3, health: 4 });
});

test('disabled advancement returns identical pet; reenable with recorded pause prevents catch-up', () => {
  const settings = config();
  const pet = adopted(settings);
  assert.equal(advancePet(pet, UID, { ...settings, enabled: false }, now('2026-09-15')), pet);
  settings.calendar.push({ effectiveFrom: '2026-09-08', paused: true, holidays: [], absences: [] });
  settings.calendar.push({ effectiveFrom: '2026-09-15', paused: false, holidays: [], absences: [] });
  assert.deepEqual(advancePet(pet, UID, settings, now('2026-09-15')).paidCare.needs, pet.paidCare.needs);
});

test('processed calendar edits fail closed while prospective history is accepted', () => {
  const settings = config();
  const pet = advancePet(adopted(settings), UID, settings, now('2026-09-10'));
  const past = structuredClone(settings);
  past.calendar[0].holidays.push('2026-09-08');
  assert.throws(() => advancePet(pet, UID, past, now('2026-09-11')), { code: 'CALENDAR_HISTORY_CHANGED' });
  const future = structuredClone(settings);
  future.calendar[0].holidays.push('2026-09-11');
  assert.doesNotThrow(() => advancePet(pet, UID, future, now('2026-09-11')));
});

test('bounded multi-decade advancement matches sequential health rules for all 625 starting need combinations', () => {
  const settings = config();
  for (let h = 0; h <= 4; h += 1) for (let happy = 0; happy <= 4; happy += 1) for (let clean = 0; clean <= 4; clean += 1) for (let health = 0; health <= 4; health += 1) {
    const pet = adopted(settings);
    pet.paidCare.needs = { hunger: h, happiness: happy, cleanliness: clean, health };
    const expected = { ...pet.paidCare.needs };
    for (let step = 0; step < 3; step += 1) {
      if (expected.hunger === 0 || expected.cleanliness === 0) expected.health = Math.max(0, expected.health - 1);
      for (const key of ['hunger', 'happiness', 'cleanliness']) expected[key] = Math.max(0, expected[key] - 1);
    }
    assert.deepEqual(advancePet(pet, UID, settings, now('2026-09-11')).paidCare.needs, expected);
    assert.deepEqual(advancePet(pet, UID, settings, now('2066-09-11')).paidCare.needs, { hunger: 0, happiness: 0, cleanliness: 0, health: 0 });
  }
});

test('corrupt owners, dates, counters, needs and unsafe clocks/config never reset to defaults', () => {
  const settings = config();
  for (const mutate of [
    (p) => { p.ownerUid = 'other'; }, (p) => { p.schemaVersion = 8; }, (p) => { p.name = ''; },
    (p) => { p.paidCare.ownerUid = 'other'; }, (p) => { p.paidCare.needs.health = NaN; },
    (p) => { p.paidCare.needs.hunger = 5; }, (p) => { p.paidCare.daily.spent = -1; },
    (p) => { p.paidCare.daily.spent = Number.MAX_SAFE_INTEGER + 1; },
    (p) => { p.paidCare.daily.date = '2027-01-01'; }, (p) => { p.paidCare.checkpoint = '2026-02-30'; },
    (p) => { p.paidCare.game = { id: '', benefit: 2, round: 0 }; },
  ]) { const pet = adopted(settings); mutate(pet); assert.throws(() => advancePet(pet, UID, settings, now('2026-09-10'))); }
  for (const clock of [NaN, Infinity, -1, 8640000000000001, Number.MAX_SAFE_INTEGER]) assert.throws(() => aucklandNow(clock));
  for (const mutate of [(c) => { c.prices.meal = 0; }, (c) => { c.restores.snack = 1.2; }, (c) => { c.careCap = 15; }, (c) => { c.calendar = []; }]) {
    const c = config(); mutate(c); assert.throws(() => validateConfig(c));
  }
});

test('default full recovery costs 14, plus reminder and bedtime costs 16 without growing old progress', () => {
  const settings = config();
  let pet = adopted(settings);
  pet.paidCare.needs = { hunger: 0, happiness: 0, cleanliness: 0, health: 0 };
  pet.paidCare.attention = true;
  let total = 0;
  for (const [index, action] of ['meal', 'meal', 'game', 'pat', 'pat', 'clean', 'clean', 'medicine', 'medicine', 'reminder', 'bedtime'].entries()) {
    const effect = purchaseEffect({ pet, uid: UID, config: settings, nowMs: now('2026-09-07'), action, operationId: `buy-${index}` });
    total += effect.amount; pet = effect.pet;
    if (index === 8) assert.equal(total, 14);
  }
  assert.equal(total, 16);
  assert.deepEqual(pet.paidCare.needs, { hunger: 4, happiness: 4, cleanliness: 4, health: 4 });
  assert.equal(pet.careDays, 12);
  assert.ok(pet.paidCare.game, 'other care never destroys the purchased entitlement');
});

test('bedtime belongs to previous evening after midnight, expires at 07, with no automatic charge', () => {
  const settings = config();
  const effect = purchaseEffect({ pet: adopted(settings), uid: UID, config: settings, nowMs: now('2026-09-07'), action: 'bedtime', operationId: 'sleep' });
  for (const time of ['2026-09-07T12:00:00Z', '2026-09-07T18:59:00Z']) {
    assert.throws(() => purchaseEffect({ pet: effect.pet, uid: UID, config: settings, nowMs: Date.parse(time), action: 'bedtime', operationId: 'again' }), { code: 'NO_EFFECT' });
  }
  const next = purchaseEffect({ pet: effect.pet, uid: UID, config: settings, nowMs: Date.parse('2026-09-07T19:00:00Z'), action: 'bedtime', operationId: 'next-evening' });
  assert.equal(next.benefit.date, '2026-09-08');
});
