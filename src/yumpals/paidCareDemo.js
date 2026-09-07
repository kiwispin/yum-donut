import { demoDateFromKey, getAucklandDateParts, schoolDayStatus } from './yumpalsRules.js';

export const PAID_CARE_STARTING_DONUTS = 30;
export const PAID_CARE_ADOPTION_PRICE = 5;
export const PAID_CARE_DAILY_CAP = 25;
export const PAID_CARE_MAX_METERS = 4;

export const PAID_CARE_PRICES = Object.freeze({
    meal: 2,
    snack: 1,
    game: 2,
    pat: 1,
    clean: 1,
    medicine: 2,
    bedtime: 1,
    reminder: 1,
});

export const PAID_CARE_LABELS = Object.freeze({
    meal: 'Meal',
    snack: 'Snack',
    game: 'Game',
    pat: 'Pat',
    clean: 'Clean',
    medicine: 'Medicine',
    bedtime: 'Bedtime',
    reminder: 'Reminder',
});

export const PAID_CARE_PROP_PIXELS = Object.freeze({
    meal: ['........', '..aa....', '.abbaa..', 'abbbbbba', 'abbbbbba', '.abbbba.', '..aaaa..', '........'],
    snack: ['........', '...aa...', '..abba..', '..abbb..', '...bb...', '........', '........', '........'],
    clean: ['......a.', '.....aa.', '....aaa.', '...aaaa.', '..aaaaa.', '.aaaaaa.', 'aaaaaaa.', '........'],
    clean1: ['......a.', '.....aa.', '....aaa.', '...aaaa.', '..aaaaa.', '.aaaaaa.', 'aaaaaaa.', '........'],
    clean2: ['....a...', '...aa...', '..aaa...', '.aaaa...', 'aaaaa...', '.aaaaaa.', '.aaaaaaa', '........'],
    clean3: ['..a.....', '..aa....', '..aaa...', '..aaaa..', '..aaaaa.', '..aaaaaa', '..aaaaaa', '........'],
    medicine: ['..aaaa..', '..abba..', '..abbb..', '..abbb..', '..abbb..', '..abbb..', '..aaaa..', '........'],
    pat: ['.aa.aa..', 'aaaaaaaa', 'aaaaaaaa', '.aaaaaa.', '..aaaa..', '...aa...', '........', '........'],
    reminder: ['...aa...', '..aaaa..', '.aabbba.', '.abbbba.', '..aaaa..', '...aa...', '...aa...', '........'],
    bedtime: ['........', '...a....', '...aa...', '...aaa..', '...aaaa.', '........', '........', '........'],
    mess: ['........', '..a.....', '.aba....', 'aab.a...', '.aa.....', '...a....', '........', '........'],
    illness: ['...a....', '...a....', 'aaaaaaaa', '...a....', '...a....', '........', '........', '........'],
});

const FULL_NEEDS = Object.freeze({ hunger: 4, happiness: 4, cleanliness: 4, health: 4 });
const GAME_TARGETS = Object.freeze(['left', 'right', 'left']);

function dateKeyFor(date) {
    return getAucklandDateParts(date).dateKey;
}

function nextDateKey(dateKey) {
    const date = demoDateFromKey(dateKey, null);
    if (!date) return dateKey;
    return dateKeyFor(new Date(date.getTime() + 24 * 60 * 60 * 1000));
}

function localDateForKey(dateKey) {
    return demoDateFromKey(dateKey, new Date());
}

function clampMeter(value) {
    return Math.max(0, Math.min(PAID_CARE_MAX_METERS, Number.isFinite(value) ? value : 0));
}

function makePet(name = 'Niblet') {
    return {
        name,
        species: 'mossbit',
        casing: 'berry',
        color: '#d94878',
        needs: { ...FULL_NEEDS },
        attention: false,
        ageDays: 0,
    };
}

function baseState(date = new Date()) {
    return {
        version: 'stage2-paid-care-demo-1',
        demoOnly: true,
        initialBalance: PAID_CARE_STARTING_DONUTS,
        balance: PAID_CARE_STARTING_DONUTS,
        spentTotal: 0,
        dateKey: dateKeyFor(date),
        fakeClockMinutes: 10 * 60 + 30,
        pet: null,
        receipts: [],
        operationIds: {},
        dailySpend: {},
        bedtimeDates: [],
        sleepSessionDateKey: null,
        gameSession: null,
        frozenDates: [],
        scenario: 'new-adoption',
    };
}

function withReceipt(state, receipt, operationId, amount) {
    return {
        ...state,
        balance: state.balance - amount,
        spentTotal: state.spentTotal + amount,
        receipts: [...state.receipts, receipt],
        operationIds: {
            ...state.operationIds,
            [operationId]: { action: receipt.action, amount, receiptId: receipt.receiptId },
        },
    };
}

function operationAlreadyUsed(state, operationId) {
    return Boolean(operationId && state.operationIds?.[operationId]);
}

function makeReceipt(state, { action, operationId, amount, status = 'DELIVERED', benefit }) {
    const receiptId = `receipt-${state.receipts.length + 1}`;
    return {
        receiptId,
        operationId,
        action,
        label: PAID_CARE_LABELS[action] || action,
        amount,
        status,
        benefit,
        dateKey: state.dateKey,
        walletBefore: state.balance,
        walletAfter: state.balance - amount,
        demoOnly: true,
    };
}

function result(state, code, extra = {}) {
    return { state, code, ...extra };
}

function recoveryUnits(missing, perAction, price) {
    if (missing <= 0) return 0;
    return Math.ceil(missing / perAction) * price;
}

export function createPaidCareDemo(date = new Date(), { postAdoption = true } = {}) {
    const state = baseState(date);
    if (!postAdoption) return state;
    const adopted = adoptPaidCareDemo(state, { name: 'Niblet', operationId: 'demo-adoption-1' });
    return { ...adopted.state, scenario: 'post-adoption' };
}

export function adoptPaidCareDemo(state, { name = 'Niblet', operationId = `adopt-${Date.now()}` } = {}) {
    if (state.pet) return result(state, 'DUPLICATE');
    if (operationAlreadyUsed(state, operationId)) return result(state, 'DUPLICATE_OPERATION');
    if (state.balance < PAID_CARE_ADOPTION_PRICE) return result(state, 'INSUFFICIENT');
    const receipt = makeReceipt(state, {
        action: 'adoption',
        operationId,
        amount: PAID_CARE_ADOPTION_PRICE,
        benefit: 'full needs pet delivered',
    });
    const nextState = withReceipt({ ...state, pet: makePet(String(name).trim() || 'Niblet') }, receipt, operationId, PAID_CARE_ADOPTION_PRICE);
    return result(nextState, 'OK', { receipt });
}

export function isDemoNight(state) {
    return state.fakeClockMinutes >= 19 * 60 || state.fakeClockMinutes < 7 * 60;
}

export function isBedtimeSessionActive(state) {
    if (!state.sleepSessionDateKey) return false;
    const scheduledDate = state.sleepSessionDateKey;
    const nextDate = nextDateKey(scheduledDate);
    return (state.dateKey === scheduledDate && state.fakeClockMinutes >= 19 * 60)
        || (state.dateKey === nextDate && state.fakeClockMinutes < 7 * 60);
}

export function formatDemoClock(minutes) {
    const safeMinutes = ((minutes % 1440) + 1440) % 1440;
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function getActionBenefit(state, action) {
    const needs = state.pet?.needs || FULL_NEEDS;
    if (action === 'meal') return { key: 'hunger', amount: Math.min(2, PAID_CARE_MAX_METERS - needs.hunger), label: 'hunger' };
    if (action === 'snack') return { key: 'hunger', amount: Math.min(1, PAID_CARE_MAX_METERS - needs.hunger), label: 'hunger' };
    if (action === 'game') return { key: 'happiness', amount: Math.min(2, PAID_CARE_MAX_METERS - needs.happiness), label: 'happiness' };
    if (action === 'pat') return { key: 'happiness', amount: Math.min(1, PAID_CARE_MAX_METERS - needs.happiness), label: 'happiness' };
    if (action === 'clean') return { key: 'cleanliness', amount: Math.min(2, PAID_CARE_MAX_METERS - needs.cleanliness), label: 'cleanliness' };
    if (action === 'medicine') return { key: 'health', amount: Math.min(2, PAID_CARE_MAX_METERS - needs.health), label: 'health' };
    if (action === 'reminder') return { key: 'attention', amount: state.pet?.attention ? 1 : 0, label: 'attention cleared' };
    if (action === 'bedtime') return { key: 'sleep', amount: 1, label: 'bedtime scheduled' };
    return { key: null, amount: 0, label: 'no effect' };
}

export function getCareValidation(state, action) {
    if (!state.pet) return { code: 'NO_PET', message: 'Adopt a YumPal first.' };
    if (!PAID_CARE_PRICES[action]) return { code: 'UNKNOWN_ACTION', message: 'That care action is not available.' };
    if (state.gameSession) return { code: 'GAME_ACTIVE', message: 'Finish or resume the paid game first.' };
    const benefit = getActionBenefit(state, action);
    if (benefit.amount <= 0 && action !== 'bedtime') return { code: 'NOOP_FULL', message: `${PAID_CARE_LABELS[action]} would not change a full meter.` };
    if (action === 'bedtime' && (state.bedtimeDates.includes(state.dateKey) || isBedtimeSessionActive(state))) return { code: 'DUPLICATE_DAY', message: 'Bedtime is already active for this sleep session.' };
    const spentToday = state.dailySpend[state.dateKey] || 0;
    if (spentToday + PAID_CARE_PRICES[action] > PAID_CARE_DAILY_CAP) return { code: 'CAP', message: 'The 25-donut demo care cap is reached for this day.' };
    if (state.balance < PAID_CARE_PRICES[action]) {
        return {
            code: 'INSUFFICIENT',
            message: `Not enough pretend donuts. Need ${PAID_CARE_PRICES[action]}, have ${state.balance}.`,
        };
    }
    return { code: 'OK', benefit, price: PAID_CARE_PRICES[action] };
}

function updateReceiptStatus(state, receiptId, status, benefit) {
    return state.receipts.map((receipt) => receipt.receiptId === receiptId ? { ...receipt, status, benefit: benefit || receipt.benefit } : receipt);
}

export function beginPaidCare(state, action, operationId) {
    if (operationAlreadyUsed(state, operationId)) return result(state, 'DUPLICATE_OPERATION');
    const validation = getCareValidation(state, action);
    if (validation.code !== 'OK') return result(state, validation.code, { message: validation.message });
    const { price, benefit } = validation;
    const status = 'DELIVERED';
    const receipt = makeReceipt(state, {
        action,
        operationId,
        amount: price,
        status,
        benefit: action === 'game' ? `happiness +${benefit.amount} delivered; three-round session` : `${benefit.label} +${benefit.amount}`,
    });
    let nextPet = state.pet;
    if (benefit.key && !['sleep', 'attention'].includes(benefit.key)) {
        nextPet = { ...state.pet, needs: { ...state.pet.needs, [benefit.key]: clampMeter(state.pet.needs[benefit.key] + benefit.amount) } };
    }
    if (action === 'reminder') nextPet = { ...nextPet, attention: false };
    const nextDailySpend = { ...state.dailySpend, [state.dateKey]: (state.dailySpend[state.dateKey] || 0) + price };
    let nextState = withReceipt({ ...state, pet: nextPet, dailySpend: nextDailySpend }, receipt, operationId, price);
    if (action === 'bedtime') nextState = { ...nextState, bedtimeDates: [...new Set([...nextState.bedtimeDates, state.dateKey])], sleepSessionDateKey: state.dateKey };
    if (action === 'game') {
        nextState = {
            ...nextState,
            gameSession: { operationId, receiptId: receipt.receiptId, round: 0, guesses: [], targets: [...GAME_TARGETS], benefitAmount: benefit.amount },
        };
    }
    return result(nextState, 'OK', { receipt, benefit });
}

export function submitGameChoice(state, choice) {
    const session = state.gameSession;
    if (!session) return result(state, 'NO_GAME');
    if (choice !== 'left' && choice !== 'right') return result(state, 'INVALID_GUESS');
    const target = session.targets[session.round];
    const guesses = [...session.guesses, { choice, correct: choice === target }];
    const round = session.round + 1;
    if (round < session.targets.length) {
        return result({ ...state, gameSession: { ...session, round, guesses } }, 'OK', { correct: choice === target, complete: false, target, round: session.round });
    }
    return result({
        ...state,
        gameSession: null,
        receipts: updateReceiptStatus(state, session.receiptId, 'DELIVERED', `happiness +${session.benefitAmount} delivered; ${guesses.filter((guess) => guess.correct).length}/3 correct`),
    }, 'OK', { correct: choice === target, complete: true, target, round: session.round, happinessGain: session.benefitAmount, guesses });
}

export function recoveryEstimate(state) {
    if (!state.pet) return { care: 0, reminder: 0, bedtime: 0, total: 0 };
    const needs = state.pet.needs;
    const hungerMissing = 4 - needs.hunger;
    const happinessMissing = 4 - needs.happiness;
    const hunger = Math.floor(hungerMissing / 2) * PAID_CARE_PRICES.meal + (hungerMissing % 2) * PAID_CARE_PRICES.snack;
    const happiness = Math.floor(happinessMissing / 2) * PAID_CARE_PRICES.game + (happinessMissing % 2) * PAID_CARE_PRICES.pat;
    const cleanliness = recoveryUnits(4 - needs.cleanliness, 2, PAID_CARE_PRICES.clean);
    const health = recoveryUnits(4 - needs.health, 2, PAID_CARE_PRICES.medicine);
    const careTotal = hunger + happiness + cleanliness + health;
    const reminder = state.pet.attention ? PAID_CARE_PRICES.reminder : 0;
    const bedtime = state.bedtimeDates.includes(state.dateKey) || isBedtimeSessionActive(state) ? 0 : PAID_CARE_PRICES.bedtime;
    return { care: careTotal, reminder, bedtime, total: careTotal + reminder + bedtime };
}

export function advanceDemoClock(state, minutes = 60) {
    const safeMinutes = Math.max(0, Math.floor(minutes));
    const absolute = state.fakeClockMinutes + safeMinutes;
    const daysPassed = Math.floor(absolute / 1440);
    const dateKey = Array.from({ length: daysPassed }).reduce((key) => nextDateKey(key), state.dateKey);
    return {
        ...state,
        dateKey,
        fakeClockMinutes: absolute % 1440,
    };
}

export function advanceLocalDay(state) {
    const date = localDateForKey(nextDateKey(state.dateKey));
    const schoolDay = schoolDayStatus(date, { holidayRest: true, holidayDates: state.frozenDates }).eligible;
    const previousNeeds = state.pet?.needs;
    const nextNeeds = previousNeeds ? {
        hunger: clampMeter(previousNeeds.hunger - (schoolDay ? 1 : 0)),
        happiness: clampMeter(previousNeeds.happiness - (schoolDay ? 1 : 0)),
        cleanliness: clampMeter(previousNeeds.cleanliness - (schoolDay ? 1 : 0)),
        health: clampMeter(previousNeeds.health - (schoolDay && (previousNeeds.hunger === 0 || previousNeeds.cleanliness === 0) ? 1 : 0)),
    } : null;
    return {
        ...state,
        dateKey: nextDateKey(state.dateKey),
        fakeClockMinutes: 10 * 60 + 30,
        dailySpend: {},
        pet: state.pet ? { ...state.pet, needs: nextNeeds, ageDays: state.pet.ageDays + (schoolDay ? 1 : 0) } : null,
    };
}

function scenarioState(state, scenario) {
    const pet = state.pet || makePet();
    const full = { ...FULL_NEEDS };
    const needs = scenario === 'needs-care' || scenario === 'recovery'
        ? { hunger: 0, happiness: 0, cleanliness: 0, health: 0 }
        : scenario === 'no-funds'
            ? { ...full, hunger: 3 }
            : full;
    const noFunds = scenario === 'no-funds';
    const night = scenario === 'night' || scenario === 'recovery';
    return {
        ...state,
        scenario,
        balance: noFunds ? 0 : (state.pet ? PAID_CARE_STARTING_DONUTS - PAID_CARE_ADOPTION_PRICE : PAID_CARE_STARTING_DONUTS),
        spentTotal: state.pet ? PAID_CARE_ADOPTION_PRICE : 0,
        dateKey: dateKeyFor(new Date()),
        fakeClockMinutes: night ? 20 * 60 : 10 * 60 + 30,
        receipts: state.pet ? state.receipts.filter((receipt) => receipt.action === 'adoption') : [],
        operationIds: state.pet ? Object.fromEntries(Object.entries(state.operationIds).filter(([, value]) => value.action === 'adoption')) : {},
        dailySpend: {},
        bedtimeDates: [],
        sleepSessionDateKey: null,
        gameSession: null,
        pet: state.pet ? { ...pet, needs, attention: scenario === 'needs-care' || scenario === 'recovery' } : null,
    };
}

export function resetPaidCareDemo(date = new Date(), scenario = 'post-adoption') {
    if (scenario === 'new-adoption') return createPaidCareDemo(date, { postAdoption: false });
    const fresh = createPaidCareDemo(date, { postAdoption: true });
    return scenarioState(fresh, scenario);
}

export function setPaidCareScenario(state, scenario) {
    if (scenario === 'new-adoption') return resetPaidCareDemo(new Date(), scenario);
    return scenarioState(state.pet ? state : createPaidCareDemo(new Date()), scenario);
}

export function metersAreFull(state) {
    return Boolean(state.pet && Object.values(state.pet.needs).every((value) => value >= PAID_CARE_MAX_METERS));
}
