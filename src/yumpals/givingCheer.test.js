import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaidCareDemo, setPaidCareScenario, PAID_CARE_STARTING_DONUTS, PAID_CARE_ADOPTION_PRICE } from './paidCareDemo.js';
import { applyGivingCheer, cheerMessage, isCheerRestDay } from './givingCheer.js';

// 2026-10-28 is a Wednesday; 2026-10-31 a Saturday.
const SCHOOL_DAY = new Date('2026-10-28T10:00:00+13:00');
const SATURDAY = new Date('2026-10-31T10:00:00+13:00');
const sad = date => ({ ...setPaidCareScenario(createPaidCareDemo(date), 'needs-care'), dateKey: createPaidCareDemo(date).dateKey });
const gave = (state, mode = 'give') => ({ dateKey: state.dateKey, mode });

test('the first gift of a school day adds one free happiness heart', () => {
    const state = sad(SCHOOL_DAY);
    const result = applyGivingCheer(state, gave(state));
    assert.equal(result.code, 'OK');
    assert.equal(result.happinessGain, 1);
    assert.equal(result.state.pet.needs.happiness, state.pet.needs.happiness + 1);
    assert.deepEqual({ ...result.state.pet.needs, happiness: state.pet.needs.happiness }, state.pet.needs, 'only happiness changes');
    assert.equal(result.state.balance, state.balance, 'no donuts charged or paid out');
    assert.equal(result.state.spentTotal, state.spentTotal);
    assert.deepEqual(result.state.dailySpend, state.dailySpend, 'does not count toward the daily care cap');
    assert.equal(result.receipt.amount, 0);
    assert.equal(result.receipt.action, 'cheer');
});

test('only once per school day, however many donuts are given', () => {
    const state = sad(SCHOOL_DAY);
    const first = applyGivingCheer(state, gave(state)).state;
    const second = applyGivingCheer(first, gave(first));
    assert.equal(second.code, 'ALREADY_CHEERED');
    assert.equal(second.state, first);
});

test('a full happiness meter still cheers but stores nothing', () => {
    const state = createPaidCareDemo(SCHOOL_DAY);
    const result = applyGivingCheer(state, gave(state));
    assert.equal(result.code, 'OK_FULL');
    assert.equal(result.happinessGain, 0);
    assert.equal(result.state.pet.needs.happiness, 4);
    assert.equal(result.state.cheerDateKey, state.dateKey, 'the day is used');
});

test('Munch, an old gift, rest days, pauses and no pal never cheer', () => {
    const state = sad(SCHOOL_DAY);
    assert.equal(applyGivingCheer(state, gave(state, 'munch')).code, 'NOT_A_GIFT');
    assert.equal(applyGivingCheer(state, { dateKey: '2026-10-27', mode: 'give' }).code, 'NOT_TODAY');
    assert.equal(applyGivingCheer(state, null).code, 'NOT_TODAY');
    assert.equal(applyGivingCheer(state, gave(state), { paused: true }).code, 'REST_DAY');
    const weekend = sad(SATURDAY);
    assert.equal(applyGivingCheer(weekend, gave(weekend)).code, 'REST_DAY');
    const holiday = { ...state, frozenDates: [state.dateKey] };
    assert.equal(applyGivingCheer(holiday, gave(holiday)).code, 'REST_DAY');
    const noPal = createPaidCareDemo(SCHOOL_DAY, { postAdoption: false });
    assert.equal(applyGivingCheer(noPal, gave(noPal)).code, 'NO_PET');
    for (const code of ['NOT_A_GIFT', 'NOT_TODAY', 'REST_DAY', 'NO_PET']) assert.ok(cheerMessage(code).length > 0);
});

test('a new school day allows another cheer', () => {
    const state = sad(SCHOOL_DAY);
    const cheered = applyGivingCheer(state, gave(state)).state;
    const tomorrow = { ...cheered, dateKey: '2026-10-29' };
    assert.equal(applyGivingCheer(tomorrow, gave(tomorrow)).code, 'OK');
});

test('rest days are weekends and frozen dates in Auckland date keys', () => {
    assert.equal(isCheerRestDay('2026-10-28'), false);
    assert.equal(isCheerRestDay('2026-10-31'), true);
    assert.equal(isCheerRestDay('2026-11-01'), true);
    assert.equal(isCheerRestDay('2026-11-02', ['2026-11-02']), true);
});

test('the preview starts from the usual pretend wallet', () => {
    assert.equal(createPaidCareDemo(SCHOOL_DAY).balance, PAID_CARE_STARTING_DONUTS - PAID_CARE_ADOPTION_PRICE);
});
