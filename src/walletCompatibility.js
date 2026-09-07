// Transitional client compatibility, NOT trusted ownership for paid pet activation.
// Legacy linkage remains client-writable until the separately reviewed rules rollout.
export function assertWalletSession(isActive) {
    if (!isActive()) throw new Error('WALLET_SESSION_CHANGED');
}

const validBalance = (value) => typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

export function validateWalletMirrors(publicData, privateData, uid, allowLegacySync = false) {
    if (!uid || !publicData || !privateData) throw new Error('WALLET_MISSING');
    if (publicData.uid !== uid || publicData.claimed !== true
        || (Object.hasOwn(privateData, 'uid') && privateData.uid !== uid)) throw new Error('WALLET_OWNER_CONFLICT');
    const protectedOwner = Object.hasOwn(publicData, 'ownerUid') || Object.hasOwn(privateData, 'ownerUid');
    if (protectedOwner && (publicData.ownerUid !== uid || privateData.ownerUid !== uid)) throw new Error('WALLET_OWNER_CONFLICT');
    if (!validBalance(publicData.balance) || !validBalance(privateData.balance)) throw new Error('CORRUPT_BALANCE');
    if (publicData.balance !== privateData.balance && (protectedOwner || !allowLegacySync)) throw new Error('WALLET_BALANCE_CONFLICT');
    return { balance: publicData.balance, privateBalance: privateData.balance };
}

export async function readWalletMirrors(transaction, { publicRef, privateRef, uid, isActive, allowLegacySync = false }) {
    assertWalletSession(isActive);
    const publicSnapshot = await transaction.get(publicRef);
    const privateSnapshot = await transaction.get(privateRef);
    assertWalletSession(isActive);
    if (!publicSnapshot.exists() || !privateSnapshot.exists()) throw new Error('WALLET_MISSING');
    return validateWalletMirrors(publicSnapshot.data(), privateSnapshot.data(), uid, allowLegacySync);
}

export async function reconcileLegacyWallet(transaction, options) {
    // Snapshot events only trigger this read; no event balance is accepted.
    const wallet = await readWalletMirrors(transaction, { ...options, allowLegacySync: true });
    assertWalletSession(options.isActive);
    if (wallet.balance !== wallet.privateBalance) transaction.update(options.privateRef, { balance: wallet.balance });
}

export function walletBalanceAfterDebit(balance, amount) {
    if (!validBalance(balance) || !validBalance(amount)) throw new Error('CORRUPT_BALANCE');
    if (balance < amount) throw new Error('INSUFFICIENT_FUNDS');
    return balance - amount;
}

export function walletErrorMessage(error) {
    const code = error?.message || error;
    if (['WALLET_BALANCE_CONFLICT', 'WALLET_OWNER_CONFLICT', 'WALLET_MISSING', 'CORRUPT_BALANCE'].includes(code)) {
        return 'Please ask your teacher to check your account. No donuts spent.';
    }
    if (code === 'WALLET_SESSION_CHANGED') return 'Please sign in again before trying. No donuts spent.';
    if (code === 'INSUFFICIENT_FUNDS') return 'Not enough donuts. No donuts spent.';
    return null;
}
