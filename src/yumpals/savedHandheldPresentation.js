import { PAID_CARE_ICON_HELP } from './paidCareIcons.js';
export const SAVED_HELP = { ...PAID_CARE_ICON_HELP,
  lights: 'Set lights out for bedtime. They come back on at 7 am.',
  game: 'Game is not ready yet. Choose Pat for happy hearts.',
  status: 'Check Food, Happy, Clean and Health hearts. No charge.',
};
export const SAVED_CHOICES = { food: ['meal', 'snack'], lights: ['bedtime'], game: ['game', 'pat'], medicine: ['medicine'], clean: ['clean'], discipline: ['reminder'] };
export const CARE_NAMES = { adoption: 'Adopt', meal: 'Meal', snack: 'Snack', game: 'Game', pat: 'Pat', clean: 'Clean', medicine: 'Medicine', bedtime: 'Bedtime', reminder: 'Reminder' };
export function savedCaseColor(pet) {
  return { berry: '#bd7890', mint: '#79a596', sky: '#7c9eb6', sun: '#baa16e' }[pet?.casing?.trim().toLowerCase()] || '#bd7890';
}
export function paidRoutePolicy({ paid, legacy, uid, authUid, anonymous, sandbox }) {
  return { legacyAllowed: legacy === true && paid !== true,
    savedAvailable: paid === true && typeof uid === 'string' && uid.length > 0 && uid === authUid && anonymous === false && sandbox === false };
}
export function savedSleep(quote) {
  if (!quote?.pet) return { sleeping: false, dim: false };
  const sleeping = quote.aucklandHour >= 19 || quote.aucklandHour < 7;
  const evening = quote.aucklandHour < 7 ? new Date(Date.parse(`${quote.aucklandDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : quote.aucklandDate;
  return { sleeping, dim: sleeping && quote.pet.sleepDate === evening };
}
export function savedEffect(quote, action) {
  if (action === 'adoption') return 'A pal with full Food, Happy, Clean and Health hearts';
  if (action === 'game') return 'Game is not ready yet';
  if (action === 'bedtime') return 'Lights out at night; back on at 7 am';
  if (action === 'reminder') return 'A gentle reminder to settle down';
  const key = { meal: 'hunger', snack: 'hunger', pat: 'happiness', clean: 'cleanliness', medicine: 'health' }[action];
  const label = { hunger: 'Food', happiness: 'Happy', cleanliness: 'Clean', health: 'Health' }[key];
  if (!key || !quote?.pet) return '';
  const n = Math.min(quote.restores[action], 4 - quote.pet.needs[key]);
  if (n === 0) return { meal: 'I’m full! No meal needed.', snack: 'I’m full! No snack needed.', pat: 'I’m already happy!', clean: 'I’m already clean!', medicine: 'I’m feeling healthy!' }[action];
  return `+${n} ${label} heart${n === 1 ? '' : 's'}`;
}
export function savedNoEffect(quote, action) {
  if (!quote?.pet) return null;
  if (action === 'game') return 'Game is not ready yet. Pat is available.';
  const key = { meal: 'hunger', snack: 'hunger', pat: 'happiness', clean: 'cleanliness', medicine: 'health' }[action];
  if (key && quote.pet.needs[key] === 4) return `${savedEffect(quote, action)} No donuts spent.`;
  if (action === 'reminder' && !quote.pet.attention) return 'I’m settled! No reminder needed. No donuts spent.';
  const evening = quote.aucklandHour < 7 ? new Date(Date.parse(`${quote.aucklandDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : quote.aucklandDate;
  if (action === 'bedtime' && quote.pet.sleepDate === evening) return 'Bedtime lights are already set. No donuts spent.';
  return null;
}
export function savedContextMatches({ enabled, ownerUid, projectId, identity, state }) {
  return enabled === true && identity?.uid === ownerUid && identity.isAnonymous === false && identity.sandbox === false
    && state.ownerUid === ownerUid && state.projectId === projectId;
}
export function savedChargeLocked(state) {
  return Boolean(state.busy || state.pending || state.storageBlocked || !state.quote?.enabled || !state.quote?.wallet.available);
}
