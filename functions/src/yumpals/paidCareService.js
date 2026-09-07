// Internal service ONLY. No onCall export, legacy identity lookup or default adapter.
// refs/config and walletAdapter are trusted server dependencies, never request data.
const { PRICES, validateConfig, validatePet, advancePet, migrateLegacyPet, purchaseEffect, digest, requireValue, integer, aucklandNow, dayNumber } = require('./paidCareEngine');

const ID = /^[A-Za-z0-9_-]{1,80}$/u;

function authenticatedUid(request) {
  const uid = request?.auth?.uid;
  requireValue(typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !uid.includes('/'), 'UNAUTHENTICATED');
  const provider = request.auth.token?.firebase?.sign_in_provider;
  requireValue(typeof provider === 'string' && provider !== 'anonymous' && provider.length > 0, 'UNAUTHENTICATED');
  return uid;
}

function boundRequest(data) {
  requireValue(data && typeof data === 'object' && !Array.isArray(data), 'INVALID_REQUEST');
  const allowed = ['operationId', 'action', 'expectedConfigVersion', 'expectedConfigHash', 'adoption'];
  requireValue(Object.keys(data).every((key) => allowed.includes(key)), 'INVALID_REQUEST');
  requireValue(typeof data.operationId === 'string' && ID.test(data.operationId), 'INVALID_OPERATION');
  requireValue(typeof data.action === 'string' && Object.hasOwn(PRICES, data.action), 'INVALID_ACTION');
  requireValue(typeof data.expectedConfigVersion === 'string' && ID.test(data.expectedConfigVersion), 'INVALID_CONFIG_VERSION');
  requireValue(typeof data.expectedConfigHash === 'string' && /^[a-f0-9]{64}$/u.test(data.expectedConfigHash), 'INVALID_CONFIG_HASH');
  let adoption = null;
  if (data.action === 'adoption') {
    requireValue(data.adoption && typeof data.adoption === 'object' && !Array.isArray(data.adoption), 'INVALID_ADOPTION');
    requireValue(Object.keys(data.adoption).length === 4 && ['name', 'species', 'casing', 'color'].every((key) => typeof data.adoption[key] === 'string'), 'INVALID_ADOPTION');
    const { name, species, casing, color } = data.adoption;
    adoption = { name, species, casing, color };
  } else requireValue(data.adoption === undefined, 'INVALID_REQUEST');
  return { operationId: data.operationId, action: data.action, expectedConfigVersion: data.expectedConfigVersion, expectedConfigHash: data.expectedConfigHash, adoption };
}

function validateReceipt(receipt, uid, operationId) {
  requireValue(receipt && receipt.schemaVersion === 1 && receipt.ownerUid === uid && receipt.operationId === operationId, 'CORRUPT_RECEIPT');
  requireValue(receipt.status === 'COMMITTED' && integer(receipt.amount, 1) && integer(receipt.walletBefore) && integer(receipt.walletAfter)
    && receipt.walletBefore - receipt.walletAfter === receipt.amount, 'CORRUPT_RECEIPT');
  requireValue(receipt.request && receipt.binding === digest(receipt.request) && receipt.action === receipt.request.action
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

function createPaidCareService({ db, refs, walletAdapter, now = Date.now }) {
  requireValue(db && typeof db.runTransaction === 'function' && refs && ['pet', 'receipt', 'migration', 'config'].every((key) => typeof refs[key] === 'function'), 'INVALID_DEPENDENCIES');
  requireValue(walletAdapter && typeof walletAdapter.read === 'function' && typeof walletAdapter.debit === 'function', 'TRUSTED_WALLET_ADAPTER_REQUIRED');

  async function readConfig(transaction, uid) {
    // Per-UID trusted config resolver allows server-owned absence history.
    const snapshot = await transaction.get(refs.config(uid));
    requireValue(snapshot.exists, 'CONFIG_MISSING');
    return validateConfig(snapshot.data());
  }

  return {
    getState: async (request) => {
      const uid = authenticatedUid(request);
      requireValue(!request.data || Object.keys(request.data).length === 0, 'INVALID_REQUEST');
      const nowMs = now();
      aucklandNow(nowMs);
      return db.runTransaction(async (transaction) => {
        const config = await readConfig(transaction, uid);
        const snapshot = await transaction.get(refs.pet(uid));
        const pet = snapshot.exists ? snapshot.data() : null;
        if (pet) validatePet(pet, uid); // Legacy reads require explicit migration first.
        const next = pet ? advancePet(pet, uid, config, nowMs) : pet;
        if (pet && digest(pet.paidCare) !== digest(next.paidCare)) transaction.set(refs.pet(uid), next);
        return { pet: next, enabled: config.enabled, configVersion: config.version, configHash: digest(config), prices: config.prices, restores: config.restores, careCap: config.careCap };
      });
    },

    migrate: async (request) => {
      const uid = authenticatedUid(request);
      // This internal method has no live endpoint; a future migration wrapper needs review.
      requireValue(!request.data || Object.keys(request.data).length === 0, 'INVALID_REQUEST');
      const nowMs = now();
      aucklandNow(nowMs);
      return db.runTransaction(async (transaction) => {
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
      const data = boundRequest(request.data);
      const binding = digest(data);
      const nowMs = now();
      aucklandNow(nowMs);
      return db.runTransaction(async (transaction) => {
        const receiptRef = refs.receipt(uid, data.operationId);
        const prior = await transaction.get(receiptRef);
        if (prior.exists) {
          const receipt = prior.data();
          validateReceipt(receipt, uid, data.operationId);
          requireValue(receipt.binding === binding, 'OPERATION_CONFLICT');
          // A committed retry returns the original receipt even after config/day changes.
          return { receipt, duplicate: true };
        }
        const config = await readConfig(transaction, uid);
        requireValue(config.version === data.expectedConfigVersion && digest(config) === data.expectedConfigHash, 'RECONFIRM_CONFIG');
        const petRef = refs.pet(uid);
        const snapshot = await transaction.get(petRef);
        const pet = snapshot.exists ? snapshot.data() : null;
        const wallet = await walletAdapter.read(transaction, uid);
        requireValue(wallet && wallet.ownerUid === uid && integer(wallet.balance), 'CORRUPT_WALLET');
        const effect = purchaseEffect({ pet, uid, config, nowMs, action: data.action, operationId: data.operationId, adoption: data.adoption });
        requireValue(wallet.balance >= effect.amount, 'INSUFFICIENT_FUNDS');
        const receipt = { schemaVersion: 1, status: 'COMMITTED', ownerUid: uid, operationId: data.operationId,
          request: data, binding, action: data.action, category: 'pet_spend', amount: effect.amount,
          configVersion: config.version, configHash: digest(config), walletBefore: wallet.balance, walletAfter: wallet.balance - effect.amount,
          benefit: effect.benefit, savedNeedsBefore: pet?.paidCare?.needs || null, needsBefore: effect.needsBefore, needsAfter: effect.pet.paidCare.needs,
          checkpoint: effect.pet.paidCare.checkpoint, deliveryId: data.operationId, committedAtMs: nowMs };
        // Adapter MUST stage writes in this transaction only, after all its reads.
        // It owns any future mirror protocol; no legacy wallet implementation exists here.
        await walletAdapter.debit(transaction, wallet, effect.amount);
        transaction.set(petRef, effect.pet);
        transaction.set(receiptRef, receipt);
        return { receipt, duplicate: false };
      });
    },
  };
}

module.exports = { createPaidCareService };
