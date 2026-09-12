// Local controller only: no Firebase imports, simulated wallets or auto-purchases.
const ACTIONS = ['adoption', 'meal', 'snack', 'game', 'pat', 'clean', 'medicine', 'bedtime', 'reminder'];
const RESTORES = ['meal', 'snack', 'game', 'pat', 'clean', 'medicine'];
const NEEDS = ['hunger', 'happiness', 'cleanliness', 'health'];
const REFUSALS = ['DISABLED', 'RECONFIRM_CONFIG', 'NO_EFFECT', 'INSUFFICIENT_FUNDS', 'CARE_CAP', 'NO_PET', 'ALREADY_ADOPTED', 'GAME_ACTIVE'];
const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const integer = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= min && v <= max;
const money = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/u.test(v);
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const needs = v => exact(v, NEEDS) && NEEDS.every(k => integer(v[k], 0, 4));
const invalid = () => { throw new Error('INVALID_RESPONSE'); };
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
export const paidCareJournalKey = (projectId, ownerUid) => `yumpals-paid-purchase-v1:${encodeURIComponent(projectId)}:${encodeURIComponent(ownerUid)}`;
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
export function createPaidCareController({ ownerUid, projectId, enabled, getIdentity, transport, storage, operationId,
  onChange = () => {}, onConfirmed = () => {} }) {
  let active = true; let busy = false; let pending = null; let raw = null; let blocked = false;
  let state = { quote: null, confirmation: null, pending: false, busy: false, storageBlocked: false, message: '' };
  const key = paidCareJournalKey(projectId, ownerUid);
  const current = () => { const i = getIdentity(); return active && enabled === true && typeof ownerUid === 'string' && ownerUid.length > 0
    && typeof projectId === 'string' && projectId.length > 0 && i?.uid === ownerUid && i.isAnonymous === false && i.sandbox === false; };
  const emit = patch => { if (current()) { state = { ...state, ...patch }; onChange(structuredClone(state)); } };
  const blockedMessage = () => enabled !== true ? 'Saved YumPals is not ready yet.' : 'Please sign in to see your saved pal.';
  const showBlocked = () => { if (active) { state = { ...state, quote: null, confirmation: null, message: blockedMessage() }; onChange(structuredClone(state)); } };
  const storageError = () => { blocked = true; emit({ storageBlocked: true, message: 'Your purchase could not be kept safely. Check browser storage, then close and reopen. Any earlier purchase still needs checking.' }); };
  const matches = () => { try { if (storage.getItem(key) === raw) return true; } catch { /* Block without discarding recovery. */ } storageError(); return false; };
  async function read(message = '') {
    if (!current()) return;
    try {
      const v = await transport('yumpalsGetPaidCareState', {}, { ownerUid, isActive: current });
      if (current()) emit({ quote: validateHandheldView(v, ownerUid), confirmation: null, message });
    } catch (error) { emit({ quote: null, confirmation: null, message: readErrorMessage(error) }); }
  }
  async function refresh() {
    if (!current()) { showBlocked(); return; }
    if (busy || blocked) return;
    busy = true; emit({ busy: true });
    try { await read(pending ? 'A purchase needs checking. Use Retry purchase.' : ''); }
    finally { busy = false; emit({ busy: false }); }
  }
  async function dispatch(original = false) {
    if (!current() || busy || blocked || !pending || !matches()) return;
    busy = true; emit({ busy: true, confirmation: null });
    try {
      const response = await transport('yumpalsPurchaseCare', structuredClone(pending.request), { ownerUid, isActive: current });
      if (!current()) return;
      const outcome = await validateOutcome(response, pending, ownerUid);
      let confirmedView = null;
      if (Object.hasOwn(response, 'state')) {
        confirmedView = validateHandheldView(response.state, ownerUid);
        if (response.duplicate || outcome.status !== 'COMMITTED' || !confirmedView.enabled
          || confirmedView.serverNowMs !== outcome.committedAtMs || confirmedView.configVersion !== outcome.configVersion
          || confirmedView.configHash !== outcome.configHash || !confirmedView.wallet.available
          || confirmedView.wallet.balance !== outcome.walletAfter || !confirmedView.pet
          || confirmedView.prices[outcome.action] !== outcome.amount) invalid();
      }
      if (!current() || !matches()) return;
      try { storage.removeItem(key); } catch { storageError(); return; }
      pending = null; raw = null; emit({ pending: false, quote: confirmedView, message: confirmedView ? '' : state.message });
      if (original && !response.duplicate && outcome.status === 'COMMITTED') {
        try { onConfirmed(outcome); } catch { /* Presentation cannot undo or obscure a confirmed purchase. */ }
      }
      if (!confirmedView) await read(outcome.status === 'REFUSED' ? refusalMessage(outcome) : 'Purchase confirmed.');
    } catch { emit({ quote: null, message: 'We could not confirm your purchase. It is kept here. Use Retry purchase to check it before buying again.' }); }
    finally { busy = false; emit({ busy: false }); }
  }
  return {
    getState: () => structuredClone(state),
    start: async () => {
      if (!current()) { await refresh(); return; }
      try {
        raw = storage.getItem(key);
        if (raw !== null) {
          const saved = JSON.parse(raw);
          if (!exact(saved, ['schemaVersion', 'ownerUid', 'projectId', 'request', 'quotedCost']) || saved.schemaVersion !== 1
            || saved.ownerUid !== ownerUid || saved.projectId !== projectId || !validRequest(saved.request) || !integer(saved.quotedCost, 1, 10000)) throw new Error('INVALID_JOURNAL');
          pending = saved; emit({ pending: true });
        }
      } catch { storageError(); return; }
      await refresh();
    },
    prepare: (action, adoption) => {
      if (!current()) { showBlocked(); return; }
      if (busy || blocked || pending) return;
      if (!state.quote) { emit({ message: 'Please refresh to check your pal before buying.' }); return; }
      if (!state.quote.enabled) { emit({ message: 'YumPals is resting. Your teacher has paused care.' }); return; }
      if (!state.quote.wallet.available) { emit({ message: 'Your donuts could not be checked. Please ask your teacher to check your account.' }); return; }
      if (!ACTIONS.includes(action) || (action === 'adoption' ? !adopt(adoption) : adoption !== undefined)) {
        emit({ confirmation: null, message: 'Choose a valid pal and colour, with a name of 1–16 letters, numbers, spaces, hyphens or underscores.' }); return;
      }
      emit({ confirmation: { action, ...(action === 'adoption' ? { adoption: normalizedAdoption(adoption) } : {}), quotedCost: state.quote.prices[action] } });
    },
    cancel: () => { if (current() && !busy && !pending) emit({ confirmation: null }); },
    confirm: async () => {
      if (!current() || busy || blocked || pending || !state.quote || !state.confirmation) return;
      const c = state.confirmation; let request;
      try { request = { operationId: operationId(), action: c.action, expectedConfigVersion: state.quote.configVersion, expectedConfigHash: state.quote.configHash,
        ...(c.action === 'adoption' ? { adoption: structuredClone(c.adoption) } : {}) }; } catch { storageError(); return; }
      if (!validRequest(request)) { storageError(); return; }
      const saved = { schemaVersion: 1, ownerUid, projectId, request, quotedCost: c.quotedCost };
      const serialized = JSON.stringify(saved);
      try {
        if (storage.getItem(key) !== null) { storageError(); return; }
        storage.setItem(key, serialized);
        if (storage.getItem(key) !== serialized) { storageError(); return; }
      } catch { storageError(); return; }
      if (!current()) return;
      pending = saved; raw = serialized; emit({ pending: true }); await dispatch(true);
    },
    retry: () => dispatch(false), refresh, dispose: () => { active = false; },
  };
}
