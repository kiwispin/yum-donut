// Donut pal care rules. Pure functions over a plain state object, shared by the
// app and the server: functions/src/yumpals/donutPal.js is generated from this
// file (npm run sync:donut-pal) and a test fails if the two ever differ. Time is in
// real milliseconds and the pal lives on Auckland time.
//
// Checked against Bandai's Gen 1 manual (care icons, empty hearts at hatching,
// meal and snack, the left/right game of 5, 1-3 medicine doses, Lights and Status
// only while asleep, weight on the status screen, good care setting the growth
// path). School adaptations: no death, slower timers for one visit per school
// day, sleep pauses needs, lights left on at night are not a mistake, and naps
// give Lights a use in the school day.

export const NEEDS_MAX = 4;
export const MESS_MAX = 3;
export const SNACK_PRICE = 1;
export const SNACKS_PER_DAY = 3;
export const NAP_MS = 20 * 60 * 1000;
export const HATCH_MS = 5 * 60 * 1000;
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
// An empty food or happy meter left this long is a care mistake.
export const MISTAKE_AFTER = 360;
export const NIGHT_FROM = 21;
export const NIGHT_UNTIL = 7;
// A care day is a day you fed, played or cleaned while your pal was well. The pal
// grows on the morning after enough care days.
export const GROW_AT = { baby: 2, child: 4, teen: 7 };
const NEXT_STAGE = { baby: 'child', child: 'teen', teen: 'adult' };
// Care mistakes from child to adult decide which adult it becomes.
export const WELL_RAISED_MAX_MISTAKES = 4;
// Weight: meals add 1, treats add 2, each game burns 1. A heavy pal skips treats.
export const BASE_WEIGHT = { baby: 5, child: 10, teen: 20, adult: 30 };
export const HEAVY_OVER = 15;
const MAX_CATCH_UP_MINUTES = 14 * 24 * 60;
const MINUTE = 60 * 1000;

const AUCKLAND = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function aucklandParts(ms) {
    const parts = Object.fromEntries(AUCKLAND.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

// Auckland's offset is a whole number of hours, so the date and night are the same
// for every minute of a UTC hour; caching per hour keeps a long catch-up fast.
const byHour = new Map();
function hourInfo(ms) {
    const hourKey = Math.floor(ms / 3600000);
    if (!byHour.has(hourKey)) {
        if (byHour.size > 5000) byHour.clear();
        const { date, hour } = aucklandParts(ms);
        byHour.set(hourKey, { date, night: hour >= NIGHT_FROM || hour < NIGHT_UNTIL });
    }
    return byHour.get(hourKey);
}

export function isNight(ms) {
    return hourInfo(ms).night;
}

export function aucklandDate(ms) {
    return hourInfo(ms).date;
}

export function createDonutPal({ name = 'Pal', species = 'mossbit', nowMs }) {
    return {
        version: 2, name, species, stage: 'egg', form: null, hatchAt: nowMs + HATCH_MS, bornAt: null,
        hunger: 0, happy: 0, weight: 0, mess: 0, sick: false, doses: 0, sleepy: false, napUntil: 0, lightsOff: false,
        gamesInRow: 0, snackDate: '', snacks: 0, caredDates: [], mistakes: 0,
        timers: { hunger: 0, happy: 0, mess: 0, messAge: 0, empty: 0, sad: 0 },
        at: nowMs, events: [],
    };
}

export function isAsleep(pal, ms = pal.at) {
    return pal.stage !== 'egg' && (isNight(ms) || ms < pal.napUntil);
}

export function isHeavy(pal) {
    return pal.stage !== 'egg' && pal.weight >= BASE_WEIGHT[pal.stage] + HEAVY_OVER;
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

function makeSick(pal, ms) {
    // 1-3 doses, as in the manual; derived from the time so the server agrees.
    pal.sick = true; pal.doses = (Math.floor(ms / MINUTE) % 3) + 1; pal.mistakes += 1;
    pal.events.push({ type: 'sick', at: ms });
}

function stepMinute(pal, ms) {
    const t = pal.timers;
    if (pal.stage === 'egg') {
        if (ms >= pal.hatchAt) {
            // Hearts start empty, so a new baby calls for you straight away.
            Object.assign(pal, { stage: 'baby', bornAt: pal.hatchAt, hunger: 0, happy: 0, weight: BASE_WEIGHT.baby });
            pal.events.push({ type: 'hatched', at: ms });
        }
        return;
    }
    const night = isNight(ms);
    // The first awake minute of each day is the morning (normally 7am, later if a
    // rest day froze the morning), so growing up is never skipped.
    if (!night && pal.wakeDate !== aucklandDate(ms)) wakeUp(pal, ms);
    if (pal.napUntil && ms >= pal.napUntil) {
        pal.napUntil = 0; pal.sleepy = false; pal.gamesInRow = 0; pal.lightsOff = false;
        pal.happy = Math.min(NEEDS_MAX, pal.happy + 1);
        pal.events.push({ type: 'napped', at: ms });
    }
    if (night || ms < pal.napUntil) return;
    if (++t.hunger >= HUNGER_EVERY) { t.hunger = 0; pal.hunger = Math.max(0, pal.hunger - 1); }
    if (++t.happy >= HAPPY_EVERY) { t.happy = 0; pal.happy = Math.max(0, pal.happy - 1); }
    if (++t.mess >= MESS_EVERY) { t.mess = 0; pal.mess = Math.min(MESS_MAX, pal.mess + 1); }
    t.messAge = pal.mess > 0 ? t.messAge + 1 : 0;
    t.empty = pal.hunger === 0 ? t.empty + 1 : 0;
    t.sad = pal.happy === 0 ? t.sad + 1 : 0;
    if (t.empty === MISTAKE_AFTER) pal.mistakes += 1;
    if (t.sad === MISTAKE_AFTER) pal.mistakes += 1;
    if (!pal.sick && (t.messAge >= SICK_AFTER_MESS || t.empty >= SICK_AFTER_EMPTY)) makeSick(pal, ms);
}

// Morning: lights back on, a fresh game streak, and growing up if enough good
// care days have passed. A sick pal waits (neglect slows growth).
function wakeUp(pal, ms) {
    pal.wakeDate = aucklandDate(ms);
    pal.lightsOff = false; pal.gamesInRow = 0; pal.sleepy = false;
    const next = NEXT_STAGE[pal.stage];
    if (!next || pal.sick || careDays(pal) < GROW_AT[pal.stage]) return;
    pal.stage = next;
    pal.weight = Math.max(pal.weight, BASE_WEIGHT[next]);
    if (next === 'child') pal.mistakes = 0;
    if (next === 'adult') pal.form = pal.mistakes <= WELL_RAISED_MAX_MISTAKES ? 'good' : 'scruffy';
    pal.events.push({ type: 'grew', stage: next, form: pal.form, at: ms });
}

// Catch up minute by minute (at most 14 days), exactly like a pocket pet left in a
// bag. `isFrozen(ms)` marks rest time (holidays, Holiday Mode, YumPals switched
// off): those minutes pass with no change at all.
export function advance(pal, nowMs, { isFrozen = () => false } = {}) {
    if (nowMs <= pal.at) return pal;
    const next = clone(pal);
    const minutes = Math.min(MAX_CATCH_UP_MINUTES, Math.floor((nowMs - pal.at) / MINUTE));
    let ms = pal.at;
    for (let i = 0; i < minutes; i++) { ms += MINUTE; if (!isFrozen(ms)) stepMinute(next, ms); }
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
export function act(pal, action, { nowMs, donuts = 0, wins = 0, isFrozen } = {}) {
    const current = advance(pal, nowMs, { isFrozen });
    if (current.stage === 'egg') return refuse(current, 'egg');
    // The manual allows only Lights (and Status, which changes nothing) while asleep.
    if (isAsleep(current, nowMs) && action !== 'lights') return refuse(current, 'asleep');
    const next = clone(current);
    switch (action) {
        case 'meal':
            if (next.hunger >= NEEDS_MAX) return refuse(current, 'full');
            next.hunger += 1; next.weight += 1; markCared(next, nowMs);
            return { pal: next, ok: true, animation: 'eat' };
        case 'snack': {
            const today = aucklandParts(nowMs).date;
            const eaten = next.snackDate === today ? next.snacks : 0;
            if (next.sick) return refuse(current, 'sick');
            if (eaten >= SNACKS_PER_DAY) return refuse(current, 'treats');
            if (isHeavy(next)) return refuse(current, 'heavy');
            if (next.happy >= NEEDS_MAX) return refuse(current, 'happy');
            if (donuts < SNACK_PRICE) return refuse(current, 'donuts');
            next.snackDate = today; next.snacks = eaten + 1;
            next.happy += 1; next.weight += 2;
            markCared(next, nowMs);
            return { pal: next, ok: true, animation: 'snack', cost: SNACK_PRICE };
        }
        case 'game': {
            if (next.sick) return refuse(current, 'sick');
            if (next.sleepy) return refuse(current, 'sleepy');
            const won = wins >= GAME_WINS_NEEDED;
            if (won) next.happy = Math.min(NEEDS_MAX, next.happy + 1);
            next.weight = Math.max(BASE_WEIGHT[next.stage], next.weight - 1);
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
            next.doses = Math.max(0, next.doses - 1);
            if (next.doses > 0) return { pal: next, ok: true, animation: 'dose' };
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

// Words for screen readers and the caption; the device itself shows no text.
export const REFUSALS = {
    egg: 'Your egg is still hatching.',
    asleep: 'Shh, your pal is asleep. Only Lights and Status work now.',
    full: 'Your pal is full.',
    happy: 'Your pal is already happy.',
    heavy: 'Your pal is too heavy for treats. Play a game.',
    sick: 'Your pal feels too sick for that. Try Medicine.',
    treats: 'That is enough treats for today.',
    donuts: 'A treat costs 1 donut.',
    sleepy: 'Your pal is sleepy. Turn the lights off for a nap.',
    clean: 'Nothing to clean.',
    well: 'Your pal is not sick.',
    napping: 'Your pal is napping.',
    awake: 'Your pal is not sleepy.',
    unknown: 'That did nothing.',
};

const STAGE_WORDS = { baby: 'a baby', child: 'a child', teen: 'a teen', adult: 'an adult' };

export function describePal(pal, ms = pal.at) {
    if (pal.stage === 'egg') return `${pal.name} is an egg, about to hatch.`;
    const stage = pal.stage === 'adult' ? `${pal.form === 'scruffy' ? 'a scruffy' : 'a well-raised'} adult` : STAGE_WORDS[pal.stage];
    const parts = [`${pal.name} is ${stage}`];
    if (isAsleep(pal, ms)) parts.push(ms < pal.napUntil ? 'napping' : 'asleep');
    if (pal.sick) parts.push('sick');
    if (pal.hunger === 0) parts.push('hungry');
    if (pal.happy === 0) parts.push('sad');
    if (pal.mess) parts.push(`${pal.mess} mess${pal.mess > 1 ? 'es' : ''} to clean`);
    if (pal.sleepy && ms >= pal.napUntil) parts.push('sleepy');
    if (isHeavy(pal)) parts.push('heavy');
    return `${parts.join(', ')}. Food ${pal.hunger} of 4, happy ${pal.happy} of 4, weight ${pal.weight}.`;
}
