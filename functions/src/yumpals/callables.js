const {
  DEFAULT_SETTINGS,
  getAucklandDateParts,
  growthForCareDays,
  isValidDayRecord,
  isValidPersistedState,
  publicPet,
  sanitiseSettings,
  schoolDayStatus,
  speciesById,
  validateCase,
  validateColor,
  validateName,
  validAction,
} = require('./rules');
const {
  yumPalsAuditDoc,
  yumPalsDayDoc,
  yumPalsSettingsAuditDoc,
  yumPalsSettingsDoc,
  yumPalsUserDoc,
} = require('./paths');

function createYumPalsHandlers({ db, FieldValue, HttpsError, now = () => Date.now() }) {
  const timestamp = () => FieldValue.serverTimestamp();

  function requireAuth(request) {
    const uid = request?.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to use YumPals.');
    if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('unauthenticated', 'Anonymous accounts cannot own authoritative YumPals.');
    }
    return uid;
  }

  function requireAdmin(request) {
    requireAuth(request);
    if (request.auth.token?.yumpalsAdmin !== true) {
      throw new HttpsError('permission-denied', 'YumPals teacher settings require the yumpalsAdmin claim.');
    }
  }

  async function readSettings() {
    const snapshot = await yumPalsSettingsDoc(db).get();
    return sanitiseSettings(snapshot.exists ? snapshot.data() : DEFAULT_SETTINGS);
  }

  function settingsResponse(settings, request) {
    return {
      ...settings,
      isAdmin: request?.auth?.token?.yumpalsAdmin === true,
    };
  }

  function dayResponse({ nowMs, settings, day }) {
    const schoolDay = schoolDayStatus(nowMs, settings);
    return {
      dateKey: schoolDay.dateKey,
      eligible: schoolDay.eligible,
      reason: schoolDay.reason,
      feed: day?.actions?.feed === true,
      pat: day?.actions?.pat === true,
      complete: day?.complete === true,
    };
  }

  function response({ request, settings, state, nowMs, day }) {
    return {
      ok: true,
      enabled: settings.enabled,
      isAdmin: request?.auth?.token?.yumpalsAdmin === true,
      settings: settingsResponse(settings, request),
      serverNowMs: nowMs,
      today: dayResponse({ nowMs, settings, day }),
      pet: publicPet(state, settings),
    };
  }

  function assertPersistedState(state, uid) {
    if (!isValidPersistedState(state, uid)) {
      throw new HttpsError('data-loss', 'YumPals found invalid saved pet data; nothing was changed.');
    }
  }

  function assertPersistedDay(day, dateKey) {
    if (day && !isValidDayRecord(day, dateKey)) {
      throw new HttpsError('data-loss', 'YumPals found invalid daily care data; nothing was changed.');
    }
  }

  function operationIdFor(data, dateKey, action) {
    if (data?.operationId === undefined || data.operationId === null || data.operationId === '') {
      return `care_${dateKey}_${action}`;
    }
    if (typeof data.operationId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(data.operationId)) {
      throw new HttpsError('invalid-argument', 'operationId must be 1–80 letters, numbers, dashes, or underscores.');
    }
    return data.operationId;
  }

  function assertEnabled(settings) {
    if (!settings.enabled) throw new HttpsError('failed-precondition', 'YumPals is currently disabled by the school.');
  }

  function validateAdoption(data, settings) {
    const species = speciesById(data?.species);
    const name = validateName(data?.name);
    const color = validateColor(data?.color);
    const casing = validateCase(data?.casing);
    if (!species || !settings.availableSpecies.includes(species.id)) {
      throw new HttpsError('invalid-argument', 'Choose an available YumPal.');
    }
    if (!name) throw new HttpsError('invalid-argument', 'Pet names must be 1–16 letters, numbers, spaces, dashes, or underscores.');
    if (!color || !casing) throw new HttpsError('invalid-argument', 'Choose a valid case colour.');
    return { species: species.id, name, color, casing };
  }

  function validateProfilePatch(data) {
    const patch = {};
    if (data && Object.prototype.hasOwnProperty.call(data, 'name')) {
      patch.name = validateName(data.name);
      if (!patch.name) throw new HttpsError('invalid-argument', 'Pet names must be 1–16 letters, numbers, spaces, dashes, or underscores.');
    }
    if (data && Object.prototype.hasOwnProperty.call(data, 'color')) {
      patch.color = validateColor(data.color);
      if (!patch.color) throw new HttpsError('invalid-argument', 'Choose a valid case colour.');
    }
    if (data && Object.prototype.hasOwnProperty.call(data, 'casing')) {
      patch.casing = validateCase(data.casing);
      if (!patch.casing) throw new HttpsError('invalid-argument', 'Choose a valid case colour.');
    }
    if (data && Object.prototype.hasOwnProperty.call(data, 'reducedMotion')) {
      if (typeof data.reducedMotion !== 'boolean') throw new HttpsError('invalid-argument', 'Reduced motion must be a boolean.');
      patch.reducedMotion = data.reducedMotion;
    }
    if (Object.keys(patch).length === 0) throw new HttpsError('invalid-argument', 'No profile changes were supplied.');
    return patch;
  }

  return {
    getState: async (request) => {
      const uid = requireAuth(request);
      const nowMs = now();
      const settings = await readSettings();
      const stateRef = yumPalsUserDoc(db, uid);
      const stateSnapshot = await stateRef.get();
      const state = stateSnapshot.exists ? stateSnapshot.data() : null;
      if (state) assertPersistedState(state, uid);
      const dateKey = schoolDayStatus(nowMs, settings).dateKey;
      const daySnapshot = state ? await yumPalsDayDoc(db, uid, dateKey).get() : null;
      const day = daySnapshot?.exists ? daySnapshot.data() : null;
      assertPersistedDay(day, dateKey);
      return response({ request, settings, state, nowMs, day });
    },

    adopt: async (request) => {
      const uid = requireAuth(request);
      const nowMs = now();
      const requested = request.data || {};
      const stateRef = yumPalsUserDoc(db, uid);
      const settingsRef = yumPalsSettingsDoc(db);
      const auditRef = yumPalsAuditDoc(db, uid, 'adopt');

      const result = await db.runTransaction(async (transaction) => {
        const [current, settingsSnapshot] = await Promise.all([
          transaction.get(stateRef),
          transaction.get(settingsRef),
        ]);
        const settings = sanitiseSettings(settingsSnapshot.exists ? settingsSnapshot.data() : DEFAULT_SETTINGS);
        assertEnabled(settings);
        if (current.exists) {
          assertPersistedState(current.data(), uid);
          return { duplicate: true, settings, state: current.data() };
        }
        const pet = validateAdoption(requested, settings);
        const state = {
          schemaVersion: 1,
          ownerUid: uid,
          ...pet,
          reducedMotion: false,
          careDays: 0,
          earnedMilestones: [],
          createdAt: timestamp(),
          updatedAt: timestamp(),
        };
        transaction.set(stateRef, state);
        transaction.set(auditRef, {
          type: 'adopt',
          ownerUid: uid,
          species: pet.species,
          createdAt: timestamp(),
        });
        return { duplicate: false, settings, state };
      });

      return {
        ...response({ request, settings: result.settings, state: result.state, nowMs, day: null }),
        duplicate: result.duplicate,
      };
    },

    care: async (request) => {
      const uid = requireAuth(request);
      const nowMs = now();
      if (!validAction(request.data?.action)) throw new HttpsError('invalid-argument', 'Choose feed or pat.');

      const action = request.data.action;
      const dateKey = getAucklandDateParts(nowMs).dateKey;
      const operationId = operationIdFor(request.data, dateKey, action);
      const stateRef = yumPalsUserDoc(db, uid);
      const settingsRef = yumPalsSettingsDoc(db);
      const dayRef = yumPalsDayDoc(db, uid, dateKey);
      const auditRef = yumPalsAuditDoc(db, uid, `care_${operationId}`);

      const result = await db.runTransaction(async (transaction) => {
        const [stateSnapshot, settingsSnapshot, daySnapshot, operationSnapshot] = await Promise.all([
          transaction.get(stateRef),
          transaction.get(settingsRef),
          transaction.get(dayRef),
          transaction.get(auditRef),
        ]);
        if (!stateSnapshot.exists) throw new HttpsError('failed-precondition', 'Adopt a YumPal first.');

        const settings = sanitiseSettings(settingsSnapshot.exists ? settingsSnapshot.data() : DEFAULT_SETTINGS);
        assertEnabled(settings);
        const state = stateSnapshot.data();
        assertPersistedState(state, uid);
        const schoolDay = schoolDayStatus(nowMs, settings);
        const day = daySnapshot.exists ? daySnapshot.data() : { actions: {}, complete: false };
        assertPersistedDay(daySnapshot.exists ? day : null, dateKey);
        if (operationSnapshot.exists) {
          const prior = operationSnapshot.data();
          if (prior.type !== 'care' || prior.action !== action || prior.dateKey !== dateKey) {
            throw new HttpsError('already-exists', 'This operationId was already used for a different care action.');
          }
          return { code: 'DUPLICATE', settings, state, day };
        }
        if (!schoolDay.eligible) return { code: schoolDay.reason, settings, state, day };
        if (day.actions?.[action] === true) return { code: 'DUPLICATE', settings, state, day };

        const actions = { ...(day.actions || {}), [action]: true };
        const complete = actions.feed === true && actions.pat === true;
        const careDays = state.careDays + (complete && !day.complete ? 1 : 0);
        const growth = growthForCareDays(careDays, settings.growthSpeed, state.earnedMilestones);
        const earnedMilestones = [...new Set(growth.completed)];
        const nextDay = {
          dateKey,
          actions,
          complete,
          completedAt: complete && !day.complete ? timestamp() : (day.completedAt || null),
          updatedAt: timestamp(),
        };
        const nextState = { ...state, careDays, earnedMilestones, updatedAt: timestamp() };
        transaction.set(dayRef, nextDay, { merge: true });
        transaction.set(stateRef, { careDays, earnedMilestones, updatedAt: timestamp() }, { merge: true });
        transaction.set(auditRef, {
          type: 'care',
          operationId,
          action,
          dateKey,
          ownerUid: uid,
          completedDay: complete && !day.complete,
          createdAt: timestamp(),
        });
        return { code: 'OK', settings, state: nextState, day: nextDay };
      });

      return {
        ...response({ request, settings: result.settings, state: result.state, nowMs, day: result.day }),
        action,
        duplicate: result.code === 'DUPLICATE',
        completed: result.code === 'OK' && result.day.complete,
        blockedReason: result.code === 'WEEKEND' || result.code === 'HOLIDAY' ? result.code : null,
      };
    },

    updatePet: async (request) => {
      const uid = requireAuth(request);
      const patch = validateProfilePatch(request.data || {});
      const nowMs = now();
      const dateKey = getAucklandDateParts(nowMs).dateKey;
      const stateRef = yumPalsUserDoc(db, uid);
      const settingsRef = yumPalsSettingsDoc(db);
      const dayRef = yumPalsDayDoc(db, uid, dateKey);
      const auditRef = yumPalsAuditDoc(db, uid, `profile_${nowMs}_${Math.random().toString(36).slice(2, 10)}`);
      const result = await db.runTransaction(async (transaction) => {
        const [current, settingsSnapshot, daySnapshot] = await Promise.all([
          transaction.get(stateRef),
          transaction.get(settingsRef),
          transaction.get(dayRef),
        ]);
        if (!current.exists) throw new HttpsError('failed-precondition', 'Adopt a YumPal first.');
        const settings = sanitiseSettings(settingsSnapshot.exists ? settingsSnapshot.data() : DEFAULT_SETTINGS);
        assertEnabled(settings);
        assertPersistedState(current.data(), uid);
        const day = daySnapshot.exists ? daySnapshot.data() : null;
        assertPersistedDay(day, dateKey);
        const nextState = { ...current.data(), ...patch, updatedAt: timestamp() };
        transaction.set(stateRef, patchWithTimestamp(patch, timestamp()), { merge: true });
        transaction.set(auditRef, { type: 'profile_update', ownerUid: uid, fields: Object.keys(patch), createdAt: timestamp() });
        return { settings, state: nextState, day };
      });
      return { ...response({ request, settings: result.settings, state: result.state, nowMs, day: result.day }) };
    },

    updateSettings: async (request) => {
      requireAdmin(request);
      const incoming = request.data && typeof request.data === 'object' ? request.data : {};
      const settingsRef = yumPalsSettingsDoc(db);
      const auditRef = yumPalsSettingsAuditDoc(db, `settings_${now()}_${Math.random().toString(36).slice(2, 10)}`);
      const settings = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(settingsRef);
        const current = sanitiseSettings(currentSnapshot.exists ? currentSnapshot.data() : DEFAULT_SETTINGS);
        const nextSettings = sanitiseSettings({ ...current, ...incoming });
        transaction.set(settingsRef, {
          ...nextSettings,
          updatedBy: request.auth.uid,
          updatedAt: timestamp(),
        }, { merge: true });
        transaction.set(auditRef, {
          type: 'settings_update',
          updatedBy: request.auth.uid,
          changes: nextSettings,
          createdAt: timestamp(),
        });
        return nextSettings;
      });
      return { ok: true, settings: settingsResponse(settings, request), enabled: settings.enabled, isAdmin: true };
    },
  };
}

function patchWithTimestamp(patch, updatedAt) {
  return { ...patch, updatedAt };
}

module.exports = {
  createYumPalsHandlers,
};
