// Donut pal care rules (preview only; no server). Pure functions over a plain state
// object, so the server can later run the same rules. Time is in real milliseconds
// and the pal lives on Auckland time.

export const NEEDS_MAX = 4;
export const MESS_MAX = 3;
export const SNACK_PRICE = 1;
export const SNACKS_PER_DAY = 3;
export const NAP_MS = 20 * 60 * 1000;
export const HATCH_MS = 60 * 1000;
export const GAME_ROUNDS = 5;
export const GAME_WINS_NEEDED = 3;
export const GAMES_BEFORE_SLEEPY = 3;
// Minutes awake (sleep pauses everything).
// Tuned for one visit per school day (about 14 awake hours apart): each visit
// finds a couple of hearts to fill and a mess, and only a skipped day makes the
// pal sick.
export const HUNGER_EVERY = 360;
export const HAPPY_EVERY = 420;
export const MESS_EVERY = 480;
export const SICK_AFTER_MESS = 1080;
export const SICK_AFTER_EMPTY = 1080;
export const NIGHT_FROM = 21;
export const NIGHT_UNTIL = 7;
// A care day is a day you fed, played or cleaned while your pal was well.
export const GROW_AT = { baby: 2, child: 5 };
const MAX_CATCH_UP_MINUTES = 14 * 24 * 60;
const MINUTE = 60 * 1000;

const AUCKLAND = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

export function aucklandParts(ms) {
    const parts = Object.fromEntries(AUCKLAND.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// Auckland's offset is a whole number of hours, so night is the same for every
// minute of a UTC hour; caching per hour keeps a long catch-up fast.
const nightByHour = new Map();
export function isNight(ms) {
    const hourKey = Math.floor(ms / 3600000);
    if (!nightByHour.has(hourKey)) {
        if (nightByHour.size > 5000) nightByHour.clear();
        const { hour } = aucklandParts(ms);
        nightByHour.set(hourKey, hour >= NIGHT_FROM || hour < NIGHT_UNTIL);
    }
    return nightByHour.get(hourKey);
}

export function createDonutPal({ name = 'Pal', species = 'mossbit', nowMs }) {
    return {
        version: 1, name, species, stage: 'egg', hatchAt: nowMs + HATCH_MS, bornAt: null,
        hunger: 0, happy: 0, mess: 0, sick: false, sleepy: false, napUntil: 0, lightsOff: false,
        gamesInRow: 0, snackDate: '', snacks: 0, caredDates: [],
        timers: { hunger: 0, happy: 0, mess: 0, messAge: 0, empty: 0 },
        at: nowMs, events: [],
    };
}

export function isAsleep(pal, ms = pal.at) {
    return pal.stage !== 'egg' && (isNight(ms) || ms < pal.napUntil);
}

export function careDays(pal) {
    return pal.caredDates.length;
}

export function ageDays(pal, ms = pal.at) {
    if (!pal.bornAt) return 0;
    const born = aucklandParts(pal.bornAt).date; const today = aucklandParts(ms).date;
    return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${born}T00:00:00Z`)) / 86400000);
}

export function needsAttention(pal, ms = pal.at) {
    if (pal.stage === 'egg') return false;
    if (pal.sick) return true;
    if (isNight(ms)) return false;
    return pal.hunger === 0 || pal.happy === 0 || pal.mess > 0 || (pal.sleepy && ms >= pal.napUntil);
}

function clone(pal) {
    return { ...pal, timers: { ...pal.timers }, caredDates: [...pal.caredDates], events: [...pal.events] };
}

function stepMinute(pal, ms) {
    const t = pal.timers;
    if (pal.stage === 'egg') {
        if (ms >= pal.hatchAt) {
            Object.assign(pal, { stage: 'baby', bornAt: pal.hatchAt, hunger: 2, happy: 2 });
            pal.events.push({ type: 'hatched', at: ms });
        }
        return;
    }
    const wasNight = isNight(ms - MINUTE); const night = isNight(ms);
    if (wasNight && !night) wakeUp(pal, ms);
    if (pal.napUntil && ms >= pal.napUntil && ms - MINUTE < pal.napUntil) {
        pal.sleepy = false; pal.gamesInRow = 0; pal.lightsOff = false;
        pal.happy = Math.min(NEEDS_MAX, pal.happy + 1);
        pal.events.push({ type: 'napped', at: ms });
    }
    if (night || ms < pal.napUntil) return;
    if (++t.hunger >= HUNGER_EVERY) { t.hunger = 0; pal.hunger = Math.max(0, pal.hunger - 1); }
    if (++t.happy >= HAPPY_EVERY) { t.happy = 0; pal.happy = Math.max(0, pal.happy - 1); }
    if (++t.mess >= MESS_EVERY) { t.mess = 0; pal.mess = Math.min(MESS_MAX, pal.mess + 1); }
    t.messAge = pal.mess > 0 ? t.messAge + 1 : 0;
    t.empty = pal.hunger === 0 ? t.empty + 1 : 0;
    if (!pal.sick && (t.messAge >= SICK_AFTER_MESS || t.empty >= SICK_AFTER_EMPTY)) {
        pal.sick = true;
        pal.events.push({ type: 'sick', at: ms });
    }
}

// Morning: lights back on, a fresh game streak, and growing up if enough good
// care days have passed. A sick pal waits (neglect slows growth).
function wakeUp(pal, ms) {
    pal.lightsOff = false; pal.gamesInRow = 0; pal.sleepy = false;
    const next = pal.stage === 'baby' ? 'child' : pal.stage === 'child' ? 'adult' : null;
    if (next && !pal.sick && careDays(pal) >= GROW_AT[pal.stage]) {
        pal.stage = next;
        pal.events.push({ type: 'grew', stage: next, at: ms });
    }
}

// Catch up minute by minute (at most 14 days), exactly like a pocket pet left in a bag.
export function advance(pal, nowMs) {
    if (nowMs <= pal.at) return pal;
    const next = clone(pal);
    const minutes = Math.min(MAX_CATCH_UP_MINUTES, Math.floor((nowMs - pal.at) / MINUTE));
    let ms = pal.at;
    for (let i = 0; i < minutes; i++) { ms += MINUTE; stepMinute(next, ms); }
    next.at = minutes === MAX_CATCH_UP_MINUTES ? nowMs : ms;
    return next;
}

export function takeEvents(pal) {
    return { pal: pal.events.length ? { ...pal, events: [] } : pal, events: pal.events };
}

function markCared(pal, ms) {
    if (pal.sick) return;
    const today = aucklandParts(ms).date;
    if (!pal.caredDates.includes(today)) pal.caredDates = [...pal.caredDates, today].slice(-60);
}

function refuse(pal, reason) {
    return { pal, ok: false, reason, animation: 'no' };
}

// Every action returns { pal, ok, animation, reason?, cost? }. Care is free; the
// snack treat is the only thing that costs donuts.
export function act(pal, action, { nowMs, donuts = 0, wins = 0 } = {}) {
    const current = advance(pal, nowMs);
    if (current.stage === 'egg') return refuse(current, 'egg');
    const asleep = isAsleep(current, nowMs);
    if (asleep && action !== 'lights' && action !== 'medicine') return refuse(current, 'asleep');
    const next = clone(current);
    switch (action) {
        case 'meal':
            if (next.hunger >= NEEDS_MAX) return refuse(current, 'full');
            next.hunger += 1; markCared(next, nowMs);
            return { pal: next, ok: true, animation: 'eat' };
        case 'snack': {
            const today = aucklandParts(nowMs).date;
            const eaten = next.snackDate === today ? next.snacks : 0;
            if (next.sick) return refuse(current, 'sick');
            if (eaten >= SNACKS_PER_DAY) return refuse(current, 'treats');
            if (next.hunger >= NEEDS_MAX && next.happy >= NEEDS_MAX) return refuse(current, 'full');
            if (donuts < SNACK_PRICE) return refuse(current, 'donuts');
            next.snackDate = today; next.snacks = eaten + 1;
            next.hunger = Math.min(NEEDS_MAX, next.hunger + 1); next.happy = Math.min(NEEDS_MAX, next.happy + 1);
            markCared(next, nowMs);
            return { pal: next, ok: true, animation: 'snack', cost: SNACK_PRICE };
        }
        case 'game': {
            if (next.sick) return refuse(current, 'sick');
            if (next.sleepy) return refuse(current, 'sleepy');
            const won = wins >= GAME_WINS_NEEDED;
            if (won) next.happy = Math.min(NEEDS_MAX, next.happy + 1);
            next.gamesInRow += 1;
            if (next.gamesInRow >= GAMES_BEFORE_SLEEPY) next.sleepy = true;
            markCared(next, nowMs);
            return { pal: next, ok: true, animation: won ? 'happy' : 'shrug' };
        }
        case 'clean':
            if (next.mess === 0) return refuse(current, 'clean');
            next.mess = 0; next.timers.messAge = 0; markCared(next, nowMs);
            return { pal: next, ok: true, animation: 'clean' };
        case 'medicine':
            if (!next.sick) return refuse(current, 'well');
            next.sick = false; next.timers.messAge = 0; next.timers.empty = 0;
            return { pal: next, ok: true, animation: 'medicine' };
        case 'lights':
            if (isNight(nowMs)) {
                next.lightsOff = !next.lightsOff;
                return { pal: next, ok: true, animation: next.lightsOff ? 'lightsOff' : 'lightsOn' };
            }
            if (nowMs < next.napUntil) return refuse(current, 'napping');
            if (!next.sleepy) return refuse(current, 'awake');
            next.napUntil = nowMs + NAP_MS; next.lightsOff = true;
            return { pal: next, ok: true, animation: 'lightsOff' };
        default:
            return refuse(current, 'unknown');
    }
}

// Words for screen readers and the preview log; the device itself shows no text.
export const REFUSALS = {
    egg: 'Your egg is still hatching.',
    asleep: 'Shh, your pal is asleep.',
    full: 'Your pal is full.',
    sick: 'Your pal feels too sick for that. Try Medicine.',
    treats: 'That is enough treats for today.',
    donuts: 'A snack costs 1 donut.',
    sleepy: 'Your pal is sleepy. Turn the lights off for a nap.',
    clean: 'Nothing to clean.',
    well: 'Your pal is not sick.',
    napping: 'Your pal is napping.',
    awake: 'Your pal is not sleepy.',
    unknown: 'That did nothing.',
};

export function describePal(pal, ms = pal.at) {
    if (pal.stage === 'egg') return `${pal.name} is an egg, about to hatch.`;
    const parts = [`${pal.name} is ${pal.stage === 'adult' ? 'an' : 'a'} ${pal.stage}`];
    if (isAsleep(pal, ms)) parts.push(ms < pal.napUntil ? 'napping' : 'asleep');
    if (pal.sick) parts.push('sick');
    if (pal.hunger === 0) parts.push('hungry'); if (pal.happy === 0) parts.push('sad');
    if (pal.mess) parts.push(`${pal.mess} mess${pal.mess > 1 ? 'es' : ''} to clean`);
    if (pal.sleepy && ms >= pal.napUntil) parts.push('sleepy');
    return `${parts.join(', ')}. Food ${pal.hunger} of 4, happy ${pal.happy} of 4.`;
}
