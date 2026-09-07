import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { arcadeOutcome, trainingOutcome, awardGameTransaction, munchTransaction } from './gameCompatibility.js';
import { assertWalletSession, walletErrorMessage } from './walletCompatibility.js';

const pub = 'artifacts/test/public/data/users/Alice';
const priv = 'artifacts/test/users/a/profile/data';
const today = new Date().toDateString();
const gate = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { resolve, promise }; };
class Db {
    constructor() {
        this.values = new Map([[pub, { uid: 'a', claimed: true, balance: 30.5, bank_balance: 100, lifetime_received: 50, lifetime_given: 9, extra: { keep: true } }],
            [priv, { balance: 30.5, bank_balance: 100, typing_license: true, given_today: 3, extra: { keep: true } }]]);
        this.version = 0; this.conflicts = 0; this.failAt = 0;
    }
    async run(callback) {
        for (let i = 0; i < 15; i += 1) {
            const version = this.version; const data = structuredClone(this.values); const writes = new Map(); let n = 0;
            const set = (path, value) => { if (++n === this.failAt) throw new Error('FAIL_WRITE'); writes.set(path, value); };
            const result = await callback({
                get: async (path) => { assert.equal(writes.size, 0); return { exists: () => data.has(path), data: () => {
                    const value = data.get(path);
                    return value && Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v?.stamp ? { toDate: () => new Date(v.stamp) } : v]));
                } }; },
                update: (path, patch) => set(path, { ...data.get(path), ...patch }), set,
            });
            if (version !== this.version) { this.conflicts += 1; continue; }
            for (const [path, value] of writes) this.values.set(path, value);
            if (writes.size) this.version += 1;
            return result;
        }
        throw new Error('RETRY_EXHAUSTED');
    }
}
function actual(name, db, overrides = {}) {
    const s = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const end = { handleWinBonus: 'CORE_VALUES', handleTrainingReward: 'handleUpdateLicense', handleMunchDonut: 'handleReaction' }[name];
    const code = `const ${name} =${s.split(`const ${name} =`)[1].split(`const ${end} =`)[0]}`;
    let serial = 0; const notices = [];
    const env = { db, APP_ID: 'test', user: { uid: 'a' }, myProfile: { name: 'Alice', typing_license: false }, isAdmin: true, isSandbox: false,
        auth: { currentUser: { uid: 'a', isAnonymous: false } },
        doc: (...args) => args.length === 1 ? `${args[0]}/receipt-${++serial}` : args.slice(1).join('/'),
        collection: (...args) => args.slice(1).join('/'), runTransaction: (_db, callback) => db.run(callback),
        serverTimestamp: () => ({ stamp: today }), showNotification: (message) => notices.push(message), triggerConfetti: () => {}, setView: () => {},
        arcadeOutcome, trainingOutcome, awardGameTransaction, munchTransaction, assertWalletSession, walletErrorMessage,
        console: { error: () => {} }, ...overrides };
    return { env, notices, handler: new Function('env', `const {${Object.keys(env).join(',')}}=env; ${code};return ${name};`)(env) };
}
const prize = { type: 'donut', amount: 1, label: 'Glazed Donut' };
const feeds = (db) => [...db.values].filter(([p]) => p.includes('/transactions/')).map(([, v]) => v);

test('actual arcade credits equal mirrors and lifetime atomically, writes amount and refuses second daily win', async () => {
    const db = new Db(); const before = structuredClone(db.values); const a = actual('handleWinBonus', db);
    await a.handler(prize); await a.handler(prize);
    assert.deepEqual(db.values.get(pub), { ...before.get(pub), balance: 31.5, lifetime_received: 51 });
    assert.deepEqual(db.values.get(priv), { ...before.get(priv), balance: 31.5, last_daily_bonus: { stamp: today } });
    assert.equal(feeds(db).length, 1); assert.equal(feeds(db)[0].amount, 1);
    assert.match(a.notices.at(-1), /Daily Limit/u);
});

test('arcade allowlist matches supported prizes, rejects arbitrary cooldown/type/amount and corrupt timestamp', () => {
    const options = { prize, cooldownField: 'last_daily_bonus', gameName: 'the Claw Machine', today, timestamp: () => ({ stamp: today }) };
    for (const [field, name, amounts] of [['last_daily_bonus', 'the Claw Machine', [1, 5]], ['last_typing_defence_win', 'Typing Defence', [1, 7]],
        ['last_wordle_win', 'The Daily Rushes', [1]], ['last_cable_commander_win', 'Cable Commander', [1, 2]], ['last_memory_match_win', 'Memory Match', [1, 2]]]) {
        for (const amount of amounts) assert.equal(arcadeOutcome({}, { ...options, cooldownField: field, gameName: name, prize: { ...prize, amount } }).amount, amount);
    }
    assert.equal(arcadeOutcome({}, { ...options, prize: { type: 'item', id: 'golden_ticket', label: 'Ticket' } }).amount, 10);
    for (const patch of [{ cooldownField: 'balance' }, { cooldownField: null }, { gameName: 'Other' }, { prize: { ...prize, amount: 999 } },
        { prize: { ...prize, type: 'other' } }, { prize: { ...prize, amount: -1 } }]) assert.throws(() => arcadeOutcome({}, { ...options, ...patch }));
    assert.throws(() => arcadeOutcome({ last_daily_bonus: 'bad' }, options));
    const future = new Date(); future.setDate(future.getDate() + 1);
    assert.equal(arcadeOutcome({ last_daily_bonus: { toDate: () => future } }, options).amount, 1, 'legacy rule blocks only same date, not future dates');
});

test('actual training reads saved license/reward state, grants tiers, one first jackpot then respects cap', async () => {
    const db = new Db(); const a = actual('handleTrainingReward', db);
    await a.handler(95, 100, 10, 'perfectionist_badge', 'sudden_death');
    assert.equal(db.values.get(pub).balance, 40.5); assert.equal(db.values.get(priv).training_earned_today, 10);
    for (const field of ['silver_border', 'gold_border', 'flame_name', 'sudden_death_won', 'perfectionist_badge']) assert.equal(db.values.get(priv)[field], true);
    await a.handler(40, 100, 1, null, 'scriptwriter');
    assert.equal(feeds(db).length, 1); assert.equal(feeds(db)[0].amount, 10);
    assert.equal(db.values.get(priv).given_today, 3);
    assert.match(a.notices.at(-1), /Cap/u);
    db.values.get(priv).typing_license = false;
    await a.handler(40, 100, 1, null, 'scriptwriter');
    assert.match(a.notices.at(-1), /license/u);
});

test('training known modes, ninja tiers, subsequent sudden reward and unsafe badges/counters are validated', () => {
    const o = { wpm: 40, accuracy: 100, rewardAmount: 1, badgeToGrant: null, mode: 'scriptwriter', ninjaCombo: 0, today };
    const data = { typing_license: true };
    assert.equal(trainingOutcome(data, o).amount, 1);
    assert.equal(trainingOutcome(data, { ...o, mode: 'shortcut_ninja', wpm: 0, accuracy: 0, ninjaCombo: 20 }).amount, 2);
    assert.equal(trainingOutcome({ ...data, sudden_death_won: true }, { ...o, mode: 'sudden_death' }).amount, 2);
    for (const patch of [{ mode: 'arbitrary' }, { badgeToGrant: 'balance' }, { rewardAmount: 100 }, { accuracy: NaN }, { wpm: 10 }]) assert.throws(() => trainingOutcome(data, { ...o, ...patch }));
    assert.throws(() => trainingOutcome({ ...data, training_earned_today: '2' }, o));
    assert.throws(() => trainingOutcome({ ...data, sudden_death_won: null }, o));
});

test('actual munch matches teacher UI, retains anonymity, wallet-first/whole-bank and unclaimed-only updates', async () => {
    for (const claimed of [true, false]) {
        const db = new Db(); const a = actual('handleMunchDonut', db, { myProfile: { name: 'Mr Rayner' } });
        if (!claimed) { db.values.get(pub).claimed = false; delete db.values.get(pub).uid; db.values.delete(priv); }
        await a.handler('Alice', 'reason', 5);
        assert.equal(db.values.get(pub).balance, 25.5); assert.equal(db.values.get(pub).bank_balance, 100);
        db.values.get(pub).balance = 1;
        if (claimed) db.values.get(priv).balance = 1;
        await a.handler('Alice', 'reason', 5);
        assert.equal(db.values.get(pub).balance, 1); assert.equal(db.values.get(pub).bank_balance, 95);
        if (claimed) assert.equal(db.values.get(priv).bank_balance, 95);
        assert.ok(feeds(db).every((f) => f.toName === 'Someone' && f.amount === 5 && !Object.hasOwn(f, 'uid')));
    }
    const db = new Db(); const before = structuredClone(db.values);
    await actual('handleMunchDonut', db, { isAdmin: false }).handler('Alice', 'reason', 5);
    assert.deepEqual(db.values, before);
});

test('actual writers fail closed on missing/conflicting/UID records, sandbox and every staged-write failure', async () => {
    for (const name of ['handleWinBonus', 'handleTrainingReward', 'handleMunchDonut']) {
        const invoke = (a) => name === 'handleWinBonus' ? a.handler(prize) : name === 'handleTrainingReward' ? a.handler(40, 100) : a.handler('Alice', 'reason', 1);
        for (const mutation of [
            (db) => db.values.delete(priv), (db) => { db.values.get(priv).balance = 0; },
            (db) => { db.values.get(pub).uid = 'b'; }, (db) => { db.values.get(pub).balance = null; },
            ...[1, 2, 3].map((n) => (db) => { db.failAt = n; }),
        ]) {
            const db = new Db(); mutation(db); const before = structuredClone(db.values);
            await invoke(actual(name, db, { myProfile: { name: name === 'handleMunchDonut' ? 'Mr Rayner' : 'Alice' } }));
            assert.deepEqual(db.values, before, name);
        }
        const db = new Db(); db.run = () => { throw new Error('NO_READS'); };
        await invoke(actual(name, db, { isSandbox: true }));
    }
});

test('deterministic concurrent arcade and training wins retry cooldowns/caps without duplicate credit', async () => {
    for (const kind of ['arcade', 'jackpot', 'cap']) {
        const db = new Db(); const run = db.run.bind(db); const ready = gate(); let count = 0;
        if (kind === 'cap') Object.assign(db.values.get(priv), { training_earned_today: 2, training_last_earned_date: today });
        db.run = (callback) => run((t) => callback({ ...t, get: async (path) => {
            const result = await t.get(path);
            if (path === priv && count < 2) { if (++count === 2) ready.resolve(); await ready.promise; }
            return result;
        } }));
        const a = actual(kind === 'arcade' ? 'handleWinBonus' : 'handleTrainingReward', db);
        const invoke = (second) => kind === 'arcade' ? a.handler(prize) : kind === 'jackpot'
            ? a.handler(50, 100, 10, 'perfectionist_badge', 'sudden_death')
            : a.handler(40, 100, 1, null, second ? 'shortcut_ninja' : 'scriptwriter', 1);
        await Promise.all([invoke(false), invoke(true)]);
        assert.ok(db.conflicts > 0); assert.equal(feeds(db).length, 1);
        assert.equal(db.values.get(pub).balance, kind === 'jackpot' ? 40.5 : 31.5);
    }
});

test('reward overlaps debit deterministically and preserves both changes', async () => {
    const db = new Db(); const run = db.run.bind(db); const ready = gate(); const release = gate();
    db.run = (callback) => run((t) => callback({ ...t, get: async (path) => {
        const result = await t.get(path); if (path === priv) { ready.resolve(); await release.promise; } return result;
    } }));
    const pending = actual('handleWinBonus', db).handler(prize);
    await ready.promise;
    await run(async (t) => { await t.get(pub); await t.get(priv); t.update(pub, { balance: 28.5 }); t.update(priv, { balance: 28.5 }); });
    release.resolve(); await pending;
    assert.ok(db.conflicts > 0); assert.equal(db.values.get(pub).balance, 29.5); assert.equal(db.values.get(priv).balance, 29.5);
});

test('actual game and munch auth switches after reads abort all writes', async () => {
    for (const name of ['handleWinBonus', 'handleTrainingReward', 'handleMunchDonut']) {
        const db = new Db(); const before = structuredClone(db.values); const run = db.run.bind(db);
        const a = actual(name, db, { myProfile: { name: name === 'handleMunchDonut' ? 'Mr Rayner' : 'Alice' } });
        db.run = (callback) => run((t) => callback({ ...t, get: async (path) => {
            const result = await t.get(path); if (path === priv) a.env.auth.currentUser = null; return result;
        } }));
        if (name === 'handleWinBonus') await a.handler(prize);
        else if (name === 'handleTrainingReward') await a.handler(40, 100);
        else await a.handler('Alice', 'reason', 1);
        assert.deepEqual(db.values, before); assert.match(a.notices.at(-1), /sign in again/u);
    }
});

test('munch refuses conflicting banks, corrupt claimstate and combined-but-insufficient separate sources', async () => {
    for (const mutate of [
        (db) => { db.values.get(priv).bank_balance = 99; },
        (db) => { db.values.get(pub).claimed = 'true'; },
        (db) => { db.values.get(pub).claimed = false; },
        (db) => { db.values.get(pub).ownerUid = 'a'; },
        (db) => { for (const path of [pub, priv]) Object.assign(db.values.get(path), { balance: 3, bank_balance: 3 }); },
    ]) {
        const db = new Db(); mutate(db); const before = structuredClone(db.values);
        await actual('handleMunchDonut', db, { myProfile: { name: 'Mr Rayner' } }).handler('Alice', 'reason', 5);
        assert.deepEqual(db.values, before);
    }
});
