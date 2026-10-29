// The app's side of the Donut pal server ("pocket" requests on the two existing
// endpoints). Every reply is checked exactly before it is shown, and only
// { pocket: 1 } requests are ever sent, so this never touches the paid-care path.
import { GAME_ROUNDS, MESS_MAX, NEEDS_MAX, SNACKS_PER_DAY } from './donutPal.js';

const NAMES = { read: 'yumpalsGetPaidCareState', act: 'yumpalsPurchaseCare' };
const ID = /^[A-Za-z0-9_-]{1,80}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STAGES = ['egg', 'baby', 'child', 'teen', 'adult'];
const SPECIES = ['mossbit', 'pufflet', 'emberoo'];
const CASES = ['berry', 'mint', 'sky', 'sun'];
const TIMERS = ['hunger', 'happy', 'mess', 'messAge', 'empty', 'sad'];
const REASONS = ['POCKET_NOT_READY', 'ROLLOUT_NOT_READY', 'UNAUTHENTICATED', 'CONFIG_MISSING', 'CORRUPT_POCKET', 'NO_PET', 'GAME_ROUND_CONFLICT', 'OPERATION_CONFLICT'];
const MAX_MS = 253402214400000;

const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const int = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= min && v <= max;
const time = v => int(v, 0, MAX_MS);
const optionalDate = v => v === undefined || (typeof v === 'string' && DATE.test(v));
const invalid = () => Object.assign(new Error('Your pal could not be confirmed.'), { details: { reason: 'INVALID_REPLY' } });
const check = condition => { if (!condition) throw invalid(); };

export function validName(value) {
    const name = String(value || '').trim().normalize('NFKC');
    return name && name.length <= 16 && /^[\p{L}\p{N} _-]+$/u.test(name) ? name : null;
}

const PAL_KEYS = ['version', 'name', 'species', 'stage', 'form', 'hatchAt', 'bornAt', 'hunger', 'happy', 'weight', 'mess', 'sick', 'doses',
    'sleepy', 'napUntil', 'lightsOff', 'gamesInRow', 'snackDate', 'snacks', 'caredDates', 'mistakes', 'timers', 'at', 'events'];

export function validPalState(s) {
    return plain(s) && Object.keys(s).every(key => PAL_KEYS.includes(key) || key === 'wakeDate') && PAL_KEYS.every(key => Object.hasOwn(s, key))
        && s.version === 2 && typeof s.name === 'string' && SPECIES.includes(s.species) && STAGES.includes(s.stage)
        && (s.stage === 'adult' ? ['good', 'scruffy'].includes(s.form) : s.form === null)
        && time(s.hatchAt) && (s.bornAt === null || time(s.bornAt)) && time(s.at) && time(s.napUntil)
        && int(s.hunger, 0, NEEDS_MAX) && int(s.happy, 0, NEEDS_MAX) && int(s.weight, 0, 999) && int(s.mess, 0, MESS_MAX)
        && typeof s.sick === 'boolean' && int(s.doses, 0, 3) && typeof s.sleepy === 'boolean' && typeof s.lightsOff === 'boolean'
        && int(s.gamesInRow, 0, 1000) && (s.snackDate === '' || DATE.test(s.snackDate)) && int(s.snacks, 0, SNACKS_PER_DAY)
        && Array.isArray(s.caredDates) && s.caredDates.length <= 60 && s.caredDates.every(d => DATE.test(d))
        && int(s.mistakes, 0, 100000) && optionalDate(s.wakeDate)
        && exact(s.timers, TIMERS) && TIMERS.every(key => int(s.timers[key], 0, 100000)) && Array.isArray(s.events) && s.events.length === 0;
}

function validGift(view) {
    if (Object.hasOwn(view, 'visit')) {
        const v = view.visit;
        check(exact(v, ['date', 'welcomeBack', 'gains']) && v.date === view.aucklandDate && typeof v.welcomeBack === 'boolean'
            && exact(v.gains, ['hunger', 'happy']) && int(v.gains.hunger, 0, 1) && int(v.gains.happy, 0, 1)
            && (v.welcomeBack || v.gains.hunger + v.gains.happy <= 1));
    }
    if (Object.hasOwn(view, 'cheer')) check(exact(view.cheer, ['date', 'gain']) && view.cheer.date === view.aucklandDate && int(view.cheer.gain, 0, 1));
}

export function validatePocketView(view, uid) {
    const base = ['schemaVersion', 'kind', 'ownerUid', 'enabled', 'serverNowMs', 'aucklandDate', 'aucklandHour', 'aucklandMinute', 'prices', 'wallet', 'pal'];
    check(plain(view) && base.every(key => Object.hasOwn(view, key)) && Object.keys(view).every(key => base.includes(key) || key === 'visit' || key === 'cheer'));
    check(view.schemaVersion === 1 && view.kind === 'pocket' && view.ownerUid === uid && typeof view.enabled === 'boolean' && time(view.serverNowMs)
        && DATE.test(view.aucklandDate) && int(view.aucklandHour, 0, 23) && int(view.aucklandMinute, 0, 59)
        && exact(view.prices, ['snack', 'adoption']) && int(view.prices.snack, 1, 100) && int(view.prices.adoption, 1, 100));
    check(view.wallet?.available === false ? exact(view.wallet, ['available'])
        : exact(view.wallet, ['available', 'balance']) && view.wallet.available === true && Number.isFinite(view.wallet.balance) && view.wallet.balance >= 0);
    if (view.pal !== null) {
        const p = view.pal;
        check(exact(p, ['name', 'species', 'casing', 'color', 'reducedMotion', 'state', 'game']) && typeof p.name === 'string' && SPECIES.includes(p.species)
            && CASES.includes(p.casing) && /^#[0-9a-f]{6}$/u.test(p.color) && typeof p.reducedMotion === 'boolean'
            && validPalState(p.state) && p.state.name === p.name && p.state.species === p.species
            && (p.game === null || (exact(p.game, ['id', 'results']) && ID.test(p.game.id) && Array.isArray(p.game.results)
                && p.game.results.length < GAME_ROUNDS && p.game.results.every(r => typeof r === 'boolean'))));
    } else check(!Object.hasOwn(view, 'visit') && !Object.hasOwn(view, 'cheer'));
    validGift(view);
    return view;
}

const OUTCOME_KEYS = ['action', 'ok', 'reason', 'animation', 'amount', 'walletBefore', 'walletAfter'];
export function validateActReply(reply, uid, request) {
    check(exact(reply, ['outcome', 'duplicate', 'view']) && typeof reply.duplicate === 'boolean');
    const o = reply.outcome;
    check(plain(o) && OUTCOME_KEYS.every(key => Object.hasOwn(o, key))
        && Object.keys(o).every(key => OUTCOME_KEYS.includes(key) || key === 'game' || key === 'category')
        && o.action === request.action && typeof o.ok === 'boolean' && (o.reason === null || typeof o.reason === 'string')
        && typeof o.animation === 'string' && int(o.amount, 0, 100) && (o.amount === 0 ? o.walletBefore === null && o.walletAfter === null
            : o.category === 'pet_spend' && o.walletBefore - o.walletAfter === o.amount));
    if (Object.hasOwn(o, 'game')) {
        const g = o.game;
        check(request.action === 'guess' && exact(g, ['gameId', 'round', 'choice', 'target', 'correct', 'wins', 'complete'])
            && g.gameId === request.gameId && g.round === request.round && g.choice === request.choice && ['left', 'right'].includes(g.target)
            && g.correct === (g.choice === g.target) && int(g.wins, 0, GAME_ROUNDS) && g.complete === (g.round === GAME_ROUNDS - 1));
    }
    validatePocketView(reply.view, uid);
    check(!Object.hasOwn(reply.view, 'visit') && !Object.hasOwn(reply.view, 'cheer'));
    return reply;
}

// POST to the callable endpoints with the signed-in user's token.
export function createPocketTransport({ projectId, getCurrentUser, fetchImpl = (...args) => fetch(...args), timeoutMs = 15000 }) {
    const failure = reason => Object.assign(new Error('Your pal could not be reached.'), { details: { reason } });
    async function call(name, data, expectedUid) {
        const user = getCurrentUser();
        if (!user || user.isAnonymous !== false || user.uid !== expectedUid) throw failure('UNAUTHENTICATED');
        if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(projectId)) throw failure('UNAVAILABLE');
        const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), timeoutMs);
        try {
            const token = await user.getIdToken();
            if (getCurrentUser() !== user) throw failure('UNAUTHENTICATED');
            const response = await fetchImpl(`https://us-central1-${projectId}.cloudfunctions.net/${name}`, {
                method: 'POST', redirect: 'error', signal: abort.signal,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data }),
            });
            const body = await response.json();
            if (getCurrentUser() !== user) throw failure('UNAUTHENTICATED');
            if (plain(body?.error)) {
                const reason = body.error.details?.reason;
                throw failure(REASONS.includes(reason) ? reason : 'UNAVAILABLE');
            }
            if (!response.ok || !exact(body, ['result'])) throw failure('UNAVAILABLE');
            return body.result;
        } catch (error) {
            throw error?.details?.reason ? error : failure('UNAVAILABLE');
        } finally { clearTimeout(timer); }
    }
    return {
        read: async uid => validatePocketView(await call(NAMES.read, { pocket: 1 }, uid), uid),
        act: async (uid, request) => {
            const data = { pocket: 1, ...request };
            if (!ID.test(data.operationId || '')) throw failure('UNAVAILABLE');
            return validateActReply(await call(NAMES.act, data, uid), uid, request);
        },
    };
}
