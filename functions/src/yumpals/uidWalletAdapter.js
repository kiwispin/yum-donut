// Internal only. Resolvers and mapping storage MUST be server-owned dependencies.
// No name lookup, bootstrap, balance repair, callable export or live default paths.
const { requireValue } = require('./paidCareEngine');
const { walletNumber, debitAfter } = require('./walletNumber');

function validId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 1500
    && value !== '.' && value !== '..' && !value.includes('/');
}

function createUidWalletAdapter({ refs }) {
  requireValue(refs && ['mapping', 'publicProfile', 'privateProfile'].every((key) => typeof refs[key] === 'function'), 'INVALID_WALLET_REFS');
  const contexts = new WeakMap();
  const readTransactions = new WeakSet();
  return {
    async read(transaction, uid) {
      requireValue(validId(uid) && uid.length <= 128, 'INVALID_WALLET_UID');
      requireValue(!readTransactions.has(transaction), 'WALLET_ALREADY_READ');
      readTransactions.add(transaction);
      const mappingRef = refs.mapping(uid);
      const mappingSnapshot = await transaction.get(mappingRef);
      requireValue(mappingSnapshot.exists, 'TRUSTED_MAPPING_REQUIRED');
      const mapping = mappingSnapshot.data();
      requireValue(mapping?.schemaVersion === 1 && mapping.ownerUid === uid && validId(mapping.publicProfileId), 'INVALID_WALLET_MAPPING');
      const publicRef = refs.publicProfile(mapping.publicProfileId);
      const privateRef = refs.privateProfile(uid);
      const paths = [mappingRef, publicRef, privateRef].map((ref) => typeof ref === 'string' ? ref : ref?.path);
      requireValue(paths.every((path) => typeof path === 'string' && path.length > 0) && new Set(paths).size === 3, 'INVALID_WALLET_REFS');
      const publicSnapshot = await transaction.get(publicRef);
      const privateSnapshot = await transaction.get(privateRef);
      requireValue(publicSnapshot.exists && privateSnapshot.exists, 'WALLET_MIRROR_MISSING');
      const publicData = publicSnapshot.data();
      const privateData = privateSnapshot.data();
      for (const data of [publicData, privateData]) {
        // ownerUid is a protected bootstrap assertion; legacy uid alone is NOT authority.
        requireValue(data?.ownerUid === uid && (!Object.hasOwn(data, 'uid') || data.uid === uid), 'WALLET_OWNER_CONFLICT');
        requireValue(walletNumber(data.balance), 'INVALID_WALLET_BALANCE');
      }
      requireValue(publicData.balance === privateData.balance, 'WALLET_BALANCE_CONFLICT');
      const wallet = Object.freeze({ ownerUid: uid, balance: privateData.balance });
      contexts.set(wallet, { transaction, publicRef, privateRef, publicData, privateData });
      return wallet;
    },
    async debit(transaction, wallet, amount) {
      const context = contexts.get(wallet);
      requireValue(context && context.transaction === transaction, 'INVALID_WALLET_CONTEXT');
      const balance = debitAfter(wallet.balance, amount);
      requireValue(balance !== null, 'INVALID_WALLET_DEBIT');
      contexts.delete(wallet); // A read can authorize only one debit in this attempt.
      // All reads finished. Spread retains opaque SDK values and unrelated fields.
      transaction.set(context.publicRef, { ...context.publicData, balance });
      transaction.set(context.privateRef, { ...context.privateData, balance });
    },
  };
}

module.exports = { createUidWalletAdapter };
