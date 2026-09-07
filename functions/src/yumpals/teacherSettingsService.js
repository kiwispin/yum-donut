// Internal only: injected protected refs and verified auth context; no live endpoint.
const { createHash } = require('node:crypto');
const { PRICES, RESTORES, defaultConfig, validateConfig, aucklandNow, dayNumber, requireValue, integer } = require('./paidCareEngine');
const ID = /^[A-Za-z0-9_-]{1,80}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const uidValid = (uid) => typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !uid.includes('/');

function plain(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { requireValue(Number.isFinite(value), 'INVALID_SETTINGS'); return value; }
  if (Array.isArray(value)) {
    requireValue(Object.keys(value).length === value.length, 'INVALID_SETTINGS');
    return value.map(plain);
  }
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_SETTINGS');
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, plain(value[key])]));
}
function settingsHash(value) { return createHash('sha256').update(JSON.stringify(plain(value))).digest('hex'); }
function exact(value, keys) {
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key)), 'INVALID_SETTINGS');
}
function adminUid(request) {
  const uid = request?.auth?.uid;
  const provider = request?.auth?.token?.firebase?.sign_in_provider;
  requireValue(uidValid(uid) && typeof provider === 'string' && provider.length > 0 && provider !== 'anonymous', 'UNAUTHENTICATED');
  requireValue(request.auth.token.yumpalsAdmin === true, 'PERMISSION_DENIED');
  return uid;
}
function input(data) {
  exact(data, ['operationId', 'expectedVersion', 'expectedSettingsHash', 'enabled']);
  requireValue(typeof data.operationId === 'string' && ID.test(data.operationId) && typeof data.enabled === 'boolean', 'INVALID_SETTINGS');
  requireValue(data.expectedVersion === null ? data.expectedSettingsHash === null
    : typeof data.expectedVersion === 'string' && ID.test(data.expectedVersion) && typeof data.expectedSettingsHash === 'string' && HASH.test(data.expectedSettingsHash), 'INVALID_SETTINGS');
  return { operationId: data.operationId, expectedVersion: data.expectedVersion, expectedSettingsHash: data.expectedSettingsHash, enabled: data.enabled };
}
function validateSettings(config) {
  exact(config, ['schemaVersion', 'version', 'enabled', 'prices', 'restores', 'careCap', 'calendar', 'pauses', 'controlVersion', 'updatedAtMs', 'updatedBy']);
  validateConfig(config);
  exact(config.prices, Object.keys(PRICES)); exact(config.restores, Object.keys(RESTORES));
  for (const entry of config.calendar) exact(entry, ['effectiveFrom', 'paused', 'holidays', 'absences']);
  requireValue(config.controlVersion === 1 && integer(config.updatedAtMs) && uidValid(config.updatedBy), 'INVALID_SETTINGS');
  const today = dayNumber(aucklandNow(config.updatedAtMs).date);
  requireValue(config.calendar.every((entry) => entry.absences.length === 0), 'GLOBAL_ABSENCES_FORBIDDEN');
  for (const pause of config.pauses) requireValue(dayNumber(pause.from) <= today && (pause.to === null || dayNumber(pause.to) <= today), 'INVALID_SETTINGS');
  requireValue(config.enabled || config.pauses.at(-1)?.to === null, 'INVALID_SETTINGS');
  settingsHash(config); // Reject unknown non-plain values, never serialize SDK fields.
  return config;
}
function nextSettings(before, request, actorUid, nowMs, binding) {
  const date = aucklandNow(nowMs).date;
  if (before) {
    validateSettings(before);
    requireValue(nowMs >= before.updatedAtMs, 'CLOCK_REVERSED');
    if (before.enabled === request.enabled) return before;
  }
  const next = before ? structuredClone(before) : { ...defaultConfig(date), pauses: [] };
  const last = next.pauses.at(-1);
  if (!request.enabled) {
    if (last?.to === date) last.to = null;
    else next.pauses.push({ from: date, to: null });
  } else if (last?.to === null) last.to = date;
  Object.assign(next, { enabled: request.enabled, version: `ctrl_${binding}`, controlVersion: 1, updatedAtMs: nowMs, updatedBy: actorUid });
  return validateSettings(next);
}

function createTeacherSettingsService({ db, refs, now = Date.now }) {
  requireValue(db && typeof db.runTransaction === 'function' && refs && ['settings', 'legacySettings', 'receipt'].every(key => typeof refs[key] === 'function'), 'INVALID_DEPENDENCIES');
  const pathOf = ref => typeof ref === 'string' ? ref : ref?.path;
  function markerFor(ref) { return { schemaVersion: 1, mode: 'paid', settingsPath: pathOf(ref) }; }
  function legacyMeta(snapshot) {
    const data = snapshot.exists ? snapshot.data() : null;
    requireValue(!data || (!Object.hasOwn(data, 'enabled') || typeof data.enabled === 'boolean'), 'CUTOVER_REVIEW_REQUIRED');
    return { exists: snapshot.exists, enabled: data && Object.hasOwn(data, 'enabled') ? { present: true, value: data.enabled } : { present: false },
      marker: data && Object.hasOwn(data, 'paidCareControl') ? { present: true, value: data.paidCareControl } : { present: false } };
  }
  function cutoverState(config, snapshot, ref) {
    const meta = legacyMeta(snapshot);
    if (config) {
      requireValue(meta.marker.present && meta.enabled.present && meta.enabled.value === false, 'CUTOVER_REVIEW_REQUIRED');
      exact(meta.marker.value, ['schemaVersion', 'mode', 'settingsPath']);
      requireValue(settingsHash(meta.marker.value) === settingsHash(markerFor(ref)), 'CUTOVER_REVIEW_REQUIRED');
    } else requireValue(!meta.marker.present, 'CUTOVER_REVIEW_REQUIRED');
    return meta;
  }
  function view(config) { return { configured: config !== null, enabled: config?.enabled ?? false, settings: config,
    version: config?.version ?? null, settingsHash: config ? settingsHash(config) : null }; }
  return {
    getSettings: async (request) => {
      adminUid(request);
      if (request.data !== undefined) exact(request.data, []);
      const nowMs = now(); aucklandNow(nowMs);
      return db.runTransaction(async (transaction) => {
        const ref = refs.settings(); const legacyRef = refs.legacySettings();
        requireValue(typeof pathOf(ref) === 'string' && pathOf(ref).length > 0 && typeof pathOf(legacyRef) === 'string' && pathOf(legacyRef).length > 0 && pathOf(ref) !== pathOf(legacyRef), 'INVALID_REFS');
        const snapshot = await transaction.get(ref);
        const legacySnapshot = await transaction.get(legacyRef);
        const config = snapshot.exists ? validateSettings(snapshot.data()) : null;
        cutoverState(config, legacySnapshot, ref);
        if (config) requireValue(nowMs >= config.updatedAtMs, 'CLOCK_REVERSED');
        return view(config);
      });
    },
    updateSettings: async (request) => {
      const actorUid = adminUid(request); const data = input(request.data);
      const binding = settingsHash({ actorUid, request: data });
      const nowMs = now(); aucklandNow(nowMs);
      return db.runTransaction(async (transaction) => {
        const settingsRef = refs.settings(); const receiptRef = refs.receipt(actorUid, data.operationId); const legacyRef = refs.legacySettings();
        const paths = [settingsRef, receiptRef, legacyRef].map(pathOf);
        requireValue(paths.every((path) => typeof path === 'string' && path.length > 0) && new Set(paths).size === 3, 'INVALID_REFS');
        const prior = await transaction.get(receiptRef);
        const current = await transaction.get(settingsRef);
        const legacySnapshot = await transaction.get(legacyRef);
        const before = current.exists ? validateSettings(current.data()) : null;
        const legacyBefore = cutoverState(before, legacySnapshot, settingsRef);
        if (before) requireValue(nowMs >= before.updatedAtMs, 'CLOCK_REVERSED');
        if (prior.exists) {
          const receipt = prior.data();
          try {
            exact(receipt, ['schemaVersion', 'actorUid', 'operationId', 'request', 'binding', 'before', 'after', 'beforeHash', 'afterHash', 'committedAtMs', 'legacyBefore', 'legacyAfter']);
            const saved = input(receipt.request);
            requireValue(receipt.schemaVersion === 1 && receipt.actorUid === actorUid && receipt.operationId === data.operationId
              && saved.operationId === data.operationId && receipt.binding === settingsHash({ actorUid, request: saved }), 'CORRUPT_SETTINGS_RECEIPT');
            if (receipt.before !== null) validateSettings(receipt.before);
            validateSettings(receipt.after);
            const expectedLegacy = { exists: true, enabled: { present: true, value: false }, marker: { present: true, value: markerFor(settingsRef) } };
            requireValue(settingsHash(receipt.legacyAfter) === settingsHash(expectedLegacy), 'CORRUPT_SETTINGS_RECEIPT');
            if (receipt.before !== null) requireValue(settingsHash(receipt.legacyBefore) === settingsHash(expectedLegacy), 'CORRUPT_SETTINGS_RECEIPT');
            else {
              exact(receipt.legacyBefore, ['exists', 'enabled', 'marker']);
              requireValue(typeof receipt.legacyBefore.exists === 'boolean' && settingsHash(receipt.legacyBefore.marker) === settingsHash({ present: false }), 'CORRUPT_SETTINGS_RECEIPT');
              const enabled = receipt.legacyBefore.enabled;
              exact(enabled, enabled?.present === true ? ['present', 'value'] : ['present']);
              requireValue(enabled.present === false || (enabled.present === true && typeof enabled.value === 'boolean' && receipt.legacyBefore.exists), 'CORRUPT_SETTINGS_RECEIPT');
            }
            requireValue(receipt.beforeHash === (receipt.before === null ? null : settingsHash(receipt.before))
              && receipt.afterHash === settingsHash(receipt.after)
              && saved.expectedVersion === (receipt.before?.version ?? null) && saved.expectedSettingsHash === receipt.beforeHash
              && settingsHash(nextSettings(receipt.before, saved, actorUid, receipt.committedAtMs, receipt.binding)) === receipt.afterHash, 'CORRUPT_SETTINGS_RECEIPT');
          } catch { requireValue(false, 'CORRUPT_SETTINGS_RECEIPT'); }
          requireValue(nowMs >= receipt.committedAtMs, 'CLOCK_REVERSED');
          requireValue(receipt.binding === binding, 'OPERATION_CONFLICT');
          return { ...view(receipt.after), receipt, duplicate: true };
        }
        requireValue(data.expectedVersion === (before?.version ?? null) && data.expectedSettingsHash === (before ? settingsHash(before) : null), 'SETTINGS_CONFLICT');
        const after = nextSettings(before, data, actorUid, nowMs, binding);
        const receipt = { schemaVersion: 1, actorUid, operationId: data.operationId, request: data, binding,
          before, after, beforeHash: before ? settingsHash(before) : null, afterHash: settingsHash(after), committedAtMs: nowMs,
          legacyBefore, legacyAfter: { exists: true, enabled: { present: true, value: false }, marker: { present: true, value: markerFor(settingsRef) } } };
        if (!before) transaction.set(legacyRef, { enabled: false, paidCareControl: markerFor(settingsRef) }, { merge: true });
        if (after !== before) transaction.set(settingsRef, after);
        transaction.set(receiptRef, receipt);
        return { ...view(after), receipt, duplicate: false };
      });
    },
  };
}
module.exports = { createTeacherSettingsService, settingsHash, validateSettings };
