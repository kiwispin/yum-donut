// Giving cheer (preview prototype): the first donut a student gives a teammate on
// a school day gives their pal one free happiness heart. Works on the paid-care
// preview state only; never charges, pays out or counts toward the daily care cap.

export const GIVING_CHEER_HAPPINESS = 1;
const MAX_HAPPINESS = 4;

// Weekends rest like the rest of YumPals; dateKey is an Auckland YYYY-MM-DD date.
export function isCheerRestDay(dateKey, frozenDates = []) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 || weekday === 6 || frozenDates.includes(dateKey);
}

export function cheerMessage(code, petName = 'Your pal') {
    switch (code) {
        case 'OK': return `${petName} heard you gave a donut! Happy +1.`;
        case 'OK_FULL': return `${petName} heard you gave a donut! Already as happy as can be.`;
        case 'ALREADY_CHEERED': return `${petName} already cheered for your giving today.`;
        case 'REST_DAY': return 'Giving cheers happen on school days.';
        case 'NOT_A_GIFT': return 'Only donuts given to a teammate cheer up your pal.';
        case 'NOT_TODAY': return 'Give a donut today to cheer up your pal.';
        case 'NO_PET': return 'Adopt a pal and they will cheer when you give donuts.';
        default: return '';
    }
}

// gift: { dateKey, mode } describing the student's latest gift ('give' or 'munch').
export function applyGivingCheer(state, gift, { paused = false } = {}) {
    const done = (code, extra = {}) => ({ state, code, ...extra });
    if (!state.pet) return done('NO_PET');
    if (!gift || gift.dateKey !== state.dateKey) return done('NOT_TODAY');
    if (gift.mode !== 'give') return done('NOT_A_GIFT');
    if (paused || isCheerRestDay(state.dateKey, state.frozenDates)) return done('REST_DAY');
    if (state.cheerDateKey === state.dateKey) return done('ALREADY_CHEERED');

    const before = state.pet.needs.happiness;
    const amount = Math.min(GIVING_CHEER_HAPPINESS, MAX_HAPPINESS - before);
    const receipt = {
        receiptId: `receipt-${state.receipts.length + 1}`,
        operationId: `cheer-${state.dateKey}`,
        action: 'cheer',
        label: 'Cheer',
        amount: 0,
        status: 'DELIVERED',
        benefit: amount ? `happiness +${amount} for giving` : 'cheer only; happiness already full',
        dateKey: state.dateKey,
        walletBefore: state.balance,
        walletAfter: state.balance,
        demoOnly: true,
    };
    const next = {
        ...state,
        cheerDateKey: state.dateKey,
        pet: { ...state.pet, needs: { ...state.pet.needs, happiness: before + amount } },
        receipts: [...state.receipts, receipt],
        operationIds: { ...state.operationIds, [receipt.operationId]: { action: 'cheer', amount: 0, receiptId: receipt.receiptId } },
    };
    return { state: next, code: amount ? 'OK' : 'OK_FULL', receipt, happinessGain: amount };
}

// Saved pals: the server sends `cheer` / `visit` on the read that granted it, and a
// recent read can be shown again from cache, so each plays once per owner and date.
const shown = new Set();
export function claimOnce(kind, ownerUid, date, storage = globalThis.localStorage) {
    const key = `yumpals_${kind}_shown_${ownerUid}_${date}`;
    if (shown.has(key)) return false;
    shown.add(key);
    try {
        if (storage?.getItem(key) === '1') return false;
        storage?.setItem(key, '1');
    } catch { /* the in-memory record still prevents replays this session */ }
    return true;
}
export const claimCheerDisplay = (ownerUid, date, storage) => claimOnce('cheer', ownerUid, date, storage);

const NEED_LABELS = { hunger: 'Food', happiness: 'Happy', cleanliness: 'Clean', health: 'Health' };
const NEED_ANIMATIONS = { hunger: 'feed', happiness: 'pat', cleanliness: 'clean', health: 'medicine' };
const giftedNeed = visit => Object.keys(NEED_LABELS).find(key => visit.gains[key] > 0);

export function visitMessage(visit, petName = 'Your pal') {
    if (visit.welcomeBack) return giftedNeed(visit) ? 'Welcome back! Every heart +1.' : `Welcome back! ${petName} missed you.`;
    const key = giftedNeed(visit);
    return key ? `${petName} loves your visit! ${NEED_LABELS[key]} +1.` : `${petName} loves your visit!`;
}

export function visitAnimation(visit) {
    if (visit.welcomeBack) return 'wake';
    return NEED_ANIMATIONS[giftedNeed(visit)] || 'pat';
}
