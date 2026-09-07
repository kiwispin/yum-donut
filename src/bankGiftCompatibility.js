// Transitional client operations; legacy linkage is not server authorization.
import { assertWalletSession, validateWalletMirrors } from './walletCompatibility.js';
import { resolveBankBalance } from './bankBalance.js';

const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
const money = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const id = (value) => typeof value === 'string' && value.length > 0 && !value.includes('/');
function add(a, b) { requireValue(money(a) && money(b) && money(a + b), 'CORRUPT_BALANCE'); return a + b; }
function counter(value) { requireValue(value === undefined || (Number.isSafeInteger(value) && value >= 0), 'CORRUPT_BALANCE'); return value ?? 0; }

export function bankTransferFields(publicData, privateData, uid, amount, direction) {
    requireValue(Number.isSafeInteger(amount) && amount > 0, 'INVALID_AMOUNT');
    requireValue(['deposit', 'withdraw'].includes(direction), 'INVALID_TRANSFER');
    const wallet = validateWalletMirrors(publicData, privateData, uid).balance;
    const bank = resolveBankBalance(privateData.bank_balance, publicData.bank_balance);
    requireValue(money(bank), 'CORRUPT_BALANCE');
    requireValue((direction === 'deposit' ? wallet : bank) >= amount, 'INSUFFICIENT_FUNDS');
    return direction === 'deposit' ? { balance: wallet - amount, bank_balance: add(bank, amount) }
        : { balance: add(wallet, amount), bank_balance: bank - amount };
}

export async function giveDonutsTransaction(transaction, { uid, senderName, recipients, amount, today, isAdmin, dailyLimit,
    publicRefFor, privateRefFor, receiptRefFor, roster, isActive, timestamp, message, emoji, value, virtue, newAvatarColor }) {
    assertWalletSession(isActive);
    requireValue(id(uid) && id(senderName) && Number.isSafeInteger(amount) && amount > 0, 'INVALID_AMOUNT');
    requireValue(Array.isArray(recipients) && recipients.length > 0 && recipients.every(id)
        && new Set(recipients).size === recipients.length, 'DUPLICATE_RECIPIENT');
    requireValue(!recipients.includes(senderName), 'SELF_GIFT');
    const total = amount * recipients.length;
    requireValue(Number.isSafeInteger(total), 'INVALID_AMOUNT');
    const senderPublicRef = publicRefFor(senderName);
    const senderPrivateRef = privateRefFor(uid);
    const senderPublicSnap = await transaction.get(senderPublicRef);
    const senderPrivateSnap = await transaction.get(senderPrivateRef);
    requireValue(senderPublicSnap.exists() && senderPrivateSnap.exists(), 'WALLET_MISSING');
    const senderPublic = senderPublicSnap.data();
    const senderPrivate = senderPrivateSnap.data();
    validateWalletMirrors(senderPublic, senderPrivate, uid);
    const savedGiven = counter(senderPrivate.given_today);
    const given = senderPrivate.last_given_date === today ? savedGiven : 0;
    const nextGiven = add(given, total);
    requireValue(Number.isSafeInteger(nextGiven), 'CORRUPT_BALANCE');
    requireValue(isAdmin || nextGiven <= dailyLimit, 'DAILY_LIMIT');
    const lifetimeGiven = add(counter(senderPublic.lifetime_given), total);
    const seenUids = new Set([uid]);
    const targets = [];
    for (const name of recipients) {
        const publicRef = publicRefFor(name);
        const publicSnap = await transaction.get(publicRef);
        if (!publicSnap.exists()) {
            // Retain old creation only for true nonexistence, never corrupt data.
            requireValue(Array.isArray(roster) && roster.includes(name), 'WALLET_MISSING');
            targets.push({ name, publicRef, fresh: true });
            continue;
        }
        const data = publicSnap.data();
        requireValue(money(data.balance) && money(data.lifetime_received), 'CORRUPT_BALANCE');
        let privateRef = null;
        if (data.claimed === true) {
            requireValue(id(data.uid) && !seenUids.has(data.uid), 'WALLET_OWNER_CONFLICT');
            seenUids.add(data.uid);
            privateRef = privateRefFor(data.uid);
            const privateSnap = await transaction.get(privateRef);
            requireValue(privateSnap.exists(), 'WALLET_MISSING');
            validateWalletMirrors(data, privateSnap.data(), data.uid);
        } else {
            requireValue((data.claimed === false || data.claimed === undefined)
                && (data.uid === undefined || data.uid === null || data.uid === '')
                && !Object.hasOwn(data, 'ownerUid'), 'WALLET_OWNER_CONFLICT');
        }
        targets.push({ name, publicRef, privateRef, balance: add(data.balance, amount), lifetime: add(data.lifetime_received, amount) });
    }
    assertWalletSession(isActive); // All recipient reads precede ANY write.
    transaction.update(senderPrivateRef, { given_today: nextGiven, last_given_date: today });
    transaction.update(senderPublicRef, { lifetime_given: lifetimeGiven });
    for (const target of targets) {
        if (target.fresh) transaction.set(target.publicRef, { name: target.name, balance: amount, lifetime_given: 0,
            lifetime_received: amount, avatar_color: newAvatarColor(), bank_balance: 0, claimed: false, last_training_date: null });
        else {
            transaction.update(target.publicRef, { balance: target.balance, lifetime_received: target.lifetime });
            if (target.privateRef) transaction.update(target.privateRef, { balance: target.balance });
        }
        transaction.set(receiptRefFor(target.name), { fromName: senderName, toName: target.name, message,
            timestamp: timestamp(), emoji, amount, value, virtue, likes: [] });
    }
}
