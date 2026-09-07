import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoState, demoAdopt, demoCare, demoDateFromKey, getAucklandDateParts, growthForCareDays, growthForDisplay, schoolDayStatus } from './yumpalsRules.js';

test('growth milestones use promised thresholds and never regress persisted unlocks', () => {
    assert.equal(growthForCareDays(5, 'standard').stage, 'budding');
    assert.equal(growthForCareDays(10, 'standard').stage, 'junior');
    assert.equal(growthForCareDays(5, 'gentle', ['trick', 'accessory']).stage, 'budding');
    assert.deepEqual(growthForCareDays(5, 'gentle', ['trick', 'accessory']).completed, ['trick', 'accessory']);
});

test('Auckland boundaries and school rest rules are deterministic', () => {
    assert.equal(getAucklandDateParts(new Date('2026-04-04T10:59:59.000Z')).dateKey, '2026-04-04');
    assert.equal(getAucklandDateParts(new Date('2026-04-04T11:00:00.000Z')).dateKey, '2026-04-05');
    assert.equal(getAucklandDateParts(new Date('2026-04-04T13:59:59.000Z')).dateKey, '2026-04-05');
    assert.equal(getAucklandDateParts(new Date('2026-04-04T14:00:00.000Z')).dateKey, '2026-04-05');
    assert.equal(getAucklandDateParts(new Date('2026-09-26T13:59:59.000Z')).dateKey, '2026-09-27');
    assert.equal(getAucklandDateParts(new Date('2026-09-26T14:00:00.000Z')).dateKey, '2026-09-27');
    assert.equal(schoolDayStatus(new Date('2026-09-12T00:00:00.000Z')).reason, 'WEEKEND');
    assert.equal(schoolDayStatus(new Date('2026-09-14T00:00:00.000Z'), { holidayRest: true, holidayDates: ['2026-09-14'] }).reason, 'HOLIDAY');
});

test('isolated demo cares on one UID-shaped local state with no cloud calls', () => {
    const date = new Date('2026-09-07T00:00:00.000Z');
    let state = createDemoState(date);
    state = demoAdopt(state, { species: 'mossbit', name: 'Demo Pal', color: '#d94878', casing: 'berry' }).state;
    state = demoCare(state, 'feed', date).state;
    state = demoCare(state, 'pat', date).state;
    assert.equal(state.pet.careDays, 1);
    assert.equal(demoCare(state, 'feed', date).code, 'DUPLICATE');
    const missedDay = demoCare(state, 'feed', new Date('2026-09-12T00:00:00.000Z'));
    assert.equal(missedDay.code, 'WEEKEND');
    assert.equal(missedDay.state.pet.careDays, 1);
    const disabled = { ...state, settings: { ...state.settings, enabled: false } };
    assert.equal(demoCare(disabled, 'feed', date).code, 'DISABLED');
});

test('demo adoption respects disabled settings and the selected Auckland date', () => {
    const selectedDate = new Date('2026-09-14T00:00:00.000Z');
    const disabled = { ...createDemoState(selectedDate), enabled: false, settings: { ...createDemoState(selectedDate).settings, enabled: false } };
    const result = demoAdopt(disabled, { species: 'mossbit', name: 'Nope', color: '#d94878', casing: 'berry' }, selectedDate);
    assert.equal(result.code, 'DISABLED');
    assert.equal(result.state.pet, null);
    assert.equal(result.state.serverNowMs, selectedDate.getTime());
    assert.equal(result.state.today.dateKey, '2026-09-14');
});

test('invalid or empty demo dates retain a valid fallback instead of creating Invalid Date', () => {
    const fallback = new Date('2026-09-14T12:00:00.000Z');
    assert.equal(demoDateFromKey('', null), null);
    assert.equal(demoDateFromKey('2026-02-30', null), null);
    assert.equal(demoDateFromKey('', fallback).getTime(), fallback.getTime());
    assert.equal(demoDateFromKey('2026-09-15', fallback).getTime(), new Date('2026-09-15T12:00:00+12:00').getTime());
});

test('demo reads do not show a quick-speed phantom reward after returning to gentle', () => {
    const firstDate = new Date('2026-09-07T00:00:00.000Z');
    let state = createDemoState(firstDate);
    state = demoAdopt(state, { species: 'mossbit', name: 'Demo Pal', color: '#d94878', casing: 'berry' }, firstDate).state;
    state = demoCare(state, 'feed', firstDate).state;
    state = demoCare(state, 'pat', firstDate).state;
    const secondDate = new Date('2026-09-08T00:00:00.000Z');
    state = demoCare(state, 'feed', secondDate).state;
    state = demoCare(state, 'pat', secondDate).state;
    assert.deepEqual(state.pet.earnedMilestones, []);
    const quick = { ...state, settings: { ...state.settings, growthSpeed: 'quick' } };
    quick.pet = { ...quick.pet, growth: growthForDisplay(quick.pet.careDays, 'quick', quick.pet.earnedMilestones) };
    assert.deepEqual(quick.pet.growth.completed, []);
    const gentle = { ...quick, settings: { ...quick.settings, growthSpeed: 'gentle' } };
    gentle.pet = { ...gentle.pet, growth: growthForDisplay(gentle.pet.careDays, 'gentle', gentle.pet.earnedMilestones) };
    assert.deepEqual(gentle.pet.growth.completed, []);
});
