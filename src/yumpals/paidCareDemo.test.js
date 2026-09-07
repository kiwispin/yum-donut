import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    PAID_CARE_ADOPTION_PRICE,
    PAID_CARE_PROP_PIXELS,
    PAID_CARE_STARTING_DONUTS,
    advanceDemoClock,
    advanceLocalDay,
    adoptPaidCareDemo,
    beginPaidCare,
    createPaidCareDemo,
    getCareValidation,
    isDemoNight,
    isBedtimeSessionActive,
    recoveryEstimate,
    submitGameChoice,
} from './paidCareDemo.js';

const DEMO_DATE = new Date('2026-09-07T00:00:00.000Z');

test('local adoption charges exactly 5 from the 30-donut pretend wallet', () => {
    const fresh = createPaidCareDemo(DEMO_DATE, { postAdoption: false });
    assert.equal(fresh.balance, PAID_CARE_STARTING_DONUTS);
    const adoptedViaReducer = adoptPaidCareDemo(fresh, { name: 'Test Pal', operationId: 'adoption-test' });
    assert.equal(adoptedViaReducer.state.balance, PAID_CARE_STARTING_DONUTS - PAID_CARE_ADOPTION_PRICE);
    assert.equal(adoptedViaReducer.state.receipts[0].amount, PAID_CARE_ADOPTION_PRICE);
});

test('paid game delivers one happiness benefit and one debit across pause, day advance and resume', () => {
    let state = createPaidCareDemo(DEMO_DATE);
    state = { ...state, pet: { ...state.pet, needs: { ...state.pet.needs, happiness: 2 } } };
    const started = beginPaidCare(state, 'game', 'game-test-1');
    assert.equal(started.code, 'OK');
    assert.equal(started.state.balance, 23);
    assert.equal(started.state.pet.needs.happiness, 4);
    assert.ok(started.state.gameSession);
    const nextDay = advanceLocalDay(started.state);
    assert.ok(nextDay.gameSession, 'a local day advance must preserve a paid resumable session');
    const first = submitGameChoice(nextDay, 'left');
    assert.ok(['left', 'right'].includes(first.target));
    const second = submitGameChoice(first.state, 'right');
    assert.ok(['left', 'right'].includes(second.target));
    const finished = submitGameChoice(second.state, 'left');
    assert.ok(['left', 'right'].includes(finished.target));
    assert.equal(finished.code, 'OK');
    assert.equal(finished.complete, true);
    assert.equal(finished.state.balance, 23);
    assert.equal(finished.state.pet.needs.happiness, 3);
    assert.equal(finished.state.receipts.filter((receipt) => receipt.action === 'game').length, 1);
    assert.equal(finished.state.receipts.find((receipt) => receipt.action === 'game').status, 'DELIVERED');
});

test('full meters are a no-op and duplicate operation IDs never debit twice', () => {
    const state = createPaidCareDemo(DEMO_DATE);
    assert.equal(getCareValidation(state, 'meal').code, 'NOOP_FULL');
    const patState = { ...state, pet: { ...state.pet, needs: { ...state.pet.needs, happiness: 3 } } };
    const first = beginPaidCare(patState, 'pat', 'pat-test-1');
    const duplicate = beginPaidCare(first.state, 'pat', 'pat-test-1');
    assert.equal(first.state.balance, 24);
    assert.equal(duplicate.code, 'DUPLICATE_OPERATION');
    assert.equal(duplicate.state.balance, 24);
    assert.equal(duplicate.state.receipts.length, first.state.receipts.length);
});

test('recovery estimate uses the 14-care / 16-with-reminder-and-bedtime defaults', () => {
    const state = createPaidCareDemo(DEMO_DATE);
    const recovery = {
        ...state,
        pet: { ...state.pet, needs: { hunger: 0, happiness: 0, cleanliness: 0, health: 0 }, attention: true },
    };
    assert.deepEqual(recoveryEstimate(recovery), { care: 14, reminder: 1, bedtime: 1, total: 16 });
    const partial = { ...recovery, pet: { ...recovery.pet, needs: { hunger: 1, happiness: 1, cleanliness: 4, health: 4 }, attention: false } };
    assert.equal(recoveryEstimate(partial).care, 6);
});

test('insufficient funds leave the local wallet, needs and receipts unchanged', () => {
    const state = createPaidCareDemo(DEMO_DATE);
    const noFunds = { ...state, balance: 0, pet: { ...state.pet, needs: { ...state.pet.needs, hunger: 3 } } };
    const result = beginPaidCare(noFunds, 'snack', 'no-funds-1');
    assert.equal(result.code, 'INSUFFICIENT');
    assert.equal(result.state.balance, 0);
    assert.equal(result.state.pet.needs.hunger, 3);
    assert.equal(result.state.receipts.length, state.receipts.length);
});

test('every demo pixel prop is an 8 by 8 rectangular grid', () => {
    for (const [name, pixels] of Object.entries(PAID_CARE_PROP_PIXELS)) {
        assert.equal(pixels.length, 8, `${name} row count`);
        for (const row of pixels) {
            assert.equal([...row].length, 8, `${name} row width`);
            assert.ok([...row].every((cell) => cell === '.' || cell === 'a' || cell === 'b'), `${name} palette cell`);
        }
    }
});

test('full recovery sequence spends 14 care donuts and restores all four meters', () => {
    let state = createPaidCareDemo(DEMO_DATE);
    state = { ...state, pet: { ...state.pet, needs: { hunger: 0, happiness: 0, cleanliness: 0, health: 0 }, attention: false } };
    const buy = (action, operationId) => {
        const result = beginPaidCare(state, action, operationId);
        assert.equal(result.code, 'OK', `${action} should be payable`);
        state = result.state;
        if (action === 'game') {
            state = submitGameChoice(state, 'left').state;
            state = submitGameChoice(state, 'right').state;
            state = submitGameChoice(state, 'left').state;
        }
    };
    buy('meal', 'recovery-meal-1');
    buy('meal', 'recovery-meal-2');
    buy('game', 'recovery-game-1');
    buy('game', 'recovery-game-2');
    buy('clean', 'recovery-clean-1');
    buy('clean', 'recovery-clean-2');
    buy('medicine', 'recovery-medicine-1');
    buy('medicine', 'recovery-medicine-2');
    assert.deepEqual(state.pet.needs, { hunger: 4, happiness: 4, cleanliness: 4, health: 4 });
    assert.equal(state.balance, 11);
    assert.equal(state.receipts.slice(1).reduce((total, receipt) => total + receipt.amount, 0), 14);
});

test('bedtime is charged once per demo date and fake clock wakes without a charge', () => {
    const state = createPaidCareDemo(DEMO_DATE);
    const scheduled = beginPaidCare(state, 'bedtime', 'bedtime-test-1');
    assert.equal(scheduled.code, 'OK');
    assert.equal(scheduled.state.balance, 24);
    assert.ok(scheduled.state.bedtimeDates.includes(scheduled.state.dateKey));
    const duplicate = beginPaidCare(scheduled.state, 'bedtime', 'bedtime-test-2');
    assert.equal(duplicate.code, 'DUPLICATE_DAY');
    assert.equal(duplicate.state.balance, 24);
    const night = advanceDemoClock(scheduled.state, 9 * 60);
    assert.equal(isDemoNight(night), true);
    const morning = advanceDemoClock(night, 12 * 60);
    assert.equal(isDemoNight(morning), false);
    assert.equal(morning.balance, 24);
    assert.equal(morning.receipts.filter((receipt) => receipt.action === 'bedtime').length, 1);
});

test('bedtime session remains active after midnight until the 07:00 fake wake without another charge', () => {
    const state = createPaidCareDemo(DEMO_DATE);
    const scheduled = beginPaidCare(state, 'bedtime', 'bedtime-session-1');
    const evening = advanceDemoClock(scheduled.state, 9 * 60);
    const afterMidnight = advanceDemoClock(evening, 5 * 60);
    assert.notEqual(afterMidnight.dateKey, evening.dateKey);
    assert.equal(isDemoNight(afterMidnight), true);
    assert.equal(isBedtimeSessionActive(afterMidnight), true);
    assert.equal(getCareValidation(afterMidnight, 'bedtime').code, 'DUPLICATE_DAY');

    const wake = advanceDemoClock(afterMidnight, 6 * 60 + 30);
    assert.equal(wake.fakeClockMinutes, 7 * 60);
    assert.equal(isDemoNight(wake), false);
    assert.equal(isBedtimeSessionActive(wake), false);
    assert.equal(wake.balance, scheduled.state.balance);
    assert.equal(wake.receipts.filter((receipt) => receipt.action === 'bedtime').length, 1);
});
