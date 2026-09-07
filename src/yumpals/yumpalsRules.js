export const YUMPALS_SPECIES = [
    { id: 'mossbit', name: 'Mossbit', description: 'A gentle garden sprite with very good listening ears.' },
    { id: 'pufflet', name: 'Pufflet', description: 'A buoyant cloudling that collects tiny happy thoughts.' },
    { id: 'emberoo', name: 'Emberoo', description: 'A warm little hopper who turns pats into sparkles.' },
];

export const YUMPALS_CASES = [
    { id: 'berry', label: 'Berry', color: '#d94878' },
    { id: 'mint', label: 'Mint', color: '#27a88b' },
    { id: 'sky', label: 'Sky', color: '#3d83d6' },
    { id: 'sun', label: 'Sun', color: '#d99325' },
];

export const YUMPALS_DEFAULT_SETTINGS = {
    enabled: false,
    holidayRest: true,
    growthSpeed: 'standard',
    availableSpecies: YUMPALS_SPECIES.map((species) => species.id),
    holidayDates: [],
};

const SPEED_THRESHOLDS = {
    gentle: [4, 7, 14, 28],
    standard: [3, 5, 10, 20],
    quick: [2, 4, 8, 16],
};

const MILESTONES = [
    { key: 'trick', label: 'Trick learned', reward: 'A tiny signature trick' },
    { key: 'accessory', label: 'Accessory unlocked', reward: 'A wearable accessory' },
    { key: 'junior', label: 'Junior stage', reward: 'A favourite toy' },
    { key: 'grown', label: 'Grown stage', reward: 'A room theme' },
];

export function getAucklandDateParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return {
        dateKey: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: parts.weekday,
    };
}

export function demoDateFromKey(dateKey, fallbackDate = new Date()) {
    if (/^\d{4}-\d{2}-\d{2}$/u.test(String(dateKey))) {
        const candidate = new Date(`${dateKey}T12:00:00+12:00`);
        if (Number.isFinite(candidate.getTime()) && getAucklandDateParts(candidate).dateKey === dateKey) return candidate;
    }
    return fallbackDate && Number.isFinite(fallbackDate.getTime()) ? new Date(fallbackDate.getTime()) : null;
}

export function schoolDayStatus(date, settings = YUMPALS_DEFAULT_SETTINGS) {
    const parts = getAucklandDateParts(date);
    if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return { ...parts, eligible: false, reason: 'WEEKEND' };
    if (settings.holidayRest && settings.holidayDates.includes(parts.dateKey)) return { ...parts, eligible: false, reason: 'HOLIDAY' };
    return { ...parts, eligible: true, reason: null };
}

export function growthForCareDays(careDays, speed = 'standard', persistedEarnedMilestones = []) {
    const thresholds = SPEED_THRESHOLDS[speed] || SPEED_THRESHOLDS.standard;
    const milestones = MILESTONES.map((milestone, index) => ({ ...milestone, at: thresholds[index] }));
    const persisted = new Set(persistedEarnedMilestones);
    const completed = milestones.filter((milestone) => careDays >= milestone.at || persisted.has(milestone.key));
    const completedKeys = new Set(completed.map((milestone) => milestone.key));
    const next = milestones.find((milestone) => !completedKeys.has(milestone.key)) || null;
    return {
        stage: completed.some((milestone) => milestone.key === 'grown')
            ? 'grown'
            : completed.some((milestone) => milestone.key === 'junior')
                ? 'junior'
                : completed.length > 0 ? 'budding' : 'hatchling',
        milestones,
        completed: [...completedKeys],
        next,
        progressToNext: next ? Math.min(1, careDays / next.at) : 1,
    };
}

export function growthForDisplay(careDays, speed = 'standard', persistedEarnedMilestones = []) {
    const thresholds = SPEED_THRESHOLDS[speed] || SPEED_THRESHOLDS.standard;
    const milestones = MILESTONES.map((milestone, index) => ({ ...milestone, at: thresholds[index] }));
    const completedKeys = new Set(persistedEarnedMilestones);
    const completed = milestones.filter((milestone) => completedKeys.has(milestone.key));
    const next = milestones.find((milestone) => !completedKeys.has(milestone.key)) || null;
    return {
        stage: completedKeys.has('grown')
            ? 'grown'
            : completedKeys.has('junior')
                ? 'junior'
                : completed.length > 0 ? 'budding' : 'hatchling',
        milestones,
        completed: completed.map((milestone) => milestone.key),
        next,
        progressToNext: next ? Math.min(1, careDays / next.at) : 1,
    };
}

function todayFromState(state, date) {
    const status = schoolDayStatus(date, state.settings);
    const day = state.days[status.dateKey] || { actions: {}, complete: false };
    return {
        dateKey: status.dateKey,
        eligible: status.eligible,
        reason: status.reason,
        feed: day.actions.feed === true,
        pat: day.actions.pat === true,
        complete: day.complete === true,
    };
}

export function refreshDemoState(state, date = new Date()) {
    return { ...state, today: todayFromState(state, date) };
}

export function createDemoState(date = new Date()) {
    const state = {
        enabled: true,
        isAdmin: true,
        settings: { ...YUMPALS_DEFAULT_SETTINGS, enabled: true },
        pet: null,
        days: {},
        serverNowMs: date.getTime(),
    };
    return refreshDemoState(state, date);
}

export function demoAdopt(state, pet, date = new Date()) {
    if (state.pet) return { state, code: 'DUPLICATE' };
    if (!state.settings.enabled) {
        return { state: refreshDemoState({ ...state, serverNowMs: date.getTime() }, date), code: 'DISABLED' };
    }
    const nextPet = {
        ...pet,
        reducedMotion: false,
        careDays: 0,
        earnedMilestones: [],
        growth: growthForDisplay(0, state.settings.growthSpeed, []),
    };
    return { state: refreshDemoState({ ...state, serverNowMs: date.getTime(), pet: nextPet }, date), code: 'OK' };
}

export function demoCare(state, action, date = new Date()) {
    if (!state.pet) return { state, code: 'NO_PET' };
    if (!state.settings.enabled) return { state: refreshDemoState({ ...state, serverNowMs: date.getTime() }, date), code: 'DISABLED' };
    const status = schoolDayStatus(date, state.settings);
    const previousDay = state.days[status.dateKey] || { actions: {}, complete: false };
    if (!status.eligible) return { state: refreshDemoState({ ...state, serverNowMs: date.getTime() }, date), code: status.reason };
    if (previousDay.actions[action] === true) return { state: refreshDemoState({ ...state, serverNowMs: date.getTime() }, date), code: 'DUPLICATE' };

    const actions = { ...previousDay.actions, [action]: true };
    const complete = actions.feed === true && actions.pat === true;
    const careDays = state.pet.careDays + (complete && !previousDay.complete ? 1 : 0);
    const growth = growthForCareDays(careDays, state.settings.growthSpeed, state.pet.earnedMilestones);
    const nextPet = { ...state.pet, careDays, earnedMilestones: growth.completed, growth };
    const nextState = {
        ...state,
        serverNowMs: date.getTime(),
        pet: nextPet,
        days: { ...state.days, [status.dateKey]: { actions, complete } },
    };
    return { state: refreshDemoState(nextState, date), code: 'OK', completed: complete };
}

export function demoUpdatePet(state, patch) {
    if (!state.pet) return { state, code: 'NO_PET' };
    return { state: { ...state, pet: { ...state.pet, ...patch } }, code: 'OK' };
}
