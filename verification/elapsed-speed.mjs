import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const before = createRequire(resolve(process.argv[2], 'functions/package.json'))('./src/yumpals/elapsedCare');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const after = require('./src/yumpals/elapsedCare');
const { aucklandNow } = require('./src/yumpals/paidCareEngine');
const HOUR = 3600000, now = Date.parse('2026-10-04T00:00:00Z');
const date = ms => aucklandNow(ms).date;
let seed = 817234;
const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
for (let i = 0; i < 400; i++) {
  const start = now - (random(2500) + 1) * HOUR - random(HOUR);
  const periods = []; let cursor = start - 20 * HOUR;
  for (let j = 0; j < random(40); j++) {
    cursor += random(36 * HOUR); const end = cursor + random(80 * HOUR);
    periods.push({ from: cursor, to: j === 4 && i % 7 === 0 ? null : end }); cursor = end;
    if (periods.at(-1).to === null) break;
  }
  const config = { calendar: [{ effectiveFrom: '2000-01-01', paused: i % 17 === 0,
    holidays: ['2026-09-27'], absences: [{ from: '2026-09-02', to: '2026-09-06' }] }],
    pauses: i % 3 ? [] : [{ from: '2026-08-28', to: '2026-09-04' }], holidayPeriods: periods };
  const state = { needs: Object.fromEntries(['hunger', 'happiness', 'cleanliness', 'health'].map(key => [key, random(5)])),
    elapsedClock: { ...after.initialClock(start), hunger: random(8 * HOUR), happiness: random(12 * HOUR), cleanliness: random(24 * HOUR), health: random(24 * HOUR) } };
  assert.deepEqual(after.advanceElapsed(state, config, now, date), before.advanceElapsed(state, config, now, date), `case ${i}`);
}
const results = [];
for (const [days, count] of [[1, 0], [30, 20], [90, 512]]) {
  const start = now - days * 24 * HOUR;
  const config = { calendar: [{ effectiveFrom: '2000-01-01', paused: false, holidays: [], absences: [] }],
    holidayPeriods: Array.from({ length: count }, (_, i) => i === count - 1 ? { from: start, to: now - HOUR }
      : { from: start - (count - i) * 2 * HOUR, to: start - (count - i) * 2 * HOUR + HOUR }) };
  const state = { needs: { hunger: 4, happiness: 4, cleanliness: 4, health: 4 }, elapsedClock: after.initialClock(start) };
  const measurements = {};
  for (const [label, implementation] of Object.entries({ before, after })) {
    const samples = [];
    for (let i = 0; i < 7; i++) { const at = performance.now(); implementation.advanceElapsed(state, config, now, date); samples.push(performance.now() - at); }
    measurements[label] = +samples.sort((a, b) => a - b)[3].toFixed(2);
  }
  assert.deepEqual(after.advanceElapsed(state, config, now, date), before.advanceElapsed(state, config, now, date));
  results.push({ days, holidayEntries: count, medianMs: measurements });
}
console.log(JSON.stringify({ equivalentCases: 403, results }, null, 2));
