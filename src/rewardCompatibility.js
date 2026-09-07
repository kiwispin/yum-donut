// Client compatibility only. These linkage checks are NOT server authorization.
import { assertWalletSession, validateWalletMirrors } from './walletCompatibility.js';
import { resolveBankBalance } from './bankBalance.js';

const validId = (value) => typeof value === 'string' && value.length > 0 && !value.includes('/');
const validMoney = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
const addMoney = (a, b) => {
    requireValue(validMoney(a) && validMoney(b) && validMoney(a + b), 'CORRUPT_BALANCE');
    return a + b;
};

export async function payBountyTransaction(transaction, { bountyId, bountyRef, receiptRef, activityRef, publicRefFor, privateRefFor, isActive, timestamp }) {
    assertWalletSession(isActive);
    requireValue(validId(bountyId), 'BOUNTY_MISSING');
    const bountyPath = typeof bountyRef === 'string' ? bountyRef : bountyRef.path;
    const bountySnap = await transaction.get(bountyRef);
    const receiptSnap = await transaction.get(receiptRef);
    requireValue(bountySnap.exists(), 'BOUNTY_MISSING');
    const bounty = bountySnap.data();
    if (receiptSnap.exists()) {
        const receipt = receiptSnap.data();
        requireValue(receipt.bountyId === bountyId && receipt.bountyPath === bountyPath
            && receipt.category === 'bounty_reward' && receipt.recipientUid === bounty.claimantId
            && receipt.amount === bounty.reward && validMoney(receipt.amount) && receipt.amount > 0
            && validMoney(receipt.walletBefore) && validMoney(receipt.walletAfter) && receipt.walletAfter === receipt.walletBefore + receipt.amount
            && validMoney(receipt.lifetimeBefore) && validMoney(receipt.lifetimeAfter) && receipt.lifetimeAfter === receipt.lifetimeBefore + receipt.amount, 'CORRUPT_BOUNTY_RECEIPT');
        assertWalletSession(isActive);
        return { duplicate: true, amount: 0 };
    }
    if (bounty.status === 'paid') {
        assertWalletSession(isActive);
        return { duplicate: true, amount: 0 }; // Includes old paid jobs without new receipts.
    }
    requireValue(['claimed', 'pending_review'].includes(bounty.status), 'BOUNTY_NOT_PAYABLE');
    requireValue(validId(bounty.claimantId) && validId(bounty.claimantName), 'WALLET_OWNER_CONFLICT');
    requireValue(validMoney(bounty.reward) && bounty.reward > 0, 'CORRUPT_BALANCE');
    const publicRef = publicRefFor(bounty.claimantName);
    const privateRef = privateRefFor(bounty.claimantId);
    const publicSnap = await transaction.get(publicRef);
    const privateSnap = await transaction.get(privateRef);
    requireValue(publicSnap.exists() && privateSnap.exists(), 'WALLET_MISSING');
    const publicData = publicSnap.data();
    const wallet = validateWalletMirrors(publicData, privateSnap.data(), bounty.claimantId);
    const balance = addMoney(wallet.balance, bounty.reward);
    const lifetime = addMoney(publicData.lifetime_received, bounty.reward);
    assertWalletSession(isActive);
    transaction.update(publicRef, { balance, lifetime_received: lifetime });
    transaction.update(privateRef, { balance });
    transaction.update(bountyRef, { status: 'paid' });
    const receipt = { bountyId, bountyPath, walletBefore: wallet.balance, walletAfter: balance,
        lifetimeBefore: publicData.lifetime_received, lifetimeAfter: lifetime,
        fromName: 'Mr Rayner', toName: bounty.claimantName, recipientUid: bounty.claimantId,
        category: 'bounty_reward', amount: bounty.reward, message: `Completed the bounty: ${bounty.reward} Donuts awarded!`,
        timestamp: timestamp(), emoji: '💰', likes: [] };
    transaction.set(receiptRef, receipt);
    transaction.set(activityRef, { fromName: receipt.fromName, toName: receipt.toName, message: receipt.message,
        amount: receipt.amount, timestamp: receipt.timestamp, emoji: receipt.emoji, likes: [] });
    return { duplicate: false, amount: bounty.reward };
}

export async function payInterestTransaction(transaction, { publicRef, privateRef, receiptRef, activityRef, uid, operationId, rate, isActive, timestamp }) {
    assertWalletSession(isActive);
    requireValue(validId(uid) && validId(operationId) && Number.isFinite(rate) && rate > 0, 'WALLET_OWNER_CONFLICT');
    const prior = await transaction.get(receiptRef);
    if (prior.exists()) {
        const receipt = prior.data();
        requireValue(receipt.operationId === operationId && receipt.uid === uid && receipt.rate === rate
            && validMoney(receipt.amount) && validMoney(receipt.before) && validMoney(receipt.after) && receipt.after === receipt.before + receipt.amount
            && receipt.amount === (receipt.before < Math.ceil(1 / rate) ? 0 : Math.floor(receipt.before * rate)), 'CORRUPT_INTEREST_RECEIPT');
        assertWalletSession(isActive);
        return { amount: receipt.amount, duplicate: true };
    }
    const publicSnap = await transaction.get(publicRef);
    const privateSnap = await transaction.get(privateRef);
    requireValue(publicSnap.exists() && privateSnap.exists(), 'WALLET_MISSING');
    const publicData = publicSnap.data();
    const privateData = privateSnap.data();
    validateWalletMirrors(publicData, privateData, uid);
    const bank = resolveBankBalance(privateData.bank_balance, publicData.bank_balance);
    requireValue(bank !== null && validMoney(bank), 'CORRUPT_BALANCE');
    const amount = bank < Math.ceil(1 / rate) ? 0 : Math.floor(bank * rate);
    const after = addMoney(bank, amount);
    assertWalletSession(isActive);
    if (amount > 0) {
        transaction.update(publicRef, { bank_balance: after });
        transaction.update(privateRef, { bank_balance: after });
        transaction.set(activityRef, { fromName: 'The Bank', toName: publicData.name, message: `Interest payout: +${amount} donut${amount === 1 ? '' : 's'}.`,
            timestamp: timestamp(), emoji: '💸', amount, likes: [] });
    }
    transaction.set(receiptRef, { operationId, uid, rate, before: bank, after, amount, timestamp: timestamp() });
    return { amount, duplicate: false };
}

export function validateInterestRecipients(recipients) {
    const selected = recipients.filter((recipient) => recipient.uid || recipient.claimed === true)
        .map((recipient) => ({ id: recipient.id, uid: recipient.uid || null }));
    requireValue(selected.every((recipient) => validId(recipient.uid)), 'CLAIMED_UID_MISSING');
    validateManifestRecipients(selected);
    return selected;
}

function validateManifestRecipients(recipients) {
    requireValue(Array.isArray(recipients), 'INVALID_INTEREST_RUN');
    const ids = new Set();
    const uids = new Set();
    for (const recipient of recipients) {
        requireValue(recipient && validId(recipient.id) && validId(recipient.uid)
            && !ids.has(recipient.id) && !uids.has(recipient.uid), 'WALLET_OWNER_CONFLICT');
        ids.add(recipient.id);
        uids.add(recipient.uid);
    }
}

const runKey = (uid) => `yum-donut:interest-run:v1:${encodeURIComponent(uid)}`;

export function prepareInterestRun({ storage, uid, rate, recipients, newOperationId }) {
    requireValue(validId(uid), 'INVALID_INTEREST_RUN');
    const key = runKey(uid);
    const saved = storage.getItem(key); // Storage failure aborts BEFORE any payout.
    if (saved !== null) {
        const run = JSON.parse(saved);
        requireValue(run?.schemaVersion === 1 && run.uid === uid && validId(run.operationId)
            && Number.isFinite(run.rate) && run.rate > 0, 'INVALID_INTEREST_RUN');
        validateManifestRecipients(run.recipients);
        return run;
    }
    const run = { schemaVersion: 1, uid, operationId: newOperationId(), rate, recipients: validateInterestRecipients(recipients) };
    requireValue(validId(run.operationId) && Number.isFinite(rate) && rate > 0, 'INVALID_INTEREST_RUN');
    const encoded = JSON.stringify(run);
    storage.setItem(key, encoded);
    requireValue(storage.getItem(key) === encoded, 'INTEREST_RUN_STORAGE_FAILED');
    return run;
}

export function completeInterestRun(storage, run) {
    const key = runKey(run.uid);
    const saved = JSON.parse(storage.getItem(key));
    requireValue(JSON.stringify(saved) === JSON.stringify(run), 'INVALID_INTEREST_RUN');
    storage.removeItem(key); // Only after every recipient and the summary are confirmed.
}
