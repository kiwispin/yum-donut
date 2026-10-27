// Daily visit gift: the first time a student loads their pal on a day, the pal
// gets one free heart in its lowest need. After 7+ days away it is a welcome
// back instead: one free heart in every need that is not full. Free: never
// charges, pays out or counts toward the daily care cap. Paused with the pal
// (YumPals disabled, Holiday Mode, calendar rest days).
const { aucklandNow, dayNumber, requireValue } = require('./paidCareEngine');
const { isRestDate } = require('./elapsedCare');

const NEEDS = ['hunger', 'happiness', 'cleanliness', 'health'];
const MAX = 4;
const WELCOME_BACK_MS = 7 * 86400000;

// lastSeenMs: when the pal was last loaded before now (null if unknown).
function applyVisitGift({ pet, config, nowMs, lastSeenMs }) {
  if (!pet || !config.enabled) return null;
  const state = pet.paidCare;
  requireValue(state.visitDate === undefined || (typeof state.visitDate === 'string' && dayNumber(state.visitDate) >= 0), 'CORRUPT_STATE');
  const { date } = aucklandNow(nowMs);
  if (state.visitDate === date) return null;
  const holiday = (config.holidayPeriods || []).some(p => p.from <= nowMs && (p.to === null || nowMs < p.to));
  if (holiday || isRestDate(config, date)) return null;
  const welcomeBack = Number.isSafeInteger(lastSeenMs) && nowMs - lastSeenMs >= WELCOME_BACK_MS;
  const needs = { ...state.needs };
  const gains = Object.fromEntries(NEEDS.map(key => [key, 0]));
  const give = key => { if (needs[key] < MAX) { needs[key] += 1; gains[key] = 1; } };
  if (welcomeBack) NEEDS.forEach(give);
  else give(NEEDS.reduce((lowest, key) => (needs[key] < needs[lowest] ? key : lowest), NEEDS[0]));
  return { pet: { ...pet, paidCare: { ...state, needs, visitDate: date } }, visit: { date, welcomeBack, gains }, needsBefore: { ...state.needs } };
}

module.exports = { applyVisitGift, WELCOME_BACK_MS };
