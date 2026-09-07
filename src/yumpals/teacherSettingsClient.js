// No Firebase imports: transport/auth/storage are injected and owner-scoped.
const ID = /^[A-Za-z0-9_-]{1,80}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const fail = () => { throw new Error('INVALID_RESPONSE'); };
export const PAID_SETTINGS_NAMES = Object.freeze({ get: 'yumpalsGetPaidSettings', update: 'yumpalsUpdatePaidSettings' });
const MESSAGES = {
  ROLLOUT_NOT_READY: 'YumPals is not ready for release yet.',
  UNAUTHENTICATED: 'Please sign in again to manage YumPals.',
  PERMISSION_DENIED: 'This account cannot change YumPals settings. Please ask your school administrator.',
  SETTINGS_CONFLICT: 'Someone changed these settings. Review the latest settings and choose again.',
  OPERATION_CONFLICT: 'This save needs to be checked by your school administrator.',
  INVALID_SETTINGS: 'These settings could not be checked. Please refresh and try again.',
  INVALID_CONFIG: 'These settings need to be checked by your school administrator.',
  INVALID_CALENDAR: 'The school dates need to be checked by your school administrator.',
  INVALID_PAUSES: 'The pet rest dates need to be checked by your school administrator.',
  INVALID_DATE: 'The school dates need to be checked by your school administrator.',
  INVALID_CLOCK: 'The school time could not be checked. Please try again later.',
  CLOCK_REVERSED: 'The school time needs to be checked. Please try again later.',
  GLOBAL_ABSENCES_FORBIDDEN: 'These school settings need to be checked by your administrator.',
  CUTOVER_REVIEW_REQUIRED: 'YumPals needs a release check by your school administrator.',
  CORRUPT_SETTINGS_RECEIPT: 'This save needs to be checked by your school administrator.',
};
export function teacherSettingsError(error) { const reason = error?.details?.reason; return typeof reason === 'string' && Object.hasOwn(MESSAGES, reason) ? MESSAGES[reason] : 'YumPals could not confirm this request. Please try again.'; }
function requestValid(value) {
  return exact(value, ['operationId', 'expectedVersion', 'expectedSettingsHash', 'enabled']) && typeof value.operationId === 'string' && ID.test(value.operationId)
    && typeof value.enabled === 'boolean' && (value.expectedVersion === null ? value.expectedSettingsHash === null
      : typeof value.expectedVersion === 'string' && ID.test(value.expectedVersion) && typeof value.expectedSettingsHash === 'string' && HASH.test(value.expectedSettingsHash));
}
export function validateSettingsView(value, update = false) {
  const keys = ['configured', 'enabled', 'settings', 'version', 'settingsHash', ...(update ? ['receipt', 'duplicate'] : [])];
  if (!exact(value, keys) || typeof value.configured !== 'boolean' || typeof value.enabled !== 'boolean') fail();
  if (!value.configured) {
    if (value.enabled !== false || value.settings !== null || value.version !== null || value.settingsHash !== null || update) fail();
  } else if (!plain(value.settings) || value.settings.schemaVersion !== 1 || value.settings.controlVersion !== 1
    || typeof value.version !== 'string' || !ID.test(value.version) || typeof value.settingsHash !== 'string' || !HASH.test(value.settingsHash)
    || value.settings.version !== value.version || value.settings.enabled !== value.enabled) fail();
  return value;
}
function sameRequest(a, b) { return requestValid(a) && requestValid(b) && Object.keys(a).every(key => a[key] === b[key]); }
function acceptedUpdate(value, ownerUid, request) {
  validateSettingsView(value, true);
  const r = value.receipt;
  if (typeof value.duplicate !== 'boolean' || !plain(r) || r.schemaVersion !== 1 || r.actorUid !== ownerUid || r.operationId !== request.operationId
    || !sameRequest(r.request, request) || r.afterHash !== value.settingsHash || !plain(r.after) || r.after.version !== value.version
    || r.after.enabled !== request.enabled || value.enabled !== request.enabled || !Number.isSafeInteger(r.committedAtMs) || r.committedAtMs < 0
    || typeof r.binding !== 'string' || !HASH.test(r.binding) || r.beforeHash !== request.expectedSettingsHash
    || (r.before?.version ?? null) !== request.expectedVersion) fail();
}
export function settingsJournalKey(projectId, ownerUid) { return `yumpals-paid-settings-v1:${encodeURIComponent(projectId)}:${encodeURIComponent(ownerUid)}`; }

export function createTeacherSettingsController({ ownerUid, projectId, enabled, getIdentity, transport, storage, operationId, onChange = () => {} }) {
  let active = true; let busy = false; let pending = null; let pendingRaw = null; let storageBlocked = false;
  let state = { status: 'loading', quote: null, draft: false, pending: false, busy: false, storageBlocked: false, uncertain: false, message: '' };
  const key = settingsJournalKey(projectId, ownerUid);
  const current = () => {
    const identity = getIdentity();
    return active && enabled === true && typeof ownerUid === 'string' && ownerUid.length > 0 && typeof projectId === 'string' && projectId.length > 0
      && identity?.uid === ownerUid && identity.isAnonymous === false && identity.sandbox === false;
  };
  const emit = patch => { if (current()) { state = { ...state, ...patch }; onChange({ ...state }); } };
  const storeError = () => { storageBlocked = true; emit({ storageBlocked: true, status: 'error', message: 'This browser could not safely keep your save. Check browser storage, then close and reopen these settings. Any earlier save is kept for checking.' }); };
  function clearPending() {
    if (!current()) return false;
    try {
      if (storage.getItem(key) !== pendingRaw) { storeError(); return false; }
      storage.removeItem(key); pending = null; pendingRaw = null; emit({ pending: false }); return true;
    } catch { storeError(); return false; }
  }
  async function read(message = '') {
    if (!current()) return;
    try {
      const response = await transport(PAID_SETTINGS_NAMES.get, {}, { ownerUid, isActive: current });
      if (!current()) return;
      const quote = validateSettingsView(response);
      emit({ quote, draft: quote.enabled, status: 'ready', uncertain: false, message });
    } catch (error) { emit({ quote: null, status: 'error', message: teacherSettingsError(error) }); }
  }
  async function runRead(message = '') {
    if (!current() || busy || storageBlocked) return;
    busy = true; emit({ busy: true });
    try { await read(message); } finally { busy = false; emit({ busy: false }); }
  }
  async function dispatch() {
    if (!current() || busy || !pending || storageBlocked) return;
    busy = true; emit({ busy: true, message: 'Saving…' });
    try {
      // Guard another tab's journal before every dispatch; never overwrite it.
      try { if (storage.getItem(key) !== pendingRaw) { storeError(); return; } } catch { storeError(); return; }
      if (!current()) return;
      const response = await transport(PAID_SETTINGS_NAMES.update, { ...pending }, { ownerUid, isActive: current });
      if (!current()) return;
      acceptedUpdate(response, ownerUid, pending);
      if (!clearPending()) return;
      emit({ quote: null, status: 'loading' });
      // Duplicate responses describe historical settings, never the current switch.
      await read('Saved.');
    } catch (error) {
      if (!current()) return;
      if (error?.details?.reason === 'SETTINGS_CONFLICT') {
        if (clearPending()) { emit({ quote: null }); await read(MESSAGES.SETTINGS_CONFLICT); }
      } else emit({ status: 'error', uncertain: true, message: `${teacherSettingsError(error)} Your save is kept here. Use Retry save to check it.` });
    } finally { busy = false; emit({ busy: false }); }
  }
  return {
    getState: () => ({ ...state }),
    start: async () => {
      if (!current()) { state = { ...state, status: 'blocked', message: enabled === true ? 'Please sign in to manage YumPals.' : MESSAGES.ROLLOUT_NOT_READY }; if (active) onChange({ ...state }); return; }
      try {
        pendingRaw = storage.getItem(key);
        if (pendingRaw !== null) {
          const saved = JSON.parse(pendingRaw);
          if (!exact(saved, ['schemaVersion', 'ownerUid', 'projectId', 'request']) || saved.schemaVersion !== 1 || saved.ownerUid !== ownerUid || saved.projectId !== projectId || !requestValid(saved.request)) throw new Error('INVALID_JOURNAL');
          pending = saved.request; emit({ pending: true, message: 'A previous save needs checking. Use Retry save.' });
        }
      } catch { storeError(); return; }
      await runRead(pending ? 'A previous save needs checking. Use Retry save.' : '');
    },
    setDraft: value => { if (current() && !busy && !pending && !storageBlocked && state.quote && typeof value === 'boolean') emit({ draft: value }); },
    save: async () => {
      if (!current() || busy || pending || storageBlocked || !state.quote) return;
      let req;
      try { req = { operationId: operationId(), expectedVersion: state.quote.version, expectedSettingsHash: state.quote.settingsHash, enabled: state.draft }; }
      catch { storeError(); return; }
      if (!requestValid(req)) { storeError(); return; }
      const raw = JSON.stringify({ schemaVersion: 1, ownerUid, projectId, request: req });
      try {
        if (storage.getItem(key) !== null) { storeError(); return; }
        storage.setItem(key, raw);
        if (storage.getItem(key) !== raw) { storeError(); return; }
      } catch { storeError(); return; }
      if (!current()) return;
      pending = req; pendingRaw = raw; emit({ pending: true });
      await dispatch();
    },
    retry: dispatch,
    refresh: () => runRead(),
    dispose: () => { active = false; },
  };
}
