// Internal service ONLY. No onCall export, legacy identity lookup or default adapter.
// refs/config and walletAdapter are trusted server dependencies, never request data.
const { PRICES, RESTORES, validateConfig, validatePet, advancePet, migrateLegacyPet, purchaseEffect, digest, requireValue, integer, aucklandNow, dayNumber } = require('./paidCareEngine');
const { walletNumber, debitAfter } = require('./walletNumber');
const { withHolidayMode, holidayRefs, applyHolidayMode } = require('./holidayMode');
const { readDocuments } = require('./readDocuments');
const { isValidPersistedState } = require('./rules');
const { applyGivingCheer } = require('./givingCheer');

const ID = /^[A-Za-z0-9_-]{1,80}$/u;
const REFUSALS = new Set(['DISABLED', 'RECONFIRM_CONFIG', 'NO_EFFECT', 'INSUFFICIENT_FUNDS', 'CARE_CAP', 'NO_PET', 'ALREADY_ADOPTED', 'GAME_ACTIVE']);
const WALLET_UNAVAILABLE = new Set(['TRUSTED_MAPPING_REQUIRED', 'INVALID_WALLET_MAPPING', 'WALLET_MIRROR_MISSING', 'WALLET_OWNER_CONFLICT', 'INVALID_WALLET_BALANCE', 'WALLET_BALANCE_CONFLICT', 'CORRUPT_WALLET']);
function emptyData(data) {
  requireValue(data === undefined || (data !== null && Object.getPrototypeOf(data) === Object.prototype && Object.keys(data).length === 0), 'INVALID_REQUEST');
}
function validateRefusal(value, uid, id) {
  const keys = ['schemaVersion', 'status', 'ownerUid', 'operationId', 'request', 'binding', 'reason', 'committedAtMs'];
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key)) && value.schemaVersion === 1 && value.status === 'REFUSED'
    && value.ownerUid === uid && value.operationId === id && REFUSALS.has(value.reason)
    && integer(value.committedAtMs, 0, 253402214400000) && typeof value.binding === 'string' && /^[a-f0-9]{64}$/u.test(value.binding)
    && value.binding === digest(savedBoundRequest(value.request))
    && value.request.operationId === id, 'CORRUPT_REFUSAL');
}

function authenticatedUid(request) {
  const uid = request?.auth?.uid;
  requireValue(typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !uid.includes('/'), 'UNAUTHENTICATED');
  const provider = request.auth.token?.firebase?.sign_in_provider;
  requireValue(typeof provider === 'string' && provider !== 'anonymous' && provider.length > 0, 'UNAUTHENTICATED');
  return uid;
}

function boundRequest(data) {
  requireValue(data && Object.getPrototypeOf(data) === Object.prototype, 'INVALID_REQUEST');
  const allowed = ['operationId', 'action', 'expectedConfigVersion', 'expectedConfigHash', 'adoption'];
  requireValue(Object.keys(data).every((key) => allowed.includes(key)), 'INVALID_REQUEST');
  requireValue(typeof data.operationId === 'string' && ID.test(data.operationId), 'INVALID_OPERATION');
  requireValue(typeof data.action === 'string' && Object.hasOwn(PRICES, data.action), 'INVALID_ACTION');
  requireValue(typeof data.expectedConfigVersion === 'string' && ID.test(data.expectedConfigVersion), 'INVALID_CONFIG_VERSION');
  requireValue(typeof data.expectedConfigHash === 'string' && /^[a-f0-9]{64}$/u.test(data.expectedConfigHash), 'INVALID_CONFIG_HASH');
  let adoption = null;
  if (data.action === 'adoption') {
    requireValue(data.adoption && Object.getPrototypeOf(data.adoption) === Object.prototype, 'INVALID_ADOPTION');
    requireValue(Object.keys(data.adoption).length === 4 && ['name', 'species', 'casing', 'color'].every((key) => typeof data.adoption[key] === 'string'), 'INVALID_ADOPTION');
    const { name, species, casing, color } = data.adoption;
    adoption = { name, species, casing, color };
  } else requireValue(data.adoption === undefined, 'INVALID_REQUEST');
  return { operationId: data.operationId, action: data.action, expectedConfigVersion: data.expectedConfigVersion, expectedConfigHash: data.expectedConfigHash, adoption };
}

function savedBoundRequest(saved) {
  // Firestore map ordering is not part of the stored schema. Reconstruct the
  // original binding order only AFTER validating every stored key/value.
  try {
    const keys = ['operationId', 'action', 'expectedConfigVersion', 'expectedConfigHash', 'adoption'];
    requireValue(saved && typeof saved === 'object' && !Array.isArray(saved)
      && Object.keys(saved).length === keys.length && keys.every((key) => Object.hasOwn(saved, key)), 'CORRUPT_RECEIPT');
    if (saved.action === 'adoption') {
      const adoptionKeys = ['name', 'species', 'casing', 'color'];
      requireValue(saved.adoption && typeof saved.adoption === 'object' && !Array.isArray(saved.adoption)
        && Object.keys(saved.adoption).length === adoptionKeys.length
        && adoptionKeys.every((key) => Object.hasOwn(saved.adoption, key)), 'CORRUPT_RECEIPT');
      return boundRequest(saved);
    }
    requireValue(saved.adoption === null, 'CORRUPT_RECEIPT');
    return boundRequest({ operationId: saved.operationId, action: saved.action,
      expectedConfigVersion: saved.expectedConfigVersion, expectedConfigHash: saved.expectedConfigHash });
  } catch {
    requireValue(false, 'CORRUPT_RECEIPT');
  }
}

function validateReceipt(receipt, uid, operationId) {
  requireValue(receipt && receipt.schemaVersion === 1 && receipt.ownerUid === uid && receipt.operationId === operationId, 'CORRUPT_RECEIPT');
  requireValue(receipt.status === 'COMMITTED' && integer(receipt.amount, 1) && walletNumber(receipt.walletBefore) && walletNumber(receipt.walletAfter)
    && debitAfter(receipt.walletBefore, receipt.amount) === receipt.walletAfter, 'CORRUPT_RECEIPT');
  const savedRequest = savedBoundRequest(receipt.request);
  requireValue(receipt.binding === digest(savedRequest) && receipt.action === receipt.request.action
    && receipt.operationId === receipt.request.operationId && receipt.configVersion === receipt.request.expectedConfigVersion
    && receipt.configHash === receipt.request.expectedConfigHash && integer(receipt.committedAtMs), 'CORRUPT_RECEIPT');
  requireValue(receipt.category === 'pet_spend' && receipt.deliveryId === operationId, 'CORRUPT_RECEIPT');
  const keys = ['hunger', 'happiness', 'cleanliness', 'health'];
  const validNeeds = (needs) => needs && keys.every((key) => integer(needs[key], 0, 4));
  requireValue(validNeeds(receipt.needsAfter), 'CORRUPT_RECEIPT');
  requireValue(dayNumber(receipt.checkpoint) <= dayNumber(aucklandNow(receipt.committedAtMs).date), 'CORRUPT_RECEIPT');
  const benefit = receipt.benefit;
  requireValue(benefit && typeof benefit === 'object', 'CORRUPT_RECEIPT');
  if (receipt.action === 'adoption') {
    requireValue(receipt.needsBefore === null && receipt.savedNeedsBefore === null && benefit.type === 'adoption'
      && validNeeds(benefit.needs) && keys.every((key) => receipt.needsAfter[key] === 4 && benefit.needs[key] === 4), 'CORRUPT_RECEIPT');
  } else {
    requireValue(validNeeds(receipt.needsBefore) && validNeeds(receipt.savedNeedsBefore), 'CORRUPT_RECEIPT');
    const key = { meal: 'hunger', snack: 'hunger', game: 'happiness', pat: 'happiness', clean: 'cleanliness', medicine: 'health' }[receipt.action];
    if (key) requireValue(benefit.type === key && integer(benefit.amount, 1, 4)
      && keys.every((name) => receipt.needsAfter[name] === receipt.needsBefore[name] + (name === key ? benefit.amount : 0)), 'CORRUPT_RECEIPT');
    else {
      requireValue(keys.every((name) => receipt.needsAfter[name] === receipt.needsBefore[name]), 'CORRUPT_RECEIPT');
      requireValue(receipt.action === 'bedtime' ? benefit.type === 'sleep' && Number.isInteger(dayNumber(benefit.date))
        : receipt.action === 'reminder' && benefit.type === 'attention' && benefit.cleared === true, 'CORRUPT_RECEIPT');
    }
  }
}

function projectHandheldState(uid, config, nowMs, next, wallet) {
  const clock = aucklandNow(nowMs);
  const projected = next ? {
    name: next.name, species: next.species, casing: next.casing, color: next.color,
    reducedMotion: next.reducedMotion, careDays: next.careDays, earnedMilestones: [...next.earnedMilestones],
    needs: Object.fromEntries(['hunger', 'happiness', 'cleanliness', 'health'].map(key => [key, next.paidCare.needs[key]])), daily: { date: next.paidCare.daily.date, spent: next.paidCare.daily.spent },
    sleepDate: next.paidCare.sleepDate, attention: next.paidCare.attention,
    game: next.paidCare.game ? { id: next.paidCare.game.id, benefit: next.paidCare.game.benefit, round: next.paidCare.game.round } : null,
  } : null;
  return { schemaVersion: 1, ownerUid: uid, enabled: config.enabled, configVersion: config.version,
    configHash: digest(config), prices: Object.fromEntries(Object.keys(PRICES).map(key => [key, config.prices[key]])),
    restores: Object.fromEntries(Object.keys(RESTORES).map(key => [key, config.restores[key]])), careCap: config.careCap,
    serverNowMs: nowMs, aucklandDate: clock.date, aucklandHour: clock.hour, pet: projected, wallet };
}

function createPaidCareService({ db, refs, walletAdapter, now = Date.now, elapsedCare = false }) {
  requireValue(db && typeof db.runTransaction === 'function' && refs && ['pet', 'receipt', 'migration', 'config'].every((key) => typeof refs[key] === 'function'), 'INVALID_DEPENDENCIES');
  requireValue(walletAdapter && typeof walletAdapter.read === 'function' && typeof walletAdapter.debit === 'function', 'TRUSTED_WALLET_ADAPTER_REQUIRED');
  requireValue(refs.refusal === undefined || typeof refs.refusal === 'function', 'INVALID_REFUSAL_REFS');
  // Firestore reuses its Transaction object across retries. Adapter contexts
  // belong to one callback attempt, not that reusable SDK object.
  const runTransaction = callback => db.runTransaction(raw => {
    const attempt = {};
    for (const method of ['get', 'getAll', 'set', 'update', 'create', 'delete']) {
      if (typeof raw[method] === 'function') attempt[method] = (...args) => {
        const result = raw[method](...args);
        return result === raw ? attempt : result;
      };
    }
    return callback(attempt);
  });

  async function readConfig(transaction, uid) {
    // Per-UID trusted config resolver allows server-owned absence history.
    const snapshot = await transaction.get(refs.config(uid));
    requireValue(snapshot.exists, 'CONFIG_MISSING');
    const config = snapshot.data();
    return withHolidayMode(transaction, validateConfig(elapsedCare ? { ...config, elapsedCare: true } : config), refs);
  }

  async function readCareContext(transaction, uid) {
    const [configSnap, snapshot, ...holiday] = await readDocuments(transaction,
      [refs.config(uid), refs.pet(uid), ...holidayRefs(refs)]);
    requireValue(configSnap.exists, 'CONFIG_MISSING');
    const config = configSnap.data();
    return { config: applyHolidayMode(validateConfig(elapsedCare ? { ...config, elapsedCare: true } : config), holiday), snapshot };
  }

  async function readHandheldWallet(transaction, uid) {
    try {
      const result = await walletAdapter.read(transaction, uid);
      requireValue(result && result.ownerUid === uid && walletNumber(result.balance), 'CORRUPT_WALLET');
      return { available: true, balance: result.balance };
    } catch (error) {
      if (!WALLET_UNAVAILABLE.has(error?.code)) throw error;
      return { available: false };
    }
  }

  return {
    getState: async (request) => {
      const uid = authenticatedUid(request);
      emptyData(request.data);
      const nowMs = now();
      aucklandNow(nowMs);
      return runTransaction(async (transaction) => {
        const config = await readConfig(transaction, uid);
        const snapshot = await transaction.get(refs.pet(uid));
        const pet = snapshot.exists ? snapshot.data() : null;
        if (pet) validatePet(pet, uid); // Legacy reads require explicit migration first.
        const next = pet ? advancePet(pet, uid, config, nowMs) : pet;
        if (pet && digest(pet.paidCare) !== digest(next.paidCare)) transaction.set(refs.pet(uid), next);
        return { pet: next, enabled: config.enabled, configVersion: config.version, configHash: digest(config), prices: config.prices, restores: config.restores, careCap: config.careCap };
      });
    },

    getHandheldState: async (request) => {
      const uid = authenticatedUid(request);
      emptyData(request.data);
      const nowMs = now();
      aucklandNow(nowMs);
      return runTransaction(async transaction => {
        const [{ config, snapshot }, wallet] = await Promise.all([
          readCareContext(transaction, uid), readHandheldWallet(transaction, uid),
        ]);
        const pet = snapshot.exists ? snapshot.data() : null;
        if (pet) {
          requireValue(isValidPersistedState(pet, uid), 'CORRUPT_STATE');
          requireValue(Object.hasOwn(pet, 'paidCare'), 'MIGRATION_REQUIRED');
          validatePet(pet, uid);
        }
        let next = pet ? advancePet(pet, uid, config, nowMs) : null;
        let cheer = null;
        // Giving cheer is opt-in through refs; the read happens before any write.
        if (next && refs.giving && refs.cheer) {
          const giving = await transaction.get(refs.giving(uid));
          const profile = giving.exists ? giving.data() : null;
          const granted = applyGivingCheer({ pet: next, config, nowMs, giving: profile });
          if (granted) {
            ({ cheer } = granted);
            next = granted.pet;
            transaction.set(refs.cheer(uid, cheer.date), { schemaVersion: 1, ownerUid: uid, type: 'giving_cheer', date: cheer.date,
              gain: cheer.gain, amount: 0, needsBefore: granted.needsBefore, needsAfter: next.paidCare.needs,
              givingDate: profile.last_given_date, givenToday: profile.given_today, committedAtMs: nowMs });
          }
        }
        if (pet && digest(pet.paidCare) !== digest(next.paidCare)) transaction.set(refs.pet(uid), next);
        return { ...projectHandheldState(uid, config, nowMs, next, wallet), ...(cheer ? { cheer } : {}) };
      });
    },

    migrate: async (request) => {
      const uid = authenticatedUid(request);
      // This internal method has no live endpoint; a future migration wrapper needs review.
      emptyData(request.data);
      const nowMs = now();
      aucklandNow(nowMs);
      return runTransaction(async (transaction) => {
        const config = await readConfig(transaction, uid);
        const snapshot = await transaction.get(refs.pet(uid));
        const audit = await transaction.get(refs.migration(uid));
        requireValue(snapshot.exists, 'NO_PET');
        const pet = snapshot.data();
        const next = migrateLegacyPet(pet, uid, config, nowMs);
        if (pet.paidCare !== undefined) {
          requireValue(audit.exists && audit.data().ownerUid === uid && audit.data().schemaVersion === 1, 'MIGRATION_AUDIT_MISSING');
          return { pet, duplicate: true };
        }
        requireValue(!audit.exists, 'MIGRATION_CONFLICT');
        transaction.set(refs.pet(uid), next);
        transaction.set(refs.migration(uid), { schemaVersion: 1, ownerUid: uid, type: 'legacy_paid_care_migration', configVersion: config.version, configHash: digest(config), migratedAtMs: nowMs, amount: 0 });
        return { pet: next, duplicate: false };
      });
    },

    purchase: async (request) => {
      const uid = authenticatedUid(request);
      const includeState = request.data?.includeState === true;
      const payload = includeState ? { ...request.data } : request.data;
      if (includeState) delete payload.includeState;
      const data = boundRequest(payload);
      const binding = digest(data);
      const nowMs = now();
      aucklandNow(nowMs);
      return runTransaction(async (transaction) => {
        const receiptRef = refs.receipt(uid, data.operationId);
        const refusalRef = refs.refusal ? refs.refusal(uid, data.operationId) : null;
        if (refs.refusal) {
          const paths = [receiptRef, refusalRef].map(ref => typeof ref === 'string' ? ref : ref?.path);
          requireValue(paths.every(path => typeof path === 'string' && path.length > 0) && paths[0] !== paths[1], 'INVALID_REFUSAL_REFS');
        }
        const [prior, refused = null] = await readDocuments(transaction, [receiptRef, ...(refusalRef ? [refusalRef] : [])]);
        requireValue(!(prior.exists && refused?.exists), 'CORRUPT_REFUSAL');
        if (refused?.exists) {
          const refusal = refused.data();
          validateRefusal(refusal, uid, data.operationId);
          requireValue(refusal.binding === binding, 'OPERATION_CONFLICT');
          return { refusal, duplicate: true };
        }
        if (prior.exists) {
          const receipt = prior.data();
          validateReceipt(receipt, uid, data.operationId);
          requireValue(receipt.binding === binding, 'OPERATION_CONFLICT');
          // A committed retry returns the original receipt even after config/day changes.
          return { receipt, duplicate: true };
        }
        // Recover old outcomes above before requiring any current account data.
        // New purchases still read and validate every live financial mirror.
        const [{ config, snapshot }, wallet] = await Promise.all([
          readCareContext(transaction, uid), walletAdapter.read(transaction, uid),
        ]);
        if (!refusalRef) requireValue(config.version === data.expectedConfigVersion && digest(config) === data.expectedConfigHash, 'RECONFIRM_CONFIG');
        const petRef = refs.pet(uid);
        const pet = snapshot.exists ? snapshot.data() : null;
        requireValue(wallet && wallet.ownerUid === uid && walletNumber(wallet.balance), 'CORRUPT_WALLET');
        let effect;
        try {
          requireValue(config.version === data.expectedConfigVersion && digest(config) === data.expectedConfigHash, 'RECONFIRM_CONFIG');
          effect = purchaseEffect({ pet, uid, config, nowMs, action: data.action, operationId: data.operationId, adoption: data.adoption });
          requireValue(wallet.balance >= effect.amount, 'INSUFFICIENT_FUNDS');
        } catch (error) {
          // Only pure, pre-write business decisions become terminal refusals.
          if (!refusalRef || !REFUSALS.has(error?.code)) throw error;
          const refusal = { schemaVersion: 1, status: 'REFUSED', ownerUid: uid, operationId: data.operationId,
            request: data, binding, reason: error.code, committedAtMs: nowMs };
          transaction.set(refusalRef, refusal);
          return { refusal, duplicate: false };
        }
        const walletAfter = debitAfter(wallet.balance, effect.amount);
        requireValue(walletAfter !== null, 'INVALID_WALLET_DEBIT');
        const receipt = { schemaVersion: 1, status: 'COMMITTED', ownerUid: uid, operationId: data.operationId,
          request: data, binding, action: data.action, category: 'pet_spend', amount: effect.amount,
          configVersion: config.version, configHash: digest(config), walletBefore: wallet.balance, walletAfter,
          benefit: effect.benefit, savedNeedsBefore: pet?.paidCare?.needs || null, needsBefore: effect.needsBefore, needsAfter: effect.pet.paidCare.needs,
          checkpoint: effect.pet.paidCare.checkpoint, deliveryId: data.operationId, committedAtMs: nowMs };
        // Adapter MUST stage writes in this transaction only, after all its reads.
        // The internal UID mirror adapter exists; live resolvers/exports are not wired.
        await walletAdapter.debit(transaction, wallet, effect.amount);
        transaction.set(petRef, effect.pet);
        transaction.set(receiptRef, receipt);
        return { receipt, duplicate: false, ...(includeState ? { state: projectHandheldState(uid, config, nowMs, effect.pet, { available: true, balance: walletAfter }) } : {}) };
      });
    },
  };
}

module.exports = { createPaidCareService, authenticatedUid, validateReceipt };
