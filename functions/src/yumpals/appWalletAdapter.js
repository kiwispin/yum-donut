// YumPals-only bridge to the existing app wallet. Does not migrate bank/gift
// systems or claim to secure the app's existing client-writable financial data.
const { requireValue } = require('./paidCareEngine');
const { walletNumber, debitAfter } = require('./walletNumber');

function emailCandidates(name) {
  const value = name.trim().normalize('NFKC'); let hash = 2166136261;
  for (const character of value) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'user';
  return [`${slug}-${hash.toString(36)}@yumdonut.school`, `${value.replace(/\s+/g, '').toLowerCase()}@yumdonut.school`];
}
function createAppWalletAdapter({ authAdmin, publicProfiles, privateProfile }) {
  requireValue(typeof authAdmin?.getUser === 'function' && typeof publicProfiles === 'function' && typeof privateProfile === 'function', 'INVALID_WALLET_REFS');
  const contexts = new WeakMap(); const reads = new WeakSet();
  return {
    async read(transaction, uid) {
      requireValue(typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !uid.includes('/'), 'INVALID_WALLET_UID');
      requireValue(!reads.has(transaction), 'WALLET_ALREADY_READ'); reads.add(transaction);
      const privateRef = privateProfile(uid);
      const [identity, found, privateSnapshot] = await Promise.all([
        authAdmin.getUser(uid),
        transaction.get(publicProfiles().where('uid', '==', uid).limit(2)),
        transaction.get(privateRef),
      ]);
      requireValue(identity?.uid === uid && identity.disabled === false && typeof identity.email === 'string'
        && identity.providerData?.some(p => p.providerId === 'password'), 'WALLET_OWNER_CONFLICT');
      requireValue(found.docs?.length === 1, 'TRUSTED_MAPPING_REQUIRED');
      const publicSnapshot = found.docs[0]; const publicData = publicSnapshot.data();
      requireValue(publicData?.uid === uid && publicData.claimed === true && typeof publicData.name === 'string'
        && publicData.name.trim().length > 0 && publicData.name.length <= 1500
        && emailCandidates(publicData.name).includes(identity.email.toLowerCase()), 'WALLET_OWNER_CONFLICT');
      requireValue(privateSnapshot.exists, 'WALLET_MIRROR_MISSING'); const privateData = privateSnapshot.data();
      requireValue(privateData && (!Object.hasOwn(privateData, 'uid') || privateData.uid === uid), 'WALLET_OWNER_CONFLICT');
      for (const data of [publicData, privateData]) {
        requireValue(!Object.hasOwn(data, 'ownerUid') || data.ownerUid === uid, 'WALLET_OWNER_CONFLICT');
        requireValue(walletNumber(data.balance), 'INVALID_WALLET_BALANCE');
      }
      requireValue(publicData.balance === privateData.balance, 'WALLET_BALANCE_CONFLICT');
      requireValue(publicSnapshot.ref?.path && privateRef?.path && publicSnapshot.ref.path !== privateRef.path, 'INVALID_WALLET_REFS');
      const wallet = Object.freeze({ ownerUid: uid, balance: privateData.balance });
      contexts.set(wallet, { transaction, publicRef: publicSnapshot.ref, privateRef, publicData, privateData });
      return wallet;
    },
    async debit(transaction, wallet, amount) {
      const context = contexts.get(wallet);
      requireValue(context?.transaction === transaction, 'INVALID_WALLET_CONTEXT');
      const balance = debitAfter(wallet.balance, amount); requireValue(balance !== null, 'INVALID_WALLET_DEBIT');
      contexts.delete(wallet);
      transaction.set(context.publicRef, { ...context.publicData, balance });
      transaction.set(context.privateRef, { ...context.privateData, balance });
    },
  };
}
module.exports = { createAppWalletAdapter, emailCandidates };
