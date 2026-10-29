import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BASE_WEIGHT, HATCH_MS, HEAVY_OVER, NAP_MS, SNACKS_PER_DAY, act, advance, ageDays, careDays, createDonutPal, describePal,
    isAsleep, isNight, needsAttention, takeEvents,
} from './donutPal.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;
// Monday 2 November 2026, 9:00 in Auckland (NZDT, UTC+13).
const MON_9AM = Date.parse('2026-11-01T20:00:00Z');
const TUE_9AM = MON_9AM + DAY;

function hatched(at = MON_9AM) {
    const pal = advance(createDonutPal({ name: 'Pip', nowMs: at - HATCH_MS }), at);
    return { ...pal, hunger: 4, happy: 4, events: [] };
}

test('the egg hatches after about 5 minutes with empty hearts, calling for you', () => {
    const egg = createDonutPal({ name: 'Pip', nowMs: MON_9AM });
    assert.equal(advance(egg, MON_9AM + HATCH_MS - 60000).stage, 'egg');
    const baby = advance(egg, MON_9AM + HATCH_MS);
    assert.equal(baby.stage, 'baby'); assert.equal(baby.hunger, 0); assert.equal(baby.happy, 0);
    assert.equal(baby.weight, BASE_WEIGHT.baby);
    assert.equal(needsAttention(baby, baby.at), true);
    assert.deepEqual(takeEvents(baby).events.map(event => event.type), ['hatched']);
    assert.equal(act(egg, 'meal', { nowMs: MON_9AM }).ok, false);
});

test('night is 9pm to 7am Auckland time, and sleep pauses needs', () => {
    assert.equal(isNight(Date.parse('2026-11-02T08:30:00Z')), true); // 9:30pm
    assert.equal(isNight(Date.parse('2026-11-02T17:59:00Z')), true); // 6:59am
    assert.equal(isNight(Date.parse('2026-11-02T18:00:00Z')), false); // 7:00am
    const evening = hatched(Date.parse('2026-11-02T08:00:00Z')); // 9pm
    const morning = advance(evening, Date.parse('2026-11-02T18:00:00Z'));
    assert.equal(morning.hunger, 4); assert.equal(morning.happy, 4); assert.equal(morning.mess, 0);
});

test('awake needs fade: food every 6h, happy every 7h, a mess every 8h', () => {
    assert.equal(advance(hatched(), MON_9AM + 6 * HOUR).hunger, 3);
    const later = advance(hatched(), MON_9AM + 8 * HOUR);
    assert.equal(later.hunger, 3); assert.equal(later.happy, 3); assert.equal(later.mess, 1);
    assert.equal(needsAttention(later, later.at), true);
});

test('care is free and refuses what the pal does not need', () => {
    let pal = { ...hatched(), hunger: 2 };
    const meal = act(pal, 'meal', { nowMs: MON_9AM });
    assert.equal(meal.ok, true); assert.equal(meal.pal.hunger, 3); assert.equal(meal.pal.weight, pal.weight + 1);
    assert.equal(meal.cost, undefined);
    pal = { ...pal, hunger: 4 };
    assert.equal(act(pal, 'meal', { nowMs: MON_9AM }).reason, 'full');
    assert.equal(act(pal, 'clean', { nowMs: MON_9AM }).reason, 'clean');
    assert.equal(act(pal, 'medicine', { nowMs: MON_9AM }).reason, 'well');
    assert.equal(act(pal, 'lights', { nowMs: MON_9AM }).reason, 'awake');
});

test('a treat costs 1 donut, adds happy and 2 weight, and stops at 3 a day or when heavy', () => {
    let pal = { ...hatched(), happy: 0 };
    assert.equal(act(pal, 'snack', { nowMs: MON_9AM, donuts: 0 }).reason, 'donuts');
    for (let i = 0; i < SNACKS_PER_DAY; i++) {
        const snack = act(pal, 'snack', { nowMs: MON_9AM, donuts: 5 });
        assert.equal(snack.ok, true); assert.equal(snack.cost, 1); pal = snack.pal;
    }
    assert.equal(pal.happy, 3); assert.equal(pal.weight, BASE_WEIGHT.baby + 6);
    assert.equal(act(pal, 'snack', { nowMs: MON_9AM, donuts: 5 }).reason, 'treats');
    assert.equal(act({ ...pal, snacks: 0, happy: 4 }, 'snack', { nowMs: MON_9AM, donuts: 5 }).reason, 'happy');
    const heavy = { ...pal, snacks: 0, weight: BASE_WEIGHT.baby + HEAVY_OVER };
    assert.equal(act(heavy, 'snack', { nowMs: MON_9AM, donuts: 5 }).reason, 'heavy');
    assert.match(describePal(heavy, MON_9AM), /heavy/);
});

test('the game cheers your pal on 3 wins of 5, burns weight, and 3 games make it sleepy for a nap', () => {
    let pal = { ...hatched(), happy: 1, weight: 9 };
    let game = act(pal, 'game', { nowMs: MON_9AM, wins: 3 });
    assert.equal(game.pal.happy, 2); assert.equal(game.animation, 'happy'); assert.equal(game.pal.weight, 8);
    game = act(game.pal, 'game', { nowMs: MON_9AM, wins: 2 });
    assert.equal(game.pal.happy, 2); assert.equal(game.animation, 'shrug');
    pal = act(game.pal, 'game', { nowMs: MON_9AM, wins: 4 }).pal;
    assert.equal(pal.weight, 6);
    assert.equal(pal.sleepy, true); assert.equal(needsAttention(pal, MON_9AM), true);
    assert.equal(act(pal, 'game', { nowMs: MON_9AM, wins: 5 }).reason, 'sleepy');
    const nap = act(pal, 'lights', { nowMs: MON_9AM });
    assert.equal(nap.ok, true); assert.equal(isAsleep(nap.pal, MON_9AM + 60000), true);
    assert.equal(act(nap.pal, 'meal', { nowMs: MON_9AM + 60000 }).reason, 'asleep');
    const after = advance(nap.pal, MON_9AM + NAP_MS + 60000);
    assert.equal(after.sleepy, false); assert.equal(after.happy, 4);
    assert.equal(isAsleep(after, after.at), false);
    assert.equal(act({ ...hatched(), weight: BASE_WEIGHT.baby }, 'game', { nowMs: MON_9AM, wins: 0 }).pal.weight, BASE_WEIGHT.baby);
});

test('neglect makes the pal sick, never worse; medicine takes 1 to 3 doses', () => {
    const TUE_1PM = TUE_9AM + 4 * HOUR;
    // A day's gap (14 awake hours) is fine; a skipped day (18 awake hours) is not.
    assert.equal(advance({ ...hatched(), mess: 1 }, TUE_9AM).sick, false);
    const sick = advance({ ...hatched(), mess: 1 }, TUE_1PM);
    assert.equal(sick.sick, true); assert.ok(sick.doses >= 1 && sick.doses <= 3);
    assert.equal(act(sick, 'game', { nowMs: sick.at, wins: 5 }).reason, 'sick');
    let pal = sick; const doses = sick.doses;
    for (let i = 1; i < doses; i++) {
        const dose = act(pal, 'medicine', { nowMs: sick.at });
        assert.equal(dose.animation, 'dose'); assert.equal(dose.pal.sick, true); pal = dose.pal;
    }
    const cured = act(pal, 'medicine', { nowMs: sick.at });
    assert.equal(cured.animation, 'medicine'); assert.equal(cured.pal.sick, false);
    assert.equal(advance({ ...hatched(), hunger: 0 }, TUE_9AM).sick, false);
    assert.equal(advance({ ...hatched(), hunger: 0 }, TUE_1PM).sick, true);
    const twoWeeks = advance(hatched(), MON_9AM + 30 * DAY);
    assert.equal(twoWeeks.sick, true); assert.equal(twoWeeks.stage, 'baby');
    const nightSick = advance({ ...hatched(Date.parse('2026-11-02T08:00:00Z')), sick: true, doses: 1 }, Date.parse('2026-11-02T09:00:00Z'));
    assert.equal(act(nightSick, 'medicine', { nowMs: nightSick.at }).reason, 'asleep');
    assert.equal(needsAttention(nightSick, nightSick.at), true);
});

test('care mistakes: an empty meter left 6 awake hours, or getting sick', () => {
    const empty = advance({ ...hatched(), hunger: 0, mistakes: 0 }, MON_9AM + 6 * HOUR);
    assert.equal(empty.mistakes, 1);
    assert.equal(advance(empty, MON_9AM + 7 * HOUR).mistakes, 1); // once per empty spell
    const both = advance({ ...hatched(), hunger: 0, happy: 0, mistakes: 0 }, MON_9AM + 6 * HOUR);
    assert.equal(both.mistakes, 2);
    assert.equal(advance({ ...hatched(), mess: 1, mistakes: 0 }, TUE_9AM + 4 * HOUR).mistakes, 1);
});

// Feeds once on each of `days` mornings (9am), keeping the pal clean and well.
function careFor(pal, days, from = MON_9AM) {
    for (let d = 0; d < days; d++) {
        const at = from + d * DAY;
        pal = act({ ...advance(pal, at), hunger: 3, happy: 3, mess: 0, sick: false }, 'meal', { nowMs: at }).pal;
    }
    return pal;
}

test('growing up: baby, child, teen, adult on good care days; a sick pal waits', () => {
    let pal = careFor(hatched(), 2);
    assert.equal(careDays(pal), 2); assert.equal(pal.stage, 'baby');
    pal = advance(pal, MON_9AM + 2 * DAY - 2 * HOUR); // Wed 7am
    assert.equal(pal.stage, 'child'); assert.equal(pal.weight, BASE_WEIGHT.child);
    assert.deepEqual(takeEvents(pal).events.filter(e => e.type === 'grew').map(e => e.stage), ['child']);
    const sickWait = advance({ ...careFor(hatched(), 2), sick: true }, MON_9AM + 2 * DAY - 2 * HOUR);
    assert.equal(sickWait.stage, 'baby');
    pal = careFor(pal, 2, MON_9AM + 2 * DAY);
    pal = advance(pal, MON_9AM + 4 * DAY - 2 * HOUR);
    assert.equal(pal.stage, 'teen');
    pal = careFor(pal, 3, MON_9AM + 4 * DAY);
    pal = advance(pal, MON_9AM + 7 * DAY - 2 * HOUR);
    assert.equal(pal.stage, 'adult'); assert.equal(pal.form, 'good');
    assert.equal(ageDays(pal, pal.at), 7);
    assert.match(describePal(pal, pal.at), /well-raised adult/);
    assert.equal(careDays(act({ ...hatched(), sick: true, hunger: 2 }, 'meal', { nowMs: MON_9AM }).pal), 0);
});

test('a pal with many care mistakes grows into a scruffy adult', () => {
    let pal = careFor(hatched(), 7);
    assert.equal(pal.stage, 'teen');
    pal = { ...pal, mistakes: 5 };
    pal = advance(pal, MON_9AM + 7 * DAY - 2 * HOUR);
    assert.equal(pal.stage, 'adult'); assert.equal(pal.form, 'scruffy');
    assert.match(describePal(pal, pal.at), /scruffy adult/);
});

test('lights at night are cosy, with no penalty if left on', () => {
    const night = Date.parse('2026-11-02T09:00:00Z'); // 10pm
    const pal = advance(hatched(Date.parse('2026-11-02T08:00:00Z')), night);
    assert.equal(act(pal, 'meal', { nowMs: night }).reason, 'asleep');
    const off = act(pal, 'lights', { nowMs: night });
    assert.equal(off.pal.lightsOff, true);
    assert.equal(needsAttention(pal, night), false);
    const morning = advance(pal, Date.parse('2026-11-02T18:00:00Z'));
    assert.equal(advance(off.pal, Date.parse('2026-11-02T18:00:00Z')).lightsOff, false);
    assert.equal(morning.mistakes, pal.mistakes);
});

test('a two-week gap catches up quickly', () => {
    const started = performance.now();
    advance(hatched(), MON_9AM + 14 * DAY);
    assert.ok(performance.now() - started < 250);
});
