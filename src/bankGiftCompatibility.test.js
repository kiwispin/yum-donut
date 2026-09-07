import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { bankTransferFields, giveDonutsTransaction } from './bankGiftCompatibility.js';
import { assertWalletSession, walletErrorMessage } from './walletCompatibility.js';
import { getBankBalance } from './bankBalance.js';

class Db {
    constructor() { this.values = new Map(); this.version = 0; this.conflicts = 0; this.failAt = 0; }
    async run(callback) {
        for (let attempt = 0; attempt < 15; attempt += 1) {
            const version = this.version;
            const data = structuredClone(this.values);
            const writes = new Map();
            let count = 0;
            const stage = (path, value) => { if (++count === this.failAt) throw new Error('WRITE_FAILURE'); writes.set(path, value); };
            const result = await callback({
                get: async (path) => { assert.equal(writes.size, 0, 'read after write'); return { exists: () => data.has(path), data: () => data.get(path) }; },
                update: (path, patch) => { assert.ok(data.has(path)); stage(path, { ...data.get(path), ...patch }); },
                set: stage,
            });
            if (version !== this.version) { this.conflicts += 1; continue; }
            for (const [path, value] of writes) this.values.set(path, value);
            if (writes.size) this.version += 1;
            return result;
        }
        throw new Error('RETRY_EXHAUSTED');
    }
}
const root = 'artifacts/test/public/data';
const pub = (name) => `${root}/users/${name}`;
const priv = (uid) => `artifacts/test/users/${uid}/profile/data`;
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { resolve, promise }; };
function fixture() {
    const db = new Db();
    for (const [name, uid] of [['Alice', 'a'], ['Bob', 'b'], ['Mr Rayner', 'teacher']]) {
        db.values.set(pub(name), { name, uid, claimed: true, balance: 30.5, bank_balance: 100.25,
            lifetime_given: 9, lifetime_received: 80, opaque: { keep: true } });
        db.values.set(priv(uid), { name, balance: 30.5, bank_balance: 100.25, given_today: 1,
            last_given_date: new Date().toDateString(), opaque: { keep: true } });
    }
    db.values.set(pub('Unclaimed'), { name: 'Unclaimed', claimed: false, balance: 7, lifetime_received: 9, bank_balance: 3 });
    return { db };
}
function actual(name, f, overrides = {}) {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const end = { handleDeposit: 'const handleWithdraw', handleWithdraw: 'const handlePayInterest', handleGiveDonut: 'const handleMunchDonut' }[name];
    const code = `const ${name} = async${source.split(`const ${name} = async`)[1].split(end)[0]}`;
    const notices = []; let serial = 0;
    const env = { db: f.db, APP_ID: 'test', isSandbox: false, user: { uid: 'a' }, myProfile: { ...f.db.values.get(priv('a')) },
        auth: { currentUser: { uid: 'a', isAnonymous: false } }, roster: ['Alice', 'Bob', 'Unclaimed', 'Fresh'], DAILY_LIMIT: 5, EMOJI: 'D',
        showNotification: (message) => notices.push(message), triggerConfetti: () => {}, setView: () => {},
        doc: (...args) => args.length === 1 ? `${args[0]}/receipt-${name}-${++serial}` : args.slice(1).join('/'),
        collection: (...args) => args.slice(1).join('/'), runTransaction: (_db, callback) => f.db.run(callback),
        serverTimestamp: () => 'TIME', assertWalletSession, walletErrorMessage, getBankBalance, bankTransferFields, giveDonutsTransaction,
        isValidDonutAmount: (n) => Number.isInteger(n) && n > 0,
        getDonutBalance: (n, fallback) => Number.isFinite(n) && n >= 0 ? n : fallback,
        console: { error: () => {} }, ...overrides };
    return { env, notices, handler: new Function('env', `const {${Object.keys(env).join(',')}} = env; ${code}; return ${name};`)(env) };
}

test('actual bank transfers conserve fractional wallet+savings, receipt amounts and all unrelated fields', async () => {
    const f = fixture(); const before = structuredClone(f.db.values);
    await actual('handleDeposit', f).handler(3);
    for (const path of [pub('Alice'), priv('a')]) assert.deepEqual(f.db.values.get(path), { ...before.get(path), balance: 27.5, bank_balance: 103.25 });
    await actual('handleWithdraw', f).handler(3);
    for (const path of [pub('Alice'), priv('a')]) assert.deepEqual(f.db.values.get(path), before.get(path));
    const receipts = [...f.db.values].filter(([path]) => path.includes('/transactions/'));
    assert.equal(receipts.length, 2); assert.ok(receipts.every(([, receipt]) => receipt.amount === 3));
});

test('bank absent savings policy, ownership/equality, insufficient funds, invalid inputs and overflow guards', () => {
    const f = fixture(); const a = f.db.values.get(pub('Alice')); const b = f.db.values.get(priv('a'));
    assert.deepEqual(bankTransferFields({ ...a, bank_balance: undefined }, b, 'a', 1, 'deposit'), { balance: 29.5, bank_balance: 101.25 });
    for (const [p, q] of [[{ ...a, uid: 'b' }, b], [a, { ...b, balance: 1 }], [a, { ...b, bank_balance: null }],
        [{ ...a, bank_balance: Number.MAX_SAFE_INTEGER }, { ...b, bank_balance: Number.MAX_SAFE_INTEGER }],
        [{ ...a, ownerUid: 'a' }, b]]) assert.throws(() => bankTransferFields(p, q, 'a', 1, 'deposit'));
    for (const amount of [0, -1, 1.5, Infinity, 31]) assert.throws(() => bankTransferFields(a, b, 'a', amount, 'deposit'));
    assert.throws(() => bankTransferFields(a, b, 'a', 101, 'withdraw'));
});

test('actual gift deduplicates names, credits claimed and unclaimed, creates only a missing roster record; sender wallet unchanged', async () => {
    const f = fixture(); const before = structuredClone(f.db.values);
    await actual('handleGiveDonut', f).handler(['Bob', 'Bob', 'Unclaimed', 'Fresh'], 'Thanks', 1, 'CARE', 'Kind');
    assert.deepEqual(f.db.values.get(priv('a')), { ...before.get(priv('a')), given_today: 4 });
    assert.deepEqual(f.db.values.get(pub('Alice')), { ...before.get(pub('Alice')), lifetime_given: 12 });
    assert.deepEqual(f.db.values.get(priv('b')), { ...before.get(priv('b')), balance: 31.5 });
    assert.deepEqual(f.db.values.get(pub('Bob')), { ...before.get(pub('Bob')), balance: 31.5, lifetime_received: 81 });
    assert.deepEqual(f.db.values.get(pub('Unclaimed')), { ...before.get(pub('Unclaimed')), balance: 8, lifetime_received: 10 });
    assert.equal(f.db.values.get(pub('Fresh')).balance, 1); assert.equal(f.db.values.get(pub('Fresh')).claimed, false);
    const receipts = [...f.db.values].filter(([path]) => path.includes('/transactions/'));
    assert.equal(receipts.length, 3);
    for (const [, receipt] of receipts) { assert.equal(receipt.amount, 1); assert.equal(receipt.value, 'CARE'); assert.equal(receipt.virtue, 'Kind'); }
});

test('actual gift missing roster fails cleanly; corrupt existing, missing claimed private, ambiguous claimstate and UID aliases never write', async () => {
    const cases = [
        { targets: ['Fresh'], options: { roster: undefined } },
        { targets: ['OutsideRoster'] },
        { mutate: (f) => f.db.values.delete(priv('b')) },
        { mutate: (f) => { f.db.values.get(pub('Bob')).balance = null; } },
        { mutate: (f) => { f.db.values.get(pub('Bob')).balance = '30'; } },
        { mutate: (f) => { f.db.values.get(pub('Bob')).lifetime_received = null; } },
        { mutate: (f) => { f.db.values.get(pub('Bob')).lifetime_received = Infinity; } },
        { mutate: (f) => { f.db.values.get(priv('b')).balance = 0; } },
        { mutate: (f) => { f.db.values.get(pub('Bob')).uid = 'a'; } },
        { mutate: (f) => { f.db.values.get(pub('Bob')).claimed = false; } },
        { mutate: (f) => { f.db.values.get(pub('Bob')).claimed = 'true'; } },
        { mutate: (f) => { delete f.db.values.get(pub('Bob')).uid; } },
        { mutate: (f) => { f.db.values.get(pub('Bob')).ownerUid = 'b'; } },
        { mutate: (f) => f.db.values.set(pub('Alias'), { ...f.db.values.get(pub('Bob')), name: 'Alias' }), targets: ['Bob', 'Alias'] },
    ];
    for (const c of cases) {
        const f = fixture(); c.mutate?.(f); const before = structuredClone(f.db.values);
        await actual('handleGiveDonut', f, c.options).handler(c.targets || ['Bob'], 'Thanks');
        assert.deepEqual(f.db.values, before);
    }
});

test('gift allowance counters permit missing legacy values, reject explicit corruption and preserve admin exemption', async () => {
    for (const value of [undefined, null, '1', NaN, -1]) {
        const f = fixture(); f.db.values.get(priv('a')).given_today = value;
        const before = structuredClone(f.db.values);
        await actual('handleGiveDonut', f).handler(['Bob'], 'Thanks');
        if (value === undefined) assert.equal(f.db.values.get(priv('a')).given_today, 1);
        else assert.deepEqual(f.db.values, before);
    }
    const f = fixture(); f.db.values.get(priv('a')).given_today = 5;
    const before = structuredClone(f.db.values);
    await actual('handleGiveDonut', f).handler(['Bob'], 'Thanks'); assert.deepEqual(f.db.values, before);
    f.db.values.get(priv('a')).last_given_date = 'yesterday';
    await actual('handleGiveDonut', f).handler(['Bob'], 'Thanks'); assert.equal(f.db.values.get(priv('a')).given_today, 1);
    const admin = actual('handleGiveDonut', f, { user: { uid: 'teacher' }, myProfile: { name: 'Mr Rayner' }, auth: { currentUser: { uid: 'teacher' } } });
    await admin.handler(['Bob'], 'Thanks', 10);
    assert.equal(f.db.values.get(priv('teacher')).given_today, 11);
    assert.equal(f.db.values.get(priv('teacher')).balance, 30.5);
});

test('actual bank/gift staged-write failures roll back all balances, counters and receipts', async () => {
    for (const name of ['handleDeposit', 'handleWithdraw', 'handleGiveDonut']) {
        const writes = name === 'handleGiveDonut' ? 5 : 3;
        for (let failAt = 1; failAt <= writes; failAt += 1) {
            const f = fixture(); f.db.failAt = failAt; const before = structuredClone(f.db.values);
            await actual(name, f).handler(name === 'handleGiveDonut' ? ['Bob'] : 1, 'Thanks');
            assert.deepEqual(f.db.values, before);
        }
    }
});

test('actual bank/gift sandbox avoids reads and auth switching after reads prevents writes', async () => {
    for (const name of ['handleDeposit', 'handleWithdraw', 'handleGiveDonut']) {
        const f = fixture(); const before = structuredClone(f.db.values);
        const run = f.db.run.bind(f.db);
        f.db.run = () => { throw new Error('SANDBOX_MUST_NOT_READ'); };
        await actual(name, f, { isSandbox: true }).handler(name === 'handleGiveDonut' ? ['Bob'] : 1, 'Thanks');
        assert.deepEqual(f.db.values, before);
        const action = actual(name, f);
        f.db.run = (callback) => run((t) => callback({ ...t, get: async (path) => {
            const result = await t.get(path); action.env.auth.currentUser = { uid: 'other' }; return result;
        } }));
        await action.handler(name === 'handleGiveDonut' ? ['Bob'] : 1, 'Thanks');
        assert.deepEqual(f.db.values, before);
    }
});

test('deterministic gift and recipient bank/debit overlap retries without losing credits or allowance counts', async () => {
    for (const operation of ['bank', 'debit']) {
        const f = fixture(); const ready = deferred(); const release = deferred();
        const run = f.db.run.bind(f.db);
        f.db.run = (callback) => run((t) => callback({ ...t, get: async (path) => {
            const result = await t.get(path);
            if (path === priv('b')) { ready.resolve(); await release.promise; }
            return result;
        } }));
        const gift = actual('handleGiveDonut', f).handler(['Bob'], 'Thanks', 2);
        await ready.promise;
        // Competing transaction uses the same mirrors, with an explicit commit barrier.
        if (operation === 'bank') {
            await actual('handleDeposit', { db: { values: f.db.values, run } }, {
                user: { uid: 'b' }, auth: { currentUser: { uid: 'b' } }, myProfile: { ...f.db.values.get(priv('b')) },
            }).handler(3);
        } else await run(async (t) => {
            const a = (await t.get(pub('Bob'))).data(); await t.get(priv('b'));
            t.update(pub('Bob'), { balance: a.balance - 3 }); t.update(priv('b'), { balance: a.balance - 3 });
        });
        release.resolve(); await gift;
        assert.ok(f.db.conflicts > 0); assert.equal(f.db.values.get(pub('Bob')).balance, 29.5);
        assert.equal(f.db.values.get(priv('b')).balance, 29.5);
        assert.equal(f.db.values.get(priv('a')).given_today, 3);
        assert.equal(f.db.values.get(priv('b')).bank_balance, operation === 'bank' ? 103.25 : 100.25);
    }
});

test('two overlapping actual gifts recheck daily allowance on retry and cannot overspend it', async () => {
    const f = fixture(); const gate = deferred(); let arrivals = 0;
    const run = f.db.run.bind(f.db);
    f.db.run = (callback) => run((t) => callback({ ...t, get: async (path) => {
        const result = await t.get(path);
        if (path === priv('b') && arrivals < 2) { if (++arrivals === 2) gate.resolve(); await gate.promise; }
        return result;
    } }));
    const action = actual('handleGiveDonut', f);
    await Promise.all([action.handler(['Bob'], 'Thanks', 3), action.handler(['Bob'], 'Thanks', 3)]);
    assert.ok(f.db.conflicts > 0);
    assert.equal(f.db.values.get(priv('a')).given_today, 4);
    assert.equal(f.db.values.get(pub('Alice')).lifetime_given, 12);
    assert.equal(f.db.values.get(priv('a')).balance, 30.5);
    assert.equal(f.db.values.get(priv('b')).balance, 33.5);
    assert.equal([...f.db.values.keys()].filter((path) => path.includes('/transactions/')).length, 1);
    assert.match(action.notices.join(' '), /exceeds your daily allowance/u);
});
