// Client compatibility only; does not establish protected ownership or trusted mapping.
import { assertWalletSession, validateWalletMirrors } from './walletCompatibility.js';
import { getBankBalance, resolveBankBalance } from './bankBalance.js';

const requireValue = (value, code) => { if (!value) throw new Error(code); };
const money = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const COPY_FIELDS = ['avatar_color', 'avatar_pixels', 'avatar_grid_size', 'live_avatar_color', 'live_avatar_icon',
    'rainbow_name', 'gold_border', 'neon_name', 'verified_badge', 'silver_border', 'flame_name', 'perfectionist_badge',
    'typing_license', 'sudden_death_won', 'last_training_date', 'last_training_date_sudden_death', 'last_training_date_ninja',
    'training_earned_today', 'training_last_earned_date', 'last_daily_bonus', 'last_typing_defence_win', 'last_wordle_win',
    'last_cable_commander_win', 'last_memory_match_win'];

export async function bootstrapProfile(transaction, { uid, name, publicRef, privateRef, rosterRef, isActive, defaults }) {
    assertWalletSession(isActive);
    requireValue(typeof uid === 'string' && uid && !uid.includes('/') && typeof name === 'string' && name && !name.includes('/'), 'PROFILE_LINK_CONFLICT');
    const publicSnap = await transaction.get(publicRef);
    const privateSnap = await transaction.get(privateRef);
    const rosterSnap = await transaction.get(rosterRef);
    assertWalletSession(isActive);
    const publicData = publicSnap.exists() ? publicSnap.data() : null;
    const privateData = privateSnap.exists() ? privateSnap.data() : null;
    if (publicData) {
        requireValue(publicData.name === name, 'PROFILE_NAME_MISMATCH');
        requireValue(money(publicData.balance) && money(publicData.lifetime_given) && money(publicData.lifetime_received)
            && money(getBankBalance(publicData.bank_balance)), 'CORRUPT_BALANCE');
    }
    if (privateData) {
        requireValue(privateData.name === name, 'PROFILE_NAME_MISMATCH');
        requireValue(publicData, 'PROFILE_REPAIR_REQUIRED');
        validateWalletMirrors(publicData, privateData, uid);
        requireValue(resolveBankBalance(privateData.bank_balance, publicData.bank_balance) !== null, 'CORRUPT_BALANCE');
        return { created: false }; // Never write an existing private profile.
    }
    if (publicData) {
        requireValue(publicData.claimed !== true, 'PROFILE_REPAIR_REQUIRED');
        requireValue((publicData.claimed === false || publicData.claimed === undefined)
            && (publicData.uid === undefined || publicData.uid === null || publicData.uid === '')
            && !Object.hasOwn(publicData, 'ownerUid'), 'PROFILE_LINK_CONFLICT');
    }
    const roster = rosterSnap.exists() ? rosterSnap.data() : {};
    requireValue(Array.isArray(roster.names) && roster.names.includes(name)
        && !(Array.isArray(roster.removed_names) && roster.removed_names.includes(name)), 'PROFILE_NOT_ACTIVE');
    const copied = {};
    if (publicData) for (const key of COPY_FIELDS) if (Object.hasOwn(publicData, key)) copied[key] = publicData[key];
    const balance = publicData ? publicData.balance : 0;
    const bank = publicData ? getBankBalance(publicData.bank_balance) : 0;
    assertWalletSession(isActive);
    transaction.set(privateRef, { ...defaults, ...copied, name, balance, bank_balance: bank });
    if (publicData) transaction.update(publicRef, { claimed: true, uid });
    else transaction.set(publicRef, { name, balance: 0, bank_balance: 0, lifetime_given: 0, lifetime_received: 0,
        avatar_color: defaults.avatar_color, claimed: true, uid, typing_license: defaults.typing_license,
        live_avatar_color: defaults.live_avatar_color, live_avatar_icon: defaults.live_avatar_icon, last_seen: defaults.last_seen });
    return { created: true };
}

export function watchAuthProfile({ auth, onAuthStateChanged, onSnapshot, profileRef, setUser, setMyProfile, setLoading, onError }) {
    let generation = 0; let stopped = false; let unsubscribeProfile = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        if (stopped || (auth.currentUser?.uid ?? null) !== (currentUser?.uid ?? null)) return;
        const ownGeneration = ++generation;
        if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
        setMyProfile(null);
        setUser(currentUser);
        if (!currentUser) { setLoading(false); return; }
        const active = () => !stopped && generation === ownGeneration && auth.currentUser?.uid === currentUser.uid;
        const stopProfile = onSnapshot(profileRef(currentUser.uid), (snapshot) => {
            if (!active()) return;
            setMyProfile(snapshot.exists() ? snapshot.data() : null);
            setLoading(false);
        }, (error) => {
            if (!active()) return;
            setLoading(false); onError(error);
        });
        if (active()) unsubscribeProfile = stopProfile;
        else stopProfile();
    });
    return () => { stopped = true; generation += 1; if (unsubscribeProfile) unsubscribeProfile(); unsubscribeAuth(); };
}
