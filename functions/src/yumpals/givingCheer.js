// Giving cheer: the first donut a student gives a teammate on an Auckland school
// day adds one free happiness heart the next time they load their pal. It reads
// the giving record the app and Teams bot already write to the private profile;
// like all giving data that record is client-writable, so this is not tamper-proof.
// It never charges, pays out or counts toward the daily care cap.
const { aucklandNow, dayNumber, requireValue } = require('./paidCareEngine');
const { isRestDate } = require('./elapsedCare');

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_HAPPINESS = 4;

// "Wed Oct 28 2026" (browser toDateString, or the Teams bot's Auckland label) → "2026-10-28".
function givingDateKey(label) {
  const match = typeof label === 'string' && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) ([A-Z][a-z]{2}) (\d{2}) (\d{4})$/u.exec(label);
  if (!match || !MONTHS[match[2]]) return null;
  const key = `${match[4]}-${String(MONTHS[match[2]]).padStart(2, '0')}-${match[3]}`;
  const ms = Date.parse(`${key}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== key) return null;
  return WEEKDAYS[new Date(ms).getUTCDay()] === match[1] ? key : null;
}

// A fresh profile records today's date with given_today 0, so both are required.
function gaveOn(profile, date) {
  return Boolean(profile) && Number.isSafeInteger(profile.given_today) && profile.given_today > 0
    && givingDateKey(profile.last_given_date) === date;
}

function isCheerRestDay(config, date, nowMs) {
  const weekday = ((dayNumber(date) + 4) % 7 + 7) % 7;
  const holiday = (config.holidayPeriods || []).some(p => p.from <= nowMs && (p.to === null || nowMs < p.to));
  return weekday === 0 || weekday === 6 || holiday || isRestDate(config, date);
}

// Returns null when no cheer is due, otherwise the updated pet and the cheer.
function applyGivingCheer({ pet, config, nowMs, giving }) {
  if (!pet || !config.enabled) return null;
  const state = pet.paidCare;
  requireValue(state.cheerDate === undefined || (typeof state.cheerDate === 'string' && dayNumber(state.cheerDate) >= 0), 'CORRUPT_STATE');
  const { date } = aucklandNow(nowMs);
  if (state.cheerDate === date || !gaveOn(giving, date) || isCheerRestDay(config, date, nowMs)) return null;
  const gain = Math.min(1, MAX_HAPPINESS - state.needs.happiness);
  const needs = { ...state.needs, happiness: state.needs.happiness + gain };
  return { pet: { ...pet, paidCare: { ...state, needs, cheerDate: date } }, cheer: { date, gain }, needsBefore: { ...state.needs } };
}

module.exports = { givingDateKey, gaveOn, isCheerRestDay, applyGivingCheer };
