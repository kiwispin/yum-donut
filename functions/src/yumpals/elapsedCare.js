// Server-time care clock. No timers, clients or wallets participate in decay.
const HOUR = 3600000;
const PERIODS = { hunger: 8 * HOUR, happiness: 12 * HOUR, cleanliness: 24 * HOUR };
function initialClock(nowMs) {
  return { version: 1, at: nowMs, hunger: 0, happiness: 0, cleanliness: 0, health: 0 };
}
function validClock(clock) {
  return clock && clock.version === 1 && Number.isSafeInteger(clock.at) && clock.at >= 0
    && Object.entries({ ...PERIODS, health: 24 * HOUR }).every(([key, period]) => Number.isSafeInteger(clock[key]) && clock[key] >= 0 && clock[key] < period);
}
function isRestDate(config, date) {
  const entry = [...config.calendar].reverse().find(item => item.effectiveFrom <= date);
  if (!entry) throw Object.assign(new Error('CALENDAR_COVERAGE'), { code: 'CALENDAR_COVERAGE' });
  return entry.paused || entry.holidays.includes(date) || entry.absences.some(p => p.from <= date && p.to >= date)
    || (config.pauses || []).some(p => p.from <= date && (p.to === null || p.to >= date));
}
function advanceElapsed(state, config, nowMs, dateForMs) {
  const needs = { ...state.needs };
  // Existing pets retain all meters at rollout; their clock starts on first contact.
  if (!state.elapsedClock) return { needs, elapsedClock: initialClock(nowMs) };
  if (!validClock(state.elapsedClock)) throw Object.assign(new Error('CORRUPT_STATE'), { code: 'CORRUPT_STATE' });
  if (nowMs < state.elapsedClock.at) throw Object.assign(new Error('CLOCK_REVERSED'), { code: 'CLOCK_REVERSED' });
  const clock = { ...state.elapsedClock };
  let cursor = clock.at;
  // Holiday history is immutable for this calculation. Sort upcoming edges
  // once instead of rebuilding/scanning the same boundary array every hour.
  const boundaries = (config.holidayPeriods || []).flatMap(p => [p.from, p.to])
    .filter(n => n !== null && n > cursor).sort((a, b) => a - b);
  const relevantHolidays = (config.holidayPeriods || [])
    .filter(p => p.from < nowMs && (p.to === null || p.to > cursor));
  let boundaryIndex = 0;
  while (cursor < nowMs) {
    // Auckland midnight (including DST) is aligned with a UTC hour boundary.
    while (boundaries[boundaryIndex] <= cursor) boundaryIndex++;
    const end = Math.min(nowMs, (Math.floor(cursor / HOUR) + 1) * HOUR, boundaries[boundaryIndex] ?? Infinity);
    const holiday = relevantHolidays.some(p => p.from <= cursor && (p.to === null || cursor < p.to));
    if (!holiday && !isRestDate(config, dateForMs(cursor))) {
      let left = end - cursor;
      while (left > 0) {
        const unhealthy = needs.hunger === 0 || needs.cleanliness === 0;
        if (!unhealthy) clock.health = 0;
        const step = Math.min(left, ...Object.entries(PERIODS).map(([key, period]) => period - clock[key]), unhealthy ? 24 * HOUR - clock.health : Infinity);
        for (const [key, period] of Object.entries(PERIODS)) {
          clock[key] += step;
          if (clock[key] === period) { needs[key] = Math.max(0, needs[key] - 1); clock[key] = 0; }
        }
        if (unhealthy) {
          clock.health += step;
          if (clock.health === 24 * HOUR) { needs.health = Math.max(0, needs.health - 1); clock.health = 0; }
        }
        left -= step;
      }
    }
    cursor = end;
    // Once all meters bottom out, additional absence cannot create debt or damage.
    if (Object.values(needs).every(n => n === 0)) { Object.keys(PERIODS).forEach(key => { clock[key] = 0; }); clock.health = 0; break; }
  }
  clock.at = nowMs;
  return { needs, elapsedClock: clock };
}
module.exports = { initialClock, validClock, advanceElapsed };
