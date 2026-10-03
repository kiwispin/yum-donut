// Durable local queue for paid YumPals care. The server remains authoritative:
// local state only reserves a validated quote until the matching operation is
// proved committed or refused.
const ACTIONS = ['adoption', 'meal', 'snack', 'game', 'pat', 'clean', 'medicine', 'bedtime', 'reminder'];
const QUEUEABLE_ACTIONS = ['meal', 'snack', 'pat', 'clean', 'medicine', 'bedtime', 'reminder'];
const RESTORES = ['meal', 'snack', 'game', 'pat', 'clean', 'medicine'];
const NEEDS = ['hunger', 'happiness', 'cleanliness', 'health'];
const REFUSALS = ['DISABLED', 'RECONFIRM_CONFIG', 'NO_EFFECT', 'INSUFFICIENT_FUNDS', 'CARE_CAP', 'NO_PET', 'ALREADY_ADOPTED', 'GAME_ACTIVE'];
const JOURNAL_VERSION = 2;
const LEGACY_JOURNAL_VERSION = 1;
const CLAIM_TIMEOUT_MS = 15000;
const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const integer = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= min && v <= max;
const money = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/u.test(v);
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const needs = v => exact(v, NEEDS) && NEEDS.every(k => integer(v[k], 0, 4));
const invalid = (message = 'INVALID_RESPONSE') => { throw new Error(message); };

function normalizedAdoption(v) {
  if (!exact(v, ['name', 'species', 'casing', 'color']) || !Object.values(v).every(s => typeof s === 'string')) return null;
  const name = v.name.trim().normalize('NFKC'); const casing = v.casing.trim().normalize('NFKC').toLowerCase(); const color = v.color.trim().normalize('NFKC').toLowerCase();
  return name.length > 0 && name.length <= 16 && /^[\p{L}\p{N} _-]+$/u.test(name) && ['mossbit', 'pufflet', 'emberoo'].includes(v.species)
    && ['berry', 'mint', 'sky', 'sun'].includes(casing) && /^#[0-9a-f]{6}$/u.test(color) ? { name, species: v.species, casing, color } : null;
}
const adopt = v => Boolean(normalizedAdoption(v));
export function validPaidCareRequest(v) {
  return exact(v, ['operationId', 'action', 'expectedConfigVersion', 'expectedConfigHash', ...(v?.action === 'adoption' ? ['adoption'] : [])])
    && id(v.operationId) && ACTIONS.includes(v.action) && id(v.expectedConfigVersion) && hash(v.expectedConfigHash)
    && (v.action !== 'adoption' || adopt(v.adoption));
}
const validRequest = validPaidCareRequest;
function canonical(v) {
  return { operationId: v.operationId, action: v.action, expectedConfigVersion: v.expectedConfigVersion, expectedConfigHash: v.expectedConfigHash,
    adoption: v.action === 'adoption' ? { name: v.adoption.name, species: v.adoption.species, casing: v.adoption.casing, color: v.adoption.color } : null };
}
async function binding(v) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(v))));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function validateHandheldView(v, ownerUid) {
  if (!exact(v, ['schemaVersion', 'ownerUid', 'enabled', 'configVersion', 'configHash', 'prices', 'restores', 'careCap', 'serverNowMs', 'aucklandDate', 'aucklandHour', 'pet', 'wallet'])
    || v.schemaVersion !== 1 || v.ownerUid !== ownerUid || typeof v.enabled !== 'boolean' || !id(v.configVersion) || !hash(v.configHash)
    || !exact(v.prices, ACTIONS) || !ACTIONS.every(k => integer(v.prices[k], 1, 10000))
    || !exact(v.restores, RESTORES) || !RESTORES.every(k => integer(v.restores[k], 1, 4)) || !integer(v.careCap, 1, 10000)
    || !integer(v.serverNowMs, 0, 253402214400000) || !date(v.aucklandDate) || !integer(v.aucklandHour, 0, 23)) invalid();
  if (v.wallet?.available === true ? !exact(v.wallet, ['available', 'balance']) || !money(v.wallet.balance)
    : !exact(v.wallet, ['available']) || v.wallet.available !== false) invalid();
  const clock = Object.fromEntries(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(v.serverNowMs)).map(p => [p.type, p.value]));
  if (v.aucklandDate !== `${clock.year}-${clock.month}-${clock.day}` || v.aucklandHour !== Number(clock.hour)) invalid();
  const p = v.pet;
  if (p !== null && (!exact(p, ['name', 'species', 'casing', 'color', 'reducedMotion', 'careDays', 'earnedMilestones', 'needs', 'daily', 'sleepDate', 'attention', 'game'])
    || !adopt({ name: p.name, species: p.species, casing: p.casing, color: p.color })
    || typeof p.reducedMotion !== 'boolean' || !integer(p.careDays) || !Array.isArray(p.earnedMilestones)
    || new Set(p.earnedMilestones).size !== p.earnedMilestones.length || !p.earnedMilestones.every(k => ['trick', 'accessory', 'junior', 'grown'].includes(k))
    || !needs(p.needs) || !exact(p.daily, ['date', 'spent']) || !date(p.daily.date) || !integer(p.daily.spent)
    || p.daily.date > v.aucklandDate || (p.sleepDate !== null && (!date(p.sleepDate) || p.sleepDate > p.daily.date)) || typeof p.attention !== 'boolean'
    || (p.game !== null && (!exact(p.game, ['id', 'benefit', 'round']) || !id(p.game.id) || !integer(p.game.benefit, 1, 4) || p.game.round !== 0)))) invalid();
  return structuredClone(v);
}

async function validateOutcome(v, pending, ownerUid) {
  if (!exact(v, ['outcome', 'duplicate', ...(Object.hasOwn(v || {}, 'state') ? ['state'] : [])]) || typeof v.duplicate !== 'boolean') invalid();
  const o = v.outcome; const r = pending.request;
  const common = ['schemaVersion', 'status', 'ownerUid', 'operationId', 'binding', 'committedAtMs', 'request'];
  if (!plain(o) || o.schemaVersion !== 1 || o.ownerUid !== ownerUid || o.operationId !== r.operationId
    || !integer(o.committedAtMs, 0, 253402214400000) || o.binding !== await binding(r)
    || !exact(o.request, ['operationId', 'action', 'expectedConfigVersion', 'expectedConfigHash', 'adoption'])
    || (r.action === 'adoption' ? !adopt(o.request.adoption) : o.request.adoption !== null)
    || JSON.stringify(canonical(o.request)) !== JSON.stringify(canonical(r))) invalid();
  if (o.status === 'REFUSED') {
    if (!exact(o, [...common, 'reason']) || !REFUSALS.includes(o.reason)) invalid();
  } else {
    if (!exact(o, [...common, 'action', 'amount', 'configVersion', 'configHash', 'walletBefore', 'walletAfter', 'benefit']) || o.status !== 'COMMITTED'
      || o.action !== r.action || o.amount !== pending.quotedCost || o.configVersion !== r.expectedConfigVersion || o.configHash !== r.expectedConfigHash
      || !money(o.walletBefore) || !money(o.walletAfter) || o.walletAfter !== o.walletBefore - o.amount || o.walletAfter >= o.walletBefore
      || o.walletBefore - o.walletAfter !== o.amount || o.walletAfter + o.amount !== o.walletBefore) invalid();
    const b = o.benefit; const key = { meal: 'hunger', snack: 'hunger', game: 'happiness', pat: 'happiness', clean: 'cleanliness', medicine: 'health' }[r.action];
    if (key ? !exact(b, ['type', 'amount']) || b.type !== key || !integer(b.amount, 1, 4)
      : r.action === 'adoption' ? !exact(b, ['type', 'needs']) || b.type !== 'adoption' || !needs(b.needs) || !NEEDS.every(k => b.needs[k] === 4)
        : r.action === 'bedtime' ? !exact(b, ['type', 'date']) || b.type !== 'sleep' || !date(b.date)
          : !exact(b, ['type', 'cleared']) || b.type !== 'attention' || b.cleared !== true) invalid();
  }
  return structuredClone(o);
}

// Keep the old key: v1 records at this key are migrated in place to v2.
export const paidCareJournalKey = (projectId, ownerUid) => `yumpals-paid-purchase-v1:${encodeURIComponent(projectId)}:${encodeURIComponent(ownerUid)}`;
export const paidCareSequenceKey = (projectId, ownerUid) => `yumpals-paid-sequence-v1:${encodeURIComponent(projectId)}:${encodeURIComponent(ownerUid)}`;
export const paidCareNamespaceKey = (projectId, ownerUid) => `yumpals-paid-namespace-v1:${encodeURIComponent(projectId)}:${encodeURIComponent(ownerUid)}`;
export const paidCareLockName = (projectId, ownerUid) => `yumpals-paid-queue-lock:${encodeURIComponent(projectId)}:${encodeURIComponent(ownerUid)}`;

function refusalMessage(outcome) {
  const full = { meal: 'I’m full! No meal needed.', snack: 'I’m full! No snack needed.', game: 'I’m already happy!', pat: 'I’m already happy!', clean: 'I’m already clean!', medicine: 'I’m feeling healthy!', reminder: 'I’m settled! No reminder needed.', bedtime: 'Bedtime lights are already set.' };
  const messages = { DISABLED: 'YumPals is resting. Your teacher has paused care.', RECONFIRM_CONFIG: 'Care choices have changed. Check the new price before buying.',
    INSUFFICIENT_FUNDS: 'You need more donuts for this care.', CARE_CAP: 'This costs more than you can spend on care today.', NO_PET: 'Adopt a pal before buying care.',
    ALREADY_ADOPTED: 'You already have a pal.', GAME_ACTIVE: 'Your paid game is waiting. No new game was bought.' };
  return `${(outcome.reason === 'NO_EFFECT' ? full[outcome.request.action] : messages[outcome.reason]) || 'This care is not needed right now.'} No donuts spent on this purchase.`;
}
function readErrorMessage(error) {
  const messages = { MIGRATION_REQUIRED: 'Please ask your teacher to update your saved pal.', UNAUTHENTICATED: 'Please sign in again to see your saved pal.',
    PERMISSION_DENIED: 'Please ask your teacher to check access to your saved pal.', ROLLOUT_NOT_READY: 'Saved YumPals is not ready yet.' };
  const reason = error?.details?.reason;
  return `${typeof reason === 'string' && Object.hasOwn(messages, reason) ? messages[reason] : 'Your pal could not be checked. Please refresh.'} Any pending purchase is kept.`;
}

function exactDebit(before, amount) {
  const after = before - amount;
  return money(before) && integer(amount, 1, 10000) && money(after) && after < before && before - after === amount && after + amount === before ? after : null;
}
function localActionError(code, message = code) { return Object.assign(new Error(message), { code }); }
function copyPet(pet) { return pet ? structuredClone(pet) : null; }
function sleepDate(quote) {
  if (!quote?.pet) return null;
  return quote.aucklandHour < 7 ? new Date(Date.parse(`${quote.aucklandDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : quote.aucklandDate;
}

// Apply one reservation to a validated authoritative view. It intentionally
// uses the quoted integer price and exact subtraction; it never rounds.
function reserveAgainst(view, entry) {
  if (!view || !view.wallet.available) throw localActionError('WALLET_UNAVAILABLE', 'Your donuts could not be checked.');
  const action = entry.request.action; const cost = entry.quotedCost;
  if (!QUEUEABLE_ACTIONS.includes(action) && action !== 'adoption' && action !== 'game') throw localActionError('EXCLUDED_ACTION');
  if (view.configVersion !== entry.request.expectedConfigVersion || view.configHash !== entry.request.expectedConfigHash || view.prices[action] !== cost) throw localActionError('RECONFIRM_CONFIG');
  const walletBefore = view.wallet.balance; const walletAfter = exactDebit(walletBefore, cost);
  if (walletAfter === null) throw localActionError('INSUFFICIENT_FUNDS');
  const pet = copyPet(view.pet); const dailyBefore = pet?.daily.spent || 0;
  if (dailyBefore + cost > view.careCap) throw localActionError('CARE_CAP');
  const beforeNeeds = pet ? { ...pet.needs } : null;
  if (action === 'adoption') {
    if (pet) throw localActionError('ALREADY_ADOPTED');
    const adoption = entry.request.adoption;
    const adopted = { name: adoption.name, species: adoption.species, casing: adoption.casing, color: adoption.color, reducedMotion: false, careDays: 0,
      earnedMilestones: [], needs: { hunger: 4, happiness: 4, cleanliness: 4, health: 4 }, daily: { date: view.aucklandDate, spent: 0 }, sleepDate: null, attention: false, game: null };
    return { view: { ...view, pet: adopted, wallet: { available: true, balance: walletAfter } }, reservation: { walletBefore, walletAfter, dailyDate: view.aucklandDate, dailyBefore: 0, dailyAfter: 0, needsBefore: null, needsAfter: adopted.needs } };
  }
  if (!pet) throw localActionError('NO_PET');
  if (action === 'game' && pet.game) throw localActionError('GAME_ACTIVE');
  if (action === 'reminder' && !pet.attention) throw localActionError('NO_EFFECT');
  if (action === 'bedtime' && pet.sleepDate === sleepDate(view)) throw localActionError('NO_EFFECT');
  const key = { meal: 'hunger', snack: 'hunger', game: 'happiness', pat: 'happiness', clean: 'cleanliness', medicine: 'health' }[action];
  let gain = 0;
  if (key) {
    gain = Math.min(view.restores[action], 4 - pet.needs[key]);
    if (gain <= 0) throw localActionError('NO_EFFECT');
    pet.needs[key] += gain;
    if (action === 'game') pet.game = { id: entry.request.operationId, benefit: gain, round: 0 };
  } else if (action === 'reminder') pet.attention = false;
  else if (action === 'bedtime') pet.sleepDate = sleepDate(view);
  pet.daily = { date: pet.daily.date, spent: dailyBefore + cost };
  return { view: { ...view, pet, wallet: { available: true, balance: walletAfter } }, reservation: { walletBefore, walletAfter, dailyDate: pet.daily.date, dailyBefore, dailyAfter: pet.daily.spent, needsBefore: beforeNeeds, needsAfter: { ...pet.needs } } };
}

function validateReservation(v) {
  return exact(v, ['walletBefore', 'walletAfter', 'dailyDate', 'dailyBefore', 'dailyAfter', 'needsBefore', 'needsAfter'])
    && money(v.walletBefore) && money(v.walletAfter) && date(v.dailyDate) && integer(v.dailyBefore) && integer(v.dailyAfter)
    && (v.needsBefore === null || needs(v.needsBefore)) && (v.needsAfter === null || needs(v.needsAfter));
}
function validateEntry(v) {
  if (!exact(v, ['request', 'quotedCost', 'phase', 'claimedBy', 'claimedAtMs', 'reservation']) || !validRequest(v.request) || !integer(v.quotedCost, 1, 10000)
    || !['queued', 'inflight', 'uncertain'].includes(v.phase) || (v.claimedBy !== null && !id(v.claimedBy))
    || (v.claimedAtMs !== null && !integer(v.claimedAtMs, 0, 253402214400000)) || (v.phase === 'inflight' ? v.claimedBy === null || v.claimedAtMs === null : v.claimedBy !== null || v.claimedAtMs !== null)
    || !validateReservation(v.reservation)) invalid('INVALID_JOURNAL');
  return structuredClone(v);
}
function validateJournal(v, ownerUid, projectId) {
  if (!exact(v, ['schemaVersion', 'ownerUid', 'projectId', 'basis', 'entries']) || v.schemaVersion !== JOURNAL_VERSION || v.ownerUid !== ownerUid || v.projectId !== projectId
    || (v.basis !== null && (!plain(v.basis) || v.basis.ownerUid !== ownerUid)) || !Array.isArray(v.entries) || v.entries.length > 32) invalid('INVALID_JOURNAL');
  const basis = v.basis === null ? null : validateHandheldView(v.basis, ownerUid);
  const entries = v.entries.map(validateEntry);
  if (entries.some((entry, index) => index > 0 && entry.request.operationId === entries[index - 1].request.operationId)) invalid('INVALID_JOURNAL');
  return { schemaVersion: JOURNAL_VERSION, ownerUid, projectId, basis, entries };
}
function emptyJournal(ownerUid, projectId, basis) { return { schemaVersion: JOURNAL_VERSION, ownerUid, projectId, basis: basis ? structuredClone(basis) : null, entries: [] }; }
function publicQueue(entries) { return entries.map(({ request, quotedCost, phase, reservation }) => ({ action: request.action, operationId: request.operationId, quotedCost, phase, reserved: reservation.walletBefore - reservation.walletAfter })); }
function projectedFor(journal) {
  if (!journal?.basis) return null;
  let view = structuredClone(journal.basis); let reserved = 0;
  for (const entry of journal.entries) { const next = reserveAgainst(view, entry); view = next.view; reserved += entry.quotedCost; }
  return { view, reserved };
}
function journalRaw(storage, key, ownerUid, projectId) {
  const raw = storage.getItem(key);
  if (raw === null) return { raw: null, journal: null, legacy: false };
  const saved = JSON.parse(raw);
  if (saved?.schemaVersion === LEGACY_JOURNAL_VERSION) {
    if (!exact(saved, ['schemaVersion', 'ownerUid', 'projectId', 'request', 'quotedCost']) || saved.ownerUid !== ownerUid || saved.projectId !== projectId
      || !validRequest(saved.request) || !integer(saved.quotedCost, 1, 10000)) invalid('INVALID_JOURNAL');
    const entry = { request: saved.request, quotedCost: saved.quotedCost, phase: 'uncertain', claimedBy: null, claimedAtMs: null,
      reservation: { walletBefore: 0, walletAfter: 0, dailyDate: '1970-01-01', dailyBefore: 0, dailyAfter: 0, needsBefore: null, needsAfter: null } };
    return { raw, journal: { schemaVersion: JOURNAL_VERSION, ownerUid, projectId, basis: null, entries: [entry] }, legacy: true };
  }
  return { raw, journal: validateJournal(saved, ownerUid, projectId), legacy: false };
}
function getLockProvider(locks) { return locks || globalThis.navigator?.locks || null; }
function operationInstance() { try { return globalThis.crypto.randomUUID(); } catch { return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; } }

export function createPaidCareController({ ownerUid, projectId, enabled, getIdentity, transport, storage,
  locks, onChange = () => {}, onConfirmed = () => {}, onQueued = () => {}, autoRecover = false }) {
  let active = true; let networkBusy = false; let blocked = false; let pumping = false; let journal = null; let currentQuote = null;
  let viewRevision = 0; let refreshing = null;
  let recoveryTimer; let recoveryCount = 0; const instanceId = operationInstance(); const freshOperationIds = new Set(); const lockProvider = getLockProvider(locks);
  let state = { quote: null, projected: null, confirmation: null, pending: false, busy: false, storageBlocked: false, queue: [], reserved: { wallet: 0, daily: 0 }, message: '' };
  const key = paidCareJournalKey(projectId, ownerUid); const sequenceKey = paidCareSequenceKey(projectId, ownerUid); const namespaceKey = paidCareNamespaceKey(projectId, ownerUid); const lockName = paidCareLockName(projectId, ownerUid);
  const current = () => { const i = getIdentity(); return active && enabled === true && typeof ownerUid === 'string' && ownerUid.length > 0
    && typeof projectId === 'string' && projectId.length > 0 && i?.uid === ownerUid && i.isAnonymous === false && i.sandbox === false; };
  const emit = patch => { if (current()) { state = { ...state, ...patch }; onChange(structuredClone(state)); } };
  const showBlocked = () => { if (active) { state = { ...state, quote: null, projected: null, confirmation: null, message: enabled !== true ? 'Saved YumPals is not ready yet.' : 'Please sign in to see your saved pal.' }; onChange(structuredClone(state)); } };
  const storageError = (message = 'Your purchase could not be kept safely. Check browser storage, then close and reopen. Any earlier purchase still needs checking.') => { blocked = true; state = { ...state, storageBlocked: true, confirmation: null, message }; if (current()) onChange(structuredClone(state)); };
  const withLock = async callback => {
    if (typeof lockProvider?.request !== 'function') { storageError('This browser cannot protect your queue across tabs. Update the browser before confirming paid care.'); return null; }
    try { return await lockProvider.request(lockName, { mode: 'exclusive' }, callback); } catch { storageError(); return null; }
  };
  const readJournal = () => journalRaw(storage, key, ownerUid, projectId);
  const writeJournal = (next, expectedRaw) => {
    const serialized = JSON.stringify(next);
    if (expectedRaw !== undefined && storage.getItem(key) !== expectedRaw) throw new Error('JOURNAL_CHANGED');
    storage.setItem(key, serialized); if (storage.getItem(key) !== serialized) throw new Error('JOURNAL_WRITE_FAILED'); return serialized;
  };
  const syncStateFromJournal = (next, message = state.message) => {
    viewRevision++;
    journal = next; let projection = null; let reserved = { wallet: 0, daily: 0 };
    if (next?.basis) { try { const projected = projectedFor(next); projection = projected.view; reserved = { wallet: projected.reserved, daily: Math.max(0, (projection.pet?.daily.spent || 0) - (next.basis.pet?.daily.spent || 0)) }; }
      catch { storageError('Your saved queue no longer matches its original prices or needs. No new charge was sent; refresh to review it.'); return; } }
    if (next?.basis) currentQuote = structuredClone(next.basis);
    state = { ...state, quote: currentQuote ? structuredClone(currentQuote) : null, projected: projection, queue: publicQueue(next?.entries || []), pending: Boolean(next?.entries?.length), reserved, message };
    if (current()) onChange(structuredClone(state));
  };
  async function readFresh() {
    if (!current()) return null;
    try { const value = validateHandheldView(await transport('yumpalsGetPaidCareState', {}, { ownerUid, isActive: current }), ownerUid); if (!current()) return null; return value; }
    catch (error) { if (current()) emit({ message: readErrorMessage(error) }); return null; }
  }
  async function read(message = '') {
    const revision = viewRevision;
    const value = await readFresh(); if (!value || !current()) return;
    if (revision !== viewRevision) return; // A newer local reservation/receipt wins over an old background read.
    if (!journal) {
      currentQuote = structuredClone(value);
      const confirmation = state.confirmation;
      const stillValid = confirmation && value.enabled && value.wallet.available
        && confirmation.expectedConfigVersion === value.configVersion && confirmation.expectedConfigHash === value.configHash
        && confirmation.quotedCost === value.prices[confirmation.action];
      emit({ quote: value, projected: value, confirmation: stillValid ? confirmation : null,
        message: confirmation && !stillValid ? 'Care choices have changed. Please choose again before paying.' : message });
    }
    else if (journal.entries[0]?.phase === 'uncertain' || journal.entries[0]?.phase === 'inflight') emit({ message: message || 'A purchase needs checking. Use Retry purchase.' });
    else await rebase(value, message);
  }
  async function refresh() {
    if (!current()) { showBlocked(); return; }
    if (blocked || networkBusy) return;
    if (!refreshing) refreshing = read(journal ? 'A purchase needs checking. Use Retry purchase.' : '').finally(() => { refreshing = null; });
    await refreshing;
  }
  async function rebase(view, message = '') {
    if (!current()) return;
    if (!journal) { currentQuote = structuredClone(view); emit({ quote: view, projected: view, message }); return; }
    if (journal.entries.some(entry => entry.phase !== 'queued')) { emit({ message: message || 'A purchase needs checking. Use Retry purchase.' }); return; }
    const result = await withLock(() => { try {
      if (!current()) return null;
      const latest = readJournal(); if (!latest.journal || latest.journal.entries.some(entry => entry.phase !== 'queued')) return null;
      const next = structuredClone(latest.journal); const originalBasis = next.basis; next.basis = structuredClone(view); let projected = next.basis; const keep = []; const released = [];
      for (const entry of next.entries) { try { const checked = reserveAgainst(projected, entry); projected = checked.view; keep.push(entry); } catch (error) { released.push(error.code || 'NO_EFFECT'); } }
      if (view.configVersion !== originalBasis?.configVersion || view.configHash !== originalBasis?.configHash) { released.push(...next.entries.map(() => 'RECONFIRM_CONFIG')); next.entries = []; }
      else next.entries = keep;
      if (!current()) return null;
      writeJournal(next, latest.raw); return { next, released };
    } catch { storageError(); return null; } });
    if (result?.next && current()) syncStateFromJournal(result.next, result.released.length ? 'Some queued care was released after checking your saved pal. Review the latest price and needs.' : message);
  }
  async function claimHead() {
    return withLock(() => { try {
      if (!current()) return null;
      const latest = readJournal(); if (!latest.journal?.entries.length) { journal = latest.journal; return null; }
      const next = latest.journal; const head = next.entries[0]; const now = Date.now();
      if (head.phase === 'inflight' && head.claimedBy !== instanceId && now - head.claimedAtMs < CLAIM_TIMEOUT_MS) { syncStateFromJournal(next); return false; }
      if (head.phase === 'inflight' && head.claimedBy !== instanceId) head.phase = 'uncertain';
      head.phase = 'inflight'; head.claimedBy = instanceId; head.claimedAtMs = now; writeJournal(next, latest.raw); syncStateFromJournal(next); return structuredClone(head);
    } catch { storageError(); return null; } });
  }
  async function markUncertain(operationId) {
    if (!current()) return;
    freshOperationIds.delete(operationId);
    await withLock(() => { try { const latest = readJournal(); if (!latest.journal?.entries.length || latest.journal.entries[0].request.operationId !== operationId) return;
      if (!current()) return;
      const head = latest.journal.entries[0]; if (head.claimedBy === instanceId || head.phase !== 'inflight') { head.phase = 'uncertain'; head.claimedBy = null; head.claimedAtMs = null; writeJournal(latest.journal, latest.raw); syncStateFromJournal(latest.journal, autoRecover ? 'Still saving. You can explore while we reconnect.' : 'We could not confirm your purchase. It is kept here. Use Retry purchase to check it before buying again.'); }
    } catch { storageError(); } });
  }
  async function freshAndFinalize(head, outcome, response) {
    let resolvedView;
    if (outcome.status === 'COMMITTED' && !response.duplicate && Object.hasOwn(response, 'state')) {
      resolvedView = validateHandheldView(response.state, ownerUid);
      if (!resolvedView.enabled || resolvedView.serverNowMs !== outcome.committedAtMs || resolvedView.configVersion !== outcome.configVersion || resolvedView.configHash !== outcome.configHash
        || !resolvedView.wallet.available || resolvedView.wallet.balance !== outcome.walletAfter || !resolvedView.pet || resolvedView.prices[outcome.action] !== outcome.amount) invalid();
    } else { resolvedView = await readFresh(); if (!resolvedView) throw new Error('FRESH_READ_FAILED'); }
    const result = await withLock(() => { try {
      if (!current()) return { stale: true };
      const latest = readJournal(); const next = latest.journal;
      if (!current() || !next?.entries.length || next.entries[0].request.operationId !== head.request.operationId) return { stale: true };
      next.entries.shift(); next.basis = structuredClone(resolvedView); const released = []; let projected = next.basis; const keep = [];
      for (const entry of next.entries) { try { const checked = reserveAgainst(projected, entry); projected = checked.view; keep.push(entry); } catch (error) { released.push(error.code || 'NO_EFFECT'); } }
      next.entries = keep;
      if (resolvedView.configVersion !== head.request.expectedConfigVersion || resolvedView.configHash !== head.request.expectedConfigHash) { released.push(...next.entries.map(() => 'RECONFIRM_CONFIG')); next.entries = []; }
      if (next.entries.length) writeJournal(next, latest.raw); else { storage.removeItem(key); if (storage.getItem(key) !== null) throw new Error('JOURNAL_REMOVE_FAILED'); }
      return { next: next.entries.length ? next : null, released };
    } catch { storageError(); return { failed: true }; } });
    if (!current() || !result || result.failed || result.stale) return result;
    const wasOriginal = freshOperationIds.has(head.request.operationId); freshOperationIds.delete(head.request.operationId);
    if (result.next) syncStateFromJournal(result.next, result.released?.length ? 'Some queued care was released after checking your saved pal. Review the latest price and needs.' : '');
    else { viewRevision++; journal = null; currentQuote = structuredClone(resolvedView); transport.remember?.(resolvedView); emit({ quote: resolvedView, projected: resolvedView, pending: false, queue: [], reserved: { wallet: 0, daily: 0 }, message: outcome.status === 'REFUSED' ? refusalMessage(outcome) : 'Purchase confirmed.' }); }
    if (wasOriginal && !response.duplicate && outcome.status === 'COMMITTED') { try { onConfirmed(outcome); } catch { /* Presentation cannot undo a confirmed purchase. */ } }
    return result;
  }
  function scheduleRecovery() { if (!autoRecover || !current() || blocked) return; clearTimeout(recoveryTimer); const delay = [1000, 3000, 8000][Math.min(recoveryCount++, 2)]; recoveryTimer = setTimeout(() => { if (current()) void pump(); }, delay); }
  async function pump() {
    if (pumping || !current() || blocked) return; pumping = true;
    try { while (current() && !blocked) {
      const head = await claimHead(); if (head === null) break; if (head === false) { scheduleRecovery(); break; }
      networkBusy = true; emit({ busy: true });
      try { const response = await transport('yumpalsPurchaseCare', structuredClone(head.request), { ownerUid, isActive: current }); if (!current()) break;
        const outcome = await validateOutcome(response, head, ownerUid); const result = await freshAndFinalize(head, outcome, response); if (result?.failed || result?.stale) break; recoveryCount = 0;
      } catch { await markUncertain(head.request.operationId); scheduleRecovery(); break; }
      finally { networkBusy = false; emit({ busy: false }); }
      if (journal?.entries.length && journal.entries[0].phase === 'uncertain') break;
    } } finally { pumping = false; }
  }
  const enqueue = async confirmation => {
    if (!current() || blocked || !confirmation) return false;
    const result = await withLock(() => { try {
      if (!current()) return null;
      const loaded = readJournal(); let next = loaded.journal; const base = next?.basis || currentQuote || state.quote;
      if (next?.entries[0]?.phase === 'uncertain') throw localActionError('HEAD_UNCERTAIN', 'Please reconnect the first saved care before adding more.');
      if ((confirmation.action === 'adoption' || confirmation.action === 'game') && next?.entries.length) throw localActionError('EXCLUDED_ACTION', confirmation.action === 'game' ? 'Finish saving your care before starting a game.' : 'Adoption will be ready after your saved care finishes.');
      if (next?.entries.length >= 32) throw localActionError('QUEUE_FULL', 'Your saved care queue is full. Finish saving before adding more.');
      if (!base) throw localActionError('NO_BASIS'); if (!next) next = emptyJournal(ownerUid, projectId, base);
      const sequenceRaw = storage.getItem(sequenceKey); let sequence = sequenceRaw === null ? 0 : Number(sequenceRaw);
      if (!integer(sequence)) throw new Error('INVALID_SEQUENCE');
      let namespace = storage.getItem(namespaceKey);
      if (namespace === null) { namespace = globalThis.crypto.randomUUID().replaceAll('-', ''); storage.setItem(namespaceKey, namespace); }
      if (typeof namespace !== 'string' || !/^[a-f0-9]{32}$/u.test(namespace) || storage.getItem(namespaceKey) !== namespace) throw new Error('INVALID_NAMESPACE');
      for (const item of next.entries) { const match = new RegExp(`^yumpals-care-${namespace}-(\\d+)$`, 'u').exec(item.request.operationId); if (match) sequence = Math.max(sequence, Number(match[1])); }
      if (sequence >= Number.MAX_SAFE_INTEGER) throw new Error('INVALID_SEQUENCE');
      if (confirmation.expectedConfigVersion !== base.configVersion || confirmation.expectedConfigHash !== base.configHash || confirmation.quotedCost !== base.prices[confirmation.action]) throw localActionError('RECONFIRM_CONFIG');
      const nextSequence = sequence + 1; const request = { operationId: `yumpals-care-${namespace}-${nextSequence}`, action: confirmation.action, expectedConfigVersion: confirmation.expectedConfigVersion, expectedConfigHash: confirmation.expectedConfigHash,
        ...(confirmation.action === 'adoption' ? { adoption: structuredClone(confirmation.adoption) } : {}) };
      if (!validRequest(request)) throw new Error('INVALID_REQUEST');
      const entry = { request, quotedCost: confirmation.quotedCost, phase: 'queued', claimedBy: null, claimedAtMs: null,
        reservation: { walletBefore: 0, walletAfter: 0, dailyDate: base.aucklandDate, dailyBefore: 0, dailyAfter: 0, needsBefore: null, needsAfter: null } };
      const projected = projectedFor(next)?.view || next.basis; const checked = reserveAgainst(projected, entry); entry.reservation = checked.reservation;
      next.entries.push(entry); storage.setItem(sequenceKey, String(nextSequence)); if (storage.getItem(sequenceKey) !== String(nextSequence)) throw new Error('SEQUENCE_WRITE_FAILED');
      writeJournal(next, loaded.raw); if (!current()) return null; journal = next; currentQuote = structuredClone(next.basis); syncStateFromJournal(next); return { entry: structuredClone(entry) };
    } catch (error) { if (error?.code === 'HEAD_UNCERTAIN' || error?.code === 'EXCLUDED_ACTION' || error?.code === 'QUEUE_FULL') { emit({ message: error.message }); return null; }
      storageError(error?.code === 'RECONFIRM_CONFIG' ? 'Care choices have changed. Refresh and confirm the new price before buying.' : `Queue storage failed safely (${error?.message || 'unknown error'}).`); return null; } });
    if (result?.entry && current()) { freshOperationIds.add(result.entry.request.operationId); try { onQueued({ action: result.entry.request.action, operationId: result.entry.request.operationId }); } catch { /* Presentation cannot prevent recovery. */ } const started = pump(); await started; return true; }
    return false;
  };
  const externalStorage = event => { if (event?.key !== key || !active || blocked) return; void (async () => { try {
    const loaded = readJournal();
    if (loaded.journal) syncStateFromJournal(loaded.journal);
    else { journal = null; currentQuote = null; emit({ quote: null, projected: null, pending: false, queue: [], reserved: { wallet: 0, daily: 0 } }); await read(); }
    if (!pumping) void pump();
  } catch { storageError(); } })(); };
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('storage', externalStorage);
  return {
    getState: () => structuredClone(state),
    start: async () => { if (!current()) { showBlocked(); return; }
      try { const loaded = readJournal(); if (loaded.legacy) await withLock(() => { try { const latest = readJournal(); if (latest.legacy) writeJournal(latest.journal, latest.raw); } catch { storageError(); } });
        const after = readJournal(); journal = after.journal; if (journal?.basis) { currentQuote = structuredClone(journal.basis); syncStateFromJournal(journal, journal.entries.length ? 'A purchase needs checking. Use Retry purchase.' : ''); }
        const warm = transport.peek?.(ownerUid); const recent = warm || transport.peekRecent?.(ownerUid);
        if (recent && !journal?.basis) { currentQuote = validateHandheldView(recent, ownerUid); emit({ quote: currentQuote, projected: journal ? null : currentQuote }); }
        if (journal?.entries.length) { if (autoRecover) await pump(); } else if (!warm) await refresh();
      } catch { storageError(); }
    },
    prepare: (action, adoption) => { if (!current()) { showBlocked(); return; } if (blocked) return;
      if (!ACTIONS.includes(action) || (action === 'adoption' ? !adopt(adoption) : adoption !== undefined)) { emit({ confirmation: null, message: 'Choose a valid pal and colour, with a name of 1–16 letters, numbers, spaces, hyphens or underscores.' }); return; }
      if (!state.quote && !journal?.basis) { emit({ message: 'Please refresh to check your pal before buying.' }); return; }
      const base = journal?.basis || state.quote; if (!base.enabled) { emit({ message: 'YumPals is resting. Your teacher has paused care.' }); return; }
      if (!base.wallet.available) { emit({ message: 'Your donuts could not be checked. Please ask your teacher to check your account.' }); return; }
      if ((action === 'adoption' || action === 'game') && journal?.entries.length) { emit({ message: action === 'game' ? 'Paid guessing game cannot be queued with other care. Finish or retry it first.' : 'Adoption needs a live confirmation and cannot be queued with other care.' }); return; }
      const projected = journal ? (() => { try { return projectedFor(journal)?.view; } catch { return null; } })() : base; if (!projected) { emit({ message: 'Your saved queue needs checking before another purchase can be confirmed.' }); return; }
      const quotedCost = base.prices[action];
      try { reserveAgainst(projected, { request: { operationId: 'preview', action, expectedConfigVersion: base.configVersion, expectedConfigHash: base.configHash, ...(action === 'adoption' ? { adoption: normalizedAdoption(adoption) } : {}) }, quotedCost, reservation: null }); }
      catch (error) { const messages = { INSUFFICIENT_FUNDS: 'You do not have enough saved donuts for this care.', CARE_CAP: 'This would exceed today’s care limit.', NO_EFFECT: 'This care is not needed right now. No donuts spent.', NO_PET: 'Adopt a pal before buying care.', GAME_ACTIVE: 'Your paid game is waiting. Finish it before buying another game.', RECONFIRM_CONFIG: 'Care choices have changed. Refresh before buying.' }; emit({ confirmation: null, message: messages[error.code] || 'This care is not available right now.' }); return; }
      emit({ confirmation: { action, ...(action === 'adoption' ? { adoption: normalizedAdoption(adoption) } : {}), quotedCost, expectedConfigVersion: base.configVersion, expectedConfigHash: base.configHash } });
    },
    cancel: () => { if (current()) emit({ confirmation: null }); },
    confirm: async () => { if (!current() || blocked || !state.confirmation) return; const confirmation = structuredClone(state.confirmation); emit({ confirmation: null }); await enqueue(confirmation); },
    retry: async () => { recoveryCount = 0; await pump(); },
    refresh, dispose: () => { active = false; clearTimeout(recoveryTimer); if (typeof globalThis.removeEventListener === 'function') globalThis.removeEventListener('storage', externalStorage); },
  };
}
