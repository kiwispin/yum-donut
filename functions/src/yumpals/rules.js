const AUCKLAND_TIME_ZONE = 'Pacific/Auckland';

const SPECIES = Object.freeze([
  { id: 'mossbit', name: 'Mossbit', description: 'A gentle garden sprite with very good listening ears.' },
  { id: 'pufflet', name: 'Pufflet', description: 'A buoyant cloudling that collects tiny happy thoughts.' },
  { id: 'emberoo', name: 'Emberoo', description: 'A warm little hopper who turns pats into sparkles.' },
]);

const CASES = Object.freeze(['berry', 'mint', 'sky', 'sun']);
const GROWTH_SPEEDS = Object.freeze(['gentle', 'standard', 'quick']);
const SPEED_THRESHOLDS = Object.freeze({
  gentle: [4, 7, 14, 28],
  standard: [3, 5, 10, 20],
  quick: [2, 4, 8, 16],
});

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  holidayRest: true,
  growthSpeed: 'standard',
  availableSpecies: SPECIES.map((species) => species.id),
  holidayDates: [],
});

function normaliseText(value) {
  return String(value || '').trim().normalize('NFKC');
}

function validateName(value) {
  const name = normaliseText(value);
  if (!name || name.length > 16 || !/^[\p{L}\p{N} _-]+$/u.test(name)) return null;
  return name;
}

function validateColor(value) {
  const color = normaliseText(value).toLowerCase();
  return /^#[0-9a-f]{6}$/u.test(color) ? color : null;
}

function validateCase(value) {
  const casing = normaliseText(value).toLowerCase();
  return CASES.includes(casing) ? casing : null;
}

function speciesById(id) {
  return SPECIES.find((species) => species.id === id) || null;
}

function sanitiseSettings(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const availableSpecies = Array.isArray(source.availableSpecies)
    ? source.availableSpecies.filter((id) => Boolean(speciesById(id)))
    : DEFAULT_SETTINGS.availableSpecies;
  const holidayDates = Array.isArray(source.holidayDates)
    ? source.holidayDates.filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/u.test(String(dateKey)))
    : DEFAULT_SETTINGS.holidayDates;

  return {
    enabled: source.enabled === true,
    holidayRest: source.holidayRest !== false,
    growthSpeed: GROWTH_SPEEDS.includes(source.growthSpeed) ? source.growthSpeed : DEFAULT_SETTINGS.growthSpeed,
    availableSpecies: [...new Set(availableSpecies.length ? availableSpecies : DEFAULT_SETTINGS.availableSpecies)],
    holidayDates: [...new Set(holidayDates)],
  };
}

function getAucklandDateParts(nowMs) {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: AUCKLAND_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(nowMs)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function schoolDayStatus(nowMs, settings) {
  const date = getAucklandDateParts(nowMs);
  if (date.weekday === 'Sat' || date.weekday === 'Sun') {
    return { ...date, eligible: false, reason: 'WEEKEND' };
  }
  if (settings.holidayRest && settings.holidayDates.includes(date.dateKey)) {
    return { ...date, eligible: false, reason: 'HOLIDAY' };
  }
  return { ...date, eligible: true, reason: null };
}

function growthForCareDays(careDays, speed = 'standard', persistedEarnedMilestones = []) {
  const thresholds = SPEED_THRESHOLDS[GROWTH_SPEEDS.includes(speed) ? speed : 'standard'];
  const milestones = [
    { key: 'trick', label: 'Trick learned', at: thresholds[0], reward: 'A tiny signature trick' },
    { key: 'accessory', label: 'Accessory unlocked', at: thresholds[1], reward: 'A wearable accessory' },
    { key: 'junior', label: 'Junior stage', at: thresholds[2], reward: 'A favourite toy' },
    { key: 'grown', label: 'Grown stage', at: thresholds[3], reward: 'A room theme' },
  ];
  const persisted = new Set(Array.isArray(persistedEarnedMilestones) ? persistedEarnedMilestones : []);
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
    completed: completed.map((milestone) => milestone.key),
    next,
    progressToNext: next ? Math.min(1, careDays / next.at) : 1,
  };
}

function growthForDisplay(careDays, speed = 'standard', persistedEarnedMilestones = []) {
  const thresholds = SPEED_THRESHOLDS[GROWTH_SPEEDS.includes(speed) ? speed : 'standard'];
  const milestones = [
    { key: 'trick', label: 'Trick learned', at: thresholds[0], reward: 'A tiny signature trick' },
    { key: 'accessory', label: 'Accessory unlocked', at: thresholds[1], reward: 'A wearable accessory' },
    { key: 'junior', label: 'Junior stage', at: thresholds[2], reward: 'A favourite toy' },
    { key: 'grown', label: 'Grown stage', at: thresholds[3], reward: 'A room theme' },
  ];
  const completedKeys = new Set(Array.isArray(persistedEarnedMilestones) ? persistedEarnedMilestones : []);
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

function publicPet(state, settings) {
  if (!state) return null;
  if (!Number.isSafeInteger(state.careDays) || state.careDays < 0) return null;
  const careDays = state.careDays;
  const growth = growthForDisplay(careDays, settings.growthSpeed, state.earnedMilestones);
  return {
    name: state.name,
    species: state.species,
    color: state.color,
    casing: state.casing,
    reducedMotion: state.reducedMotion === true,
    careDays,
    earnedMilestones: state.earnedMilestones,
    growth,
  };
}

function isValidPersistedState(state, uid) {
  return Boolean(
    state
    && state.schemaVersion === 1
    && state.ownerUid === uid
    && speciesById(state.species)
    && validateName(state.name)
    && validateColor(state.color)
    && validateCase(state.casing)
    && typeof state.reducedMotion === 'boolean'
    && Number.isSafeInteger(state.careDays)
    && state.careDays >= 0
    && Array.isArray(state.earnedMilestones)
    && new Set(state.earnedMilestones).size === state.earnedMilestones.length
    && state.earnedMilestones.every((milestone) => ['trick', 'accessory', 'junior', 'grown'].includes(milestone))
  );
}

function isValidDayRecord(day, dateKey) {
  if (!day || day.dateKey !== dateKey || !day.actions || typeof day.actions !== 'object') return false;
  if (day.actions.feed !== undefined && typeof day.actions.feed !== 'boolean') return false;
  if (day.actions.pat !== undefined && typeof day.actions.pat !== 'boolean') return false;
  const expectedComplete = day.actions.feed === true && day.actions.pat === true;
  return day.complete === expectedComplete;
}

function validAction(action) {
  return action === 'feed' || action === 'pat';
}

module.exports = {
  AUCKLAND_TIME_ZONE,
  CASES,
  DEFAULT_SETTINGS,
  GROWTH_SPEEDS,
  SPECIES,
  SPEED_THRESHOLDS,
  growthForCareDays,
  growthForDisplay,
  getAucklandDateParts,
  isValidDayRecord,
  isValidPersistedState,
  normaliseText,
  publicPet,
  sanitiseSettings,
  schoolDayStatus,
  speciesById,
  validateCase,
  validateColor,
  validateName,
  validAction,
};
