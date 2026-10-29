import test from 'node:test';
import assert from 'node:assert/strict';
import {
    HATCH_MS, NAP_MS, SNACKS_PER_DAY, act, advance, ageDays, careDays, createDonutPal, isAsleep, isNight,
    needsAttention, takeEvents,
} from './donutPal.js';

const HOUR = 3600000;
// Monday 2 November 2026, 9:00 in Auckland (NZDT, UTC+13).
const MON_9AM = Date.parse('2026-11-01T20:00:00Z');

function hatched(at = MON_9AM) {
    const pal = advance(createDonutPal({ name: 'Pip', nowMs: at - HATCH_MS }), at);
    return { ...pal, hunger: 4, happy: 4, events: [] };
}

test('the egg hatches after a minute, a little hungry and bored', () => {
    const egg = createDonutPal({ name: 'Pip', nowMs: MON_9AM });
    assert.equal(advance(egg, MON_9AM + 30000).stage, 'egg');
    const baby = advance(egg, MON_9AM + HATCH_MS);
    assert.equal(baby.stage, 'baby'); assert.equal(baby.hunger, 2); assert.equal(baby.happy, 2);
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
    assert.equal(meal.ok, true); assert.equal(meal.pal.hunger, 3); assert.equal(meal.cost, undefined);
    pal = { ...pal, hunger: 4 };
    assert.equal(act(pal, 'meal', { nowMs: MON_9AM }).reason, 'full');
    assert.equal(act(pal, 'clean', { nowMs: MON_9AM }).reason, 'clean');
    assert.equal(act(pal, 'medicine', { nowMs: MON_9AM }).reason, 'well');
    assert.equal(act(pal, 'lights', { nowMs: MON_9AM }).reason, 'awake');
});

test('a snack costs 1 donut, fills food and happy, and stops at 3 a day', () => {
    let pal = { ...hatched(), hunger: 0, happy: 0 };
    assert.equal(act(pal, 'snack', { nowMs: MON_9AM, donuts: 0 }).reason, 'donuts');
    for (let i = 0; i < SNACKS_PER_DAY; i++) {
        const snack = act(pal, 'snack', { nowMs: MON_9AM, donuts: 5 });
        assert.equal(snack.ok, true); assert.equal(snack.cost, 1); pal = snack.pal;
    }
    assert.equal(pal.hunger, 3); assert.equal(pal.happy, 3);
    assert.equal(act(pal, 'snack', { nowMs: MON_9AM, donuts: 5 }).reason, 'treats');
    const tomorrow = Date.parse('2026-11-02T20:00:00Z');
    assert.equal(act(pal, 'snack', { nowMs: tomorrow, donuts: 5 }).ok, true);
});

test('the game cheers your pal on 3 wins of 5, and 3 games make it sleepy for a nap', () => {
    let pal = { ...hatched(), happy: 1 };
    let game = act(pal, 'game', { nowMs: MON_9AM, wins: 3 });
    assert.equal(game.pal.happy, 2); assert.equal(game.animation, 'happy');
    game = act(game.pal, 'game', { nowMs: MON_9AM, wins: 2 });
    assert.equal(game.pal.happy, 2); assert.equal(game.animation, 'shrug');
    pal = act(game.pal, 'game', { nowMs: MON_9AM, wins: 4 }).pal;
    assert.equal(pal.sleepy, true); assert.equal(needsAttention(pal, MON_9AM), true);
    assert.equal(act(pal, 'game', { nowMs: MON_9AM, wins: 5 }).reason, 'sleepy');
    const nap = act(pal, 'lights', { nowMs: MON_9AM });
    assert.equal(nap.ok, true); assert.equal(isAsleep(nap.pal, MON_9AM + 60000), true);
    const after = advance(nap.pal, MON_9AM + NAP_MS + 60000);
    assert.equal(after.sleepy, false); assert.equal(after.happy, 4);
    assert.equal(isAsleep(after, after.at), false);
});

test('neglect makes the pal sick, never worse; medicine cures in one dose', () => {
    const TUE_9AM = Date.parse('2026-11-02T20:00:00Z'); const TUE_1PM = TUE_9AM + 4 * HOUR;
    // A day's gap (14 awake hours) is fine; a skipped day (18 awake hours) is not.
    assert.equal(advance({ ...hatched(), mess: 1 }, TUE_9AM).sick, false);
    const sick = advance({ ...hatched(), mess: 1 }, TUE_1PM);
    assert.equal(sick.sick, true);
    assert.equal(act(sick, 'game', { nowMs: sick.at, wins: 5 }).reason, 'sick');
    const cured = act(sick, 'medicine', { nowMs: sick.at });
    assert.equal(cured.ok, true); assert.equal(cured.pal.sick, false);
    assert.equal(advance({ ...hatched(), hunger: 0 }, TUE_9AM).sick, false);
    assert.equal(advance({ ...hatched(), hunger: 0 }, TUE_1PM).sick, true);
    const twoWeeks = advance(hatched(), MON_9AM + 30 * 24 * HOUR);
    assert.equal(twoWeeks.sick, true); assert.equal(twoWeeks.stage, 'baby');
});

test('growing up: good care days count; a sick pal waits', () => {
    let pal = hatched();
    pal = act({ ...pal, hunger: 3 }, 'meal', { nowMs: MON_9AM }).pal;
    assert.equal(careDays(pal), 1);
    pal = advance(pal, Date.parse('2026-11-02T18:00:00Z')); // Tue 7am
    assert.equal(pal.stage, 'baby');
    pal = act({ ...pal, hunger: 3, mess: 0 }, 'meal', { nowMs: Date.parse('2026-11-02T20:00:00Z') }).pal;
    assert.equal(careDays(pal), 2);
    const grown = advance(pal, Date.parse('2026-11-03T18:00:00Z')); // Wed 7am
    assert.equal(grown.stage, 'child');
    assert.deepEqual(takeEvents(grown).events.filter(e => e.type === 'grew').map(e => e.stage), ['child']);
    const sickPal = advance({ ...pal, sick: true }, Date.parse('2026-11-03T18:00:00Z'));
    assert.equal(sickPal.stage, 'baby');
    assert.equal(ageDays(grown, grown.at), 2);
    const sickCare = act({ ...hatched(), sick: true, hunger: 2 }, 'meal', { nowMs: MON_9AM }).pal;
    assert.equal(careDays(sickCare), 0);
});

test('lights at night are cosy, with no penalty if left on', () => {
    const night = Date.parse('2026-11-02T09:00:00Z'); // 10pm
    const pal = advance(hatched(Date.parse('2026-11-02T08:00:00Z')), night);
    assert.equal(act(pal, 'meal', { nowMs: night }).reason, 'asleep');
    const off = act(pal, 'lights', { nowMs: night });
    assert.equal(off.pal.lightsOff, true);
    assert.equal(needsAttention(pal, night), false);
    assert.equal(advance(off.pal, Date.parse('2026-11-02T18:00:00Z')).lightsOff, false);
});

test('a two-week gap catches up quickly', () => {
    const started = performance.now();
    advance(hatched(), MON_9AM + 14 * 24 * HOUR);
    assert.ok(performance.now() - started < 250);
});
