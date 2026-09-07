// Client compatibility only: game results, dates and teacher identity need server authority.
import { assertWalletSession, validateWalletMirrors } from './walletCompatibility.js';

const requireValue = (value, code) => { if (!value) throw new Error(code); };
const money = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const add = (a, b) => { requireValue(money(a) && money(b) && money(a + b), 'CORRUPT_BALANCE'); return a + b; };
const ARCADE = {
    last_daily_bonus: { name: 'the Claw Machine', amounts: [1, 5] },
    last_typing_defence_win: { name: 'Typing Defence', amounts: null }, // Score-based, no existing upper tier.
    last_wordle_win: { name: 'The Daily Rushes', amounts: [1] },
    last_cable_commander_win: { name: 'Cable Commander', amounts: [1, 2] },
    last_memory_match_win: { name: 'Memory Match', amounts: [1, 2] },
};

export function arcadeOutcome(data, { prize, cooldownField, gameName, today, timestamp }) {
    const game = Object.hasOwn(ARCADE, cooldownField) && ARCADE[cooldownField];
    requireValue(game && game.name === gameName && prize && typeof prize.label === 'string', 'INVALID_PRIZE');
    const ticket = cooldownField === 'last_daily_bonus' && prize.type === 'item' && prize.id === 'golden_ticket';
    const amount = ticket ? 10 : prize.amount;
    requireValue(ticket || (prize.type === 'donut' && Number.isSafeInteger(amount) && amount > 0
        && (!game.amounts || game.amounts.includes(amount))), 'INVALID_PRIZE');
    const last = data[cooldownField];
    if (last !== undefined && last !== null) {
        requireValue(typeof last.toDate === 'function', 'CORRUPT_COOLDOWN');
        const date = last.toDate();
        requireValue(date instanceof Date && Number.isFinite(date.getTime()), 'CORRUPT_COOLDOWN');
        requireValue(date.toDateString() !== today, 'DAILY_LIMIT');
    }
    return { amount, updates: { [cooldownField]: timestamp() }, first: false };
}

export function trainingOutcome(data, { wpm, accuracy, rewardAmount, badgeToGrant, mode, ninjaCombo, today }) {
    const fields = { scriptwriter: 'last_training_date', sudden_death: 'last_training_date_sudden_death', shortcut_ninja: 'last_training_date_ninja' };
    requireValue(Object.hasOwn(fields, mode), 'INVALID_TRAINING');
    requireValue(data.typing_license === true, 'LICENSE_REQUIRED');
    requireValue(Number.isFinite(wpm) && wpm >= 0 && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100
        && Number.isSafeInteger(ninjaCombo) && ninjaCombo >= 0, 'INVALID_TRAINING');
    requireValue(badgeToGrant === null || (mode === 'sudden_death' && badgeToGrant === 'perfectionist_badge'), 'INVALID_TRAINING');
    const dateField = fields[mode];
    requireValue(data[dateField] === undefined || data[dateField] === null || typeof data[dateField] === 'string', 'CORRUPT_COOLDOWN');
    requireValue(data[dateField] !== today, 'DAILY_LIMIT');
    requireValue(mode === 'shortcut_ninja' || (wpm >= 30 && accuracy >= 95), 'TRAINING_GOAL');
    requireValue(data.sudden_death_won === undefined || typeof data.sudden_death_won === 'boolean', 'CORRUPT_BALANCE');
    const first = mode === 'sudden_death' && !data.sudden_death_won;
    const amount = mode === 'sudden_death' ? (first ? 10 : 2) : mode === 'shortcut_ninja' ? (ninjaCombo >= 20 ? 2 : 1) : rewardAmount;
    requireValue(Number.isSafeInteger(amount) && amount > 0 && (mode !== 'scriptwriter' || [1, 2, 3].includes(amount)), 'INVALID_TRAINING');
    const saved = data.training_earned_today;
    requireValue(saved === undefined || (Number.isSafeInteger(saved) && saved >= 0), 'CORRUPT_BALANCE');
    const earned = data.training_last_earned_date === today ? (saved ?? 0) : 0;
    requireValue(first || earned + amount <= 3, 'TRAINING_CAP');
    const updates = { [dateField]: today, training_earned_today: add(earned, amount), training_last_earned_date: today };
    if (first) updates.sudden_death_won = true;
    if (first || badgeToGrant === 'perfectionist_badge') updates.perfectionist_badge = true;
    if (wpm >= 50) updates.silver_border = true;
    if (wpm >= 70) updates.gold_border = true;
    if (wpm >= 90) updates.flame_name = true;
    return { amount, updates, first };
}

export async function awardGameTransaction(transaction, { publicRef, privateRef, feedRef, uid, isActive, outcome, feed, training }) {
    assertWalletSession(isActive);
    const a = await transaction.get(publicRef); const b = await transaction.get(privateRef);
    requireValue(a.exists() && b.exists(), 'WALLET_MISSING');
    const publicData = a.data(); const privateData = b.data();
    const wallet = validateWalletMirrors(publicData, privateData, uid);
    const result = outcome(privateData);
    const balance = add(wallet.balance, result.amount);
    const lifetime_received = add(publicData.lifetime_received, result.amount);
    assertWalletSession(isActive);
    transaction.update(privateRef, { ...result.updates, balance, ...(training ? { lifetime_received } : {}) });
    transaction.update(publicRef, { ...(training ? result.updates : {}), balance, lifetime_received });
    transaction.set(feedRef, { ...feed(result), amount: result.amount });
    return result;
}

export async function munchTransaction(transaction, { publicRef, privateRefFor, amount, isActive, feedRef, feed }) {
    assertWalletSession(isActive);
    requireValue([1, 2, 5, 10].includes(amount), 'INVALID_AMOUNT');
    const snapshot = await transaction.get(publicRef);
    requireValue(snapshot.exists(), 'WALLET_MISSING');
    const data = snapshot.data();
    requireValue(money(data.balance) && money(data.bank_balance), 'CORRUPT_BALANCE');
    let privateRef = null;
    if (data.claimed === true) {
        requireValue(typeof data.uid === 'string' && data.uid.length > 0 && !data.uid.includes('/'), 'WALLET_OWNER_CONFLICT');
        privateRef = privateRefFor(data.uid);
        const privateSnap = await transaction.get(privateRef);
        requireValue(privateSnap.exists(), 'WALLET_MISSING');
        validateWalletMirrors(data, privateSnap.data(), data.uid);
        requireValue(money(privateSnap.data().bank_balance) && privateSnap.data().bank_balance === data.bank_balance, 'CORRUPT_BALANCE');
    } else requireValue((data.claimed === false || data.claimed === undefined)
        && (data.uid === undefined || data.uid === null || data.uid === '') && !Object.hasOwn(data, 'ownerUid'), 'WALLET_OWNER_CONFLICT');
    const source = data.balance >= amount ? 'wallet' : data.bank_balance >= amount ? 'bank' : null;
    requireValue(source, 'INSUFFICIENT_FUNDS');
    const fields = source === 'wallet' ? { balance: data.balance - amount } : { bank_balance: data.bank_balance - amount };
    assertWalletSession(isActive);
    transaction.update(publicRef, fields);
    if (privateRef) transaction.update(privateRef, fields);
    transaction.set(feedRef, { ...feed(source), amount });
    return source;
}
