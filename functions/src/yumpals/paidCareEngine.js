// Additive server foundation. No client clock, wallet lookup or production exports.
const { createHash } = require('node:crypto');
const { isValidPersistedState, validateName, speciesById, validateCase, validateColor } = require('./rules');

const PRICES = Object.freeze({ adoption: 5, meal: 2, snack: 1, game: 2, pat: 1, clean: 1, medicine: 2, bedtime: 1, reminder: 1 });
const RESTORES = Object.freeze({ meal: 2, snack: 1, game: 2, pat: 1, clean: 2, medicine: 2 });
const KEYS = Object.freeze({ meal: 'hunger', snack: 'hunger', game: 'happiness', pat: 'happiness', clean: 'cleanliness', medicine: 'health' });
const DAY = 86400000;
const FULL = Object.freeze({ hunger: 4, happiness: 4, cleanliness: 4, health: 4 });

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function requireValue(condition, code = 'CORRUPT_STATE') { if (!condition) fail(code); }
function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER) { return Number.isSafeInteger(value) && value >= min && value <= max; }
function dayNumber(key) {
  requireValue(typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(key), 'INVALID_DATE');
  const ms = Date.parse(`${key}T00:00:00Z`);
  requireValue(Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === key, 'INVALID_DATE');
  return ms / DAY;
}
function dateKey(day) { return new Date(day * DAY).toISOString().slice(0, 10); }
function aucklandNow(nowMs) {
  requireValue(integer(nowMs, 0, 253402214400000), 'INVALID_CLOCK');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(nowMs)).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

function validateConfig(config) {
  requireValue(config && config.schemaVersion === 1 && typeof config.version === 'string' && /^[A-Za-z0-9_-]{1,80}$/u.test(config.version), 'INVALID_CONFIG');
  requireValue(typeof config.enabled === 'boolean' && integer(config.careCap, 1, 10000), 'INVALID_CONFIG');
  for (const action of Object.keys(PRICES)) requireValue(integer(config.prices?.[action], 1, 10000), 'INVALID_CONFIG');
  for (const action of Object.keys(RESTORES)) requireValue(integer(config.restores?.[action], 1, 4), 'INVALID_CONFIG');
  // Cheapest full recovery, including one reminder and bedtime, must fit the cap.
  const cheapest = (actions) => {
    const cost = [0, Infinity, Infinity, Infinity, Infinity];
    for (let need = 1; need <= 4; need += 1) {
      cost[need] = Math.min(...actions.map((action) => config.prices[action] + cost[Math.max(0, need - config.restores[action])]));
    }
    return cost[4];
  };
  const recovery = cheapest(['meal', 'snack']) + cheapest(['game', 'pat']) + cheapest(['clean']) + cheapest(['medicine']) + config.prices.reminder + config.prices.bedtime;
  requireValue(config.careCap >= recovery, 'INVALID_CONFIG');
  requireValue(Array.isArray(config.calendar) && config.calendar.length > 0 && config.calendar.length <= 256, 'INVALID_CALENDAR');
  let previous = -Infinity;
  for (const entry of config.calendar) {
    const start = dayNumber(entry.effectiveFrom);
    requireValue(start > previous && typeof entry.paused === 'boolean', 'INVALID_CALENDAR');
    previous = start;
    requireValue(Array.isArray(entry.holidays) && entry.holidays.length <= 2048 && Array.isArray(entry.absences) && entry.absences.length <= 2048, 'INVALID_CALENDAR');
    entry.holidays.forEach(dayNumber);
    for (const interval of entry.absences) requireValue(dayNumber(interval.from) <= dayNumber(interval.to), 'INVALID_CALENDAR');
  }
  validatePauses(config);
  return config;
}

function validatePauses(config) {
  if (!Object.hasOwn(config, 'pauses')) return;
  requireValue(Array.isArray(config.pauses) && config.pauses.length <= 512, 'INVALID_PAUSES');
  let previous = -Infinity;
  config.pauses.forEach((interval, index) => {
    requireValue(interval && Object.keys(interval).length === 2 && Object.hasOwn(interval, 'from') && Object.hasOwn(interval, 'to'), 'INVALID_PAUSES');
    const from = dayNumber(interval.from);
    const to = interval.to === null ? Infinity : dayNumber(interval.to);
    requireValue(from > previous && to >= from && (to !== Infinity || (!config.enabled && index === config.pauses.length - 1)), 'INVALID_PAUSES');
    previous = to;
  });
}

function pauseIntervals(config, from, to) {
  const merged = [];
  if (to < from) return merged;
  for (const interval of config.pauses || []) {
    const a = Math.max(from, dayNumber(interval.from));
    const b = Math.min(to, interval.to === null ? to : dayNumber(interval.to));
    if (a > b) continue;
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

function defaultConfig(effectiveFrom, version = 'trial-v1') {
  return { schemaVersion: 1, version, enabled: false, prices: { ...PRICES }, restores: { ...RESTORES }, careCap: 25,
    calendar: [{ effectiveFrom, paused: false, holidays: [], absences: [] }] };
}

// UTC is used only to count date labels, never to divide Auckland elapsed time.
function weekdays(from, to) {
  if (from > to) return 0;
  const length = to - from + 1;
  let count = Math.floor(length / 7) * 5;
  for (let index = 0; index < length % 7; index += 1) {
    const weekday = ((from + index + 4) % 7 + 7) % 7;
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

function calendarSegments(config, from, to, withControlPauses = false) {
  requireValue(dayNumber(config.calendar[0].effectiveFrom) <= from, 'CALENDAR_COVERAGE');
  if (to < from) return [];
  return config.calendar.flatMap((entry, index) => {
    const start = Math.max(from, dayNumber(entry.effectiveFrom));
    const end = Math.min(to, index + 1 < config.calendar.length ? dayNumber(config.calendar[index + 1].effectiveFrom) - 1 : to);
    if (start > end) return [];
    const intervals = [...entry.holidays.map((date) => [dayNumber(date), dayNumber(date)]), ...entry.absences.map(({ from: a, to: b }) => [dayNumber(a), dayNumber(b)]), ...(withControlPauses ? pauseIntervals(config, start, end) : [])]
      .map(([a, b]) => [Math.max(start, a), Math.min(end, b)]).filter(([a, b]) => a <= b).sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const interval of intervals) {
      const last = merged[merged.length - 1];
      if (last && interval[0] <= last[1] + 1) last[1] = Math.max(last[1], interval[1]);
      else merged.push([...interval]);
    }
    return [{ start, end, paused: entry.paused, frozen: merged }];
  });
}
function historyHash(config, start, through) { return digest(calendarSegments(config, dayNumber(start), dayNumber(through))); }
function eligibleCount(config, from, to) {
  return calendarSegments(config, from, to, true).reduce((sum, part) => sum + (part.paused ? 0 : weekdays(part.start, part.end) - part.frozen.reduce((n, [a, b]) => n + weekdays(a, b), 0)), 0);
}

function validatePet(pet, uid) {
  const state = pet?.paidCare;
  requireValue(isValidPersistedState(pet, uid));
  requireValue(state && state.schemaVersion === 2 && state.ownerUid === uid);
  requireValue(Object.keys(FULL).every((key) => integer(state.needs?.[key], 0, 4)));
  requireValue(typeof state.attention === 'boolean' && dayNumber(state.checkpoint) >= dayNumber(state.startedDate));
  requireValue(typeof state.historyHash === 'string' && /^[a-f0-9]{64}$/u.test(state.historyHash));
  if (Object.hasOwn(state, 'pauseHistoryHash')) requireValue(typeof state.pauseHistoryHash === 'string' && /^[a-f0-9]{64}$/u.test(state.pauseHistoryHash), 'PAUSE_HISTORY_CHANGED');
  requireValue(state.sleepDate === null || dayNumber(state.sleepDate) <= dayNumber(state.daily?.date));
  requireValue(state.game === null || (typeof state.game.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/u.test(state.game.id) && integer(state.game.benefit, 1, 4) && state.game.round === 0));
  requireValue(state.daily && integer(state.daily.spent) && dayNumber(state.daily.date) >= dayNumber(state.checkpoint));
  requireValue(integer(pet.careDays) && Array.isArray(pet.earnedMilestones));
  return state;
}

// Explicit migration only; never invoked by purchase/read as a silent repair.
function migrateLegacyPet(legacy, uid, config, nowMs) {
  validateConfig(config);
  if (legacy?.paidCare !== undefined) { validatePet(legacy, uid); return { ...legacy }; }
  requireValue(isValidPersistedState(legacy, uid), 'INVALID_LEGACY_PET');
  const { date } = aucklandNow(nowMs);
  return { ...legacy, paidCare: { schemaVersion: 2, ownerUid: uid, startedDate: date, checkpoint: date,
    historyHash: historyHash(config, date, date), needs: { ...FULL }, attention: false, sleepDate: null, game: null, daily: { date, spent: 0 } } };
}

function advancePet(pet, uid, config, nowMs) {
  validateConfig(config);
  const state = validatePet(pet, uid);
  const { date } = aucklandNow(nowMs);
  requireValue(dayNumber(date) >= dayNumber(state.daily.date), 'CLOCK_REVERSED');
  requireValue(state.historyHash === historyHash(config, state.startedDate, state.checkpoint), 'CALENDAR_HISTORY_CHANGED');
  const processedPauses = pauseIntervals(config, dayNumber(state.startedDate) + 1, dayNumber(state.checkpoint));
  requireValue(Object.hasOwn(state, 'pauseHistoryHash') ? state.pauseHistoryHash === digest(processedPauses) : processedPauses.length === 0, 'PAUSE_HISTORY_CHANGED');
  // No silent checkpoint movement while disabled. Activation MUST include pause
  // history for the disabled interval before enabled becomes true again.
  if (!config.enabled) return pet;
  const through = Math.max(dayNumber(state.checkpoint), dayNumber(date) - 1);
  const elapsed = eligibleCount(config, dayNumber(state.checkpoint) + 1, through);
  const needs = { ...state.needs };
  needs.health = Math.max(0, needs.health - Math.max(0, elapsed - Math.min(needs.hunger, needs.cleanliness)));
  for (const key of ['hunger', 'happiness', 'cleanliness']) needs[key] = Math.max(0, needs[key] - elapsed);
  const checkpoint = dateKey(through);
  const nextPauses = pauseIntervals(config, dayNumber(state.startedDate) + 1, through);
  return { ...pet, paidCare: { ...state, needs, checkpoint,
    ...(nextPauses.length || Object.hasOwn(state, 'pauseHistoryHash') ? { pauseHistoryHash: digest(nextPauses) } : {}),
    historyHash: historyHash(config, state.startedDate, checkpoint), daily: state.daily.date === date ? { ...state.daily } : { date, spent: 0 } } };
}

function purchaseEffect({ pet, uid, config, nowMs, action, operationId, adoption }) {
  validateConfig(config);
  if (!config.enabled) fail('DISABLED');
  requireValue(Object.hasOwn(PRICES, action), 'INVALID_ACTION');
  const { date, hour } = aucklandNow(nowMs);
  if (action === 'adoption') {
    if (pet) fail('ALREADY_ADOPTED');
    requireValue(adoption && validateName(adoption.name) && speciesById(adoption.species) && validateCase(adoption.casing) && validateColor(adoption.color), 'INVALID_ADOPTION');
    const legacy = { schemaVersion: 1, ownerUid: uid, name: validateName(adoption.name), species: adoption.species, casing: validateCase(adoption.casing), color: validateColor(adoption.color), reducedMotion: false, careDays: 0, earnedMilestones: [] };
    return { pet: migrateLegacyPet(legacy, uid, config, nowMs), amount: config.prices.adoption, needsBefore: null, benefit: { type: 'adoption', needs: { ...FULL } } };
  }
  if (!pet) fail('NO_PET');
  const next = advancePet(pet, uid, config, nowMs);
  const state = next.paidCare;
  const needsBefore = { ...state.needs };
  const amount = config.prices[action];
  let benefit;
  if (action === 'bedtime') {
    const sleepDate = hour < 7 ? dateKey(dayNumber(date) - 1) : date;
    if (state.sleepDate === sleepDate) fail('NO_EFFECT');
    state.sleepDate = sleepDate;
    benefit = { type: 'sleep', date: sleepDate };
  } else if (action === 'reminder') {
    if (!state.attention) fail('NO_EFFECT');
    state.attention = false;
    benefit = { type: 'attention', cleared: true };
  } else {
    if (action === 'game' && state.game) fail('GAME_ACTIVE');
    const key = KEYS[action];
    const gain = Math.min(config.restores[action], 4 - state.needs[key]);
    if (gain === 0) fail('NO_EFFECT');
    state.needs[key] += gain;
    benefit = { type: key, amount: gain };
    if (action === 'game') state.game = { id: operationId, benefit: gain, round: 0 };
  }
  if (state.daily.spent + amount > config.careCap) fail('CARE_CAP');
  state.daily.spent += amount;
  return { pet: next, amount, benefit, needsBefore };
}

module.exports = { PRICES, RESTORES, defaultConfig, validateConfig, validatePet, migrateLegacyPet, advancePet, purchaseEffect, aucklandNow, dayNumber, digest, requireValue, fail, integer };
