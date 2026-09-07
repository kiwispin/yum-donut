import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assertWalletSession, readWalletMirrors, reconcileLegacyWallet, validateWalletMirrors, walletBalanceAfterDebit, walletErrorMessage } from './walletCompatibility.js';

// Optimistic test transaction: explicit barriers force overlap; all reads precede writes.
class WalletDb {
    constructor() {
        this.data = new Map([
            ['public', { uid: 'a', claimed: true, name: 'Same', balance: 30.5, bank_balance: 100, lifetime_given: 7 }],
            ['private', { name: 'Same', balance: 30.5, bank_balance: 100, given_today: 2 }],
        ]);
        this.version = 0;
        this.conflicts = 0;
    }
    async run(callback) {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const version = this.version;
            const values = structuredClone(this.data);
            const writes = new Map();
            let writeCount = 0;
            const stage = (path, value) => {
                writeCount += 1;
                if (writeCount === this.failWriteAt) throw new Error('STAGING_FAILURE');
                writes.set(path, value);
            };
            const transaction = {
                get: async (path) => {
                    assert.equal(writes.size, 0, 'reads before writes');
                    return { exists: () => values.has(path), data: () => values.get(path) };
                },
                update: (path, fields) => {
                    const current = writes.get(path) || values.get(path);
                    const resolved = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key,
                        value?.incrementBy !== undefined ? (current[key] || 0) + value.incrementBy : value]));
                    stage(path, { ...current, ...resolved });
                },
                set: stage,
            };
            await callback(transaction);
            if (version !== this.version) { this.conflicts += 1; continue; }
            for (const [path, value] of writes) this.data.set(path, value);
            if (writes.size) this.version += 1;
            return;
        }
        throw new Error('RETRIES_EXHAUSTED');
    }
}
const options = { publicRef: 'public', privateRef: 'private', uid: 'a', isActive: () => true };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

async function debit(db, amount) {
    return db.run(async (transaction) => {
        const wallet = await readWalletMirrors(transaction, options);
        const balance = walletBalanceAfterDebit(wallet.balance, amount);
        assertWalletSession(options.isActive);
        transaction.update('public', { balance });
        transaction.update('private', { balance });
    });
}

test('legacy linkage permits absent private UID and fractions; protected or spending conflicts refuse', () => {
    const db = new WalletDb();
    const a = db.data.get('public');
    const b = db.data.get('private');
    assert.equal(validateWalletMirrors(a, b, 'a').balance, 30.5);
    assert.equal(walletBalanceAfterDebit(30.5, 2.25), 28.25);
    assert.equal(validateWalletMirrors(a, { ...b, balance: 5 }, 'a', true).balance, 30.5);
    assert.throws(() => validateWalletMirrors(a, { ...b, balance: 5 }, 'a'), /WALLET_BALANCE_CONFLICT/u);
    assert.throws(() => validateWalletMirrors({ ...a, ownerUid: 'a' }, { ...b, ownerUid: 'a', balance: 5 }, 'a', true), /WALLET_BALANCE_CONFLICT/u);
    assert.equal(validateWalletMirrors({ ...a, ownerUid: 'a' }, { ...b, ownerUid: 'a' }, 'a').balance, 30.5);
});

test('same name is not linkage; missing, corrupt and conflicting owners/balances refuse without default zero', () => {
    const db = new WalletDb();
    const a = db.data.get('public');
    const b = db.data.get('private');
    for (const uid of ['', undefined, 'b']) assert.throws(() => validateWalletMirrors(a, b, uid, true));
    for (const patch of [{ uid: undefined }, { uid: 'b' }, { claimed: false }, { ownerUid: undefined }, { ownerUid: 'b' }, { ownerUid: 'a' }]) {
        assert.throws(() => validateWalletMirrors({ ...a, ...patch }, b, 'a', true));
    }
    for (const patch of [{ uid: 'b' }, { ownerUid: undefined }, { ownerUid: 'b' }, { ownerUid: 'a' }]) {
        assert.throws(() => validateWalletMirrors(a, { ...b, ...patch }, 'a', true));
    }
    for (const balance of [undefined, null, '30', NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => validateWalletMirrors({ ...a, balance }, b, 'a', true));
        assert.throws(() => validateWalletMirrors(a, { ...b, balance }, 'a', true));
    }
    assert.throws(() => validateWalletMirrors(null, b, 'a', true));
    assert.throws(() => validateWalletMirrors(a, null, 'a', true));
});

test('delayed snapshot trigger reads current balances after a debit, never resurrecting event balance', async () => {
    const db = new WalletDb();
    const before = structuredClone(db.data);
    const trigger = () => db.run((transaction) => reconcileLegacyWallet(transaction, options));
    await debit(db, 2);
    await trigger(); // The event could have observed 30.5; it supplies no value.
    for (const path of ['public', 'private']) assert.deepEqual(db.data.get(path), { ...before.get(path), balance: 28.5 });
});

test('sync read overlaps debit via deterministic barrier and retries without restoring spent donuts', async () => {
    const db = new WalletDb();
    const ready = deferred();
    const release = deferred();
    const sync = db.run(async (transaction) => {
        let reads = 0;
        const wrapped = { ...transaction, get: async (path) => {
            const result = await transaction.get(path);
            reads += 1;
            if (reads === 2) { ready.resolve(); await release.promise; }
            return result;
        } };
        await reconcileLegacyWallet(wrapped, options);
    });
    await ready.promise;
    await debit(db, 2);
    release.resolve();
    await sync;
    assert.ok(db.conflicts > 0);
    assert.equal(db.data.get('public').balance, 28.5);
    assert.equal(db.data.get('private').balance, 28.5);
});

test('legacy mismatch copies only current public balance; protected conflict and missing documents write nothing', async () => {
    const db = new WalletDb();
    db.data.get('private').balance = 10;
    const before = structuredClone(db.data);
    await db.run((transaction) => reconcileLegacyWallet(transaction, options));
    assert.deepEqual(db.data.get('private'), { ...before.get('private'), balance: 30.5 });
    assert.deepEqual(db.data.get('public'), before.get('public'));
    db.data.get('public').ownerUid = 'a';
    db.data.get('private').ownerUid = 'a';
    db.data.get('private').balance = 10;
    const protectedBefore = structuredClone(db.data);
    await assert.rejects(db.run((transaction) => reconcileLegacyWallet(transaction, options)), /WALLET_BALANCE_CONFLICT/u);
    assert.deepEqual(db.data, protectedBefore);
    for (const path of ['public', 'private']) {
        const missing = new WalletDb();
        missing.data.delete(path);
        const saved = structuredClone(missing.data);
        await assert.rejects(missing.run((transaction) => reconcileLegacyWallet(transaction, options)), /WALLET_MISSING/u);
        assert.deepEqual(missing.data, saved);
    }
});

test('account switch or cancelled callback during reads aborts sync before writes', async () => {
    for (const change of ['signout', 'switch', 'cancel']) {
        const db = new WalletDb();
        db.data.get('private').balance = 10;
        const before = structuredClone(db.data);
        let activeUid = 'a';
        let cancelled = false;
        const isActive = () => activeUid === 'a' && !cancelled;
        await assert.rejects(db.run(async (transaction) => {
            const wrapped = { ...transaction, get: async (path) => {
                const result = await transaction.get(path);
                if (path === 'private') {
                    activeUid = change === 'signout' ? null : change === 'switch' ? 'b' : 'a';
                    cancelled = change === 'cancel';
                }
                return result;
            } };
            await reconcileLegacyWallet(wrapped, { ...options, isActive });
        }), /WALLET_SESSION_CHANGED/u);
        assert.deepEqual(db.data, before);
    }
});

test('App snapshot and three spending paths use current guarded mirrors with no stale post-transaction write', () => {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const sync = source.split('// === REAL-TIME WALLET SYNC ===')[1].split('// --- DAILY SHOP LIMITS ---')[0];
    assert.ok(sync.includes('reconcileLegacyWallet(transaction, { publicRef, privateRef, uid, isActive })'));
    assert.ok(sync.includes('cancelled = true; unsubSync();'));
    assert.ok(sync.includes('auth.currentUser?.uid === uid'));
    assert.ok(!sync.includes('publicSnap.data()'));
    assert.ok(!sync.includes('updateDoc('));
    for (const [name, end] of [['handleContributeToGoal', '// RESTORED: Admin Goal Controls'], ['handlePurchase', 'const handlePurchaseSponsorship'], ['handlePurchaseSponsorship', 'const handleClearSponsorship']]) {
        const body = source.split(`const ${name} = async`)[1].split(end)[0];
        assert.match(body, /if \(isSandbox\) \{ showNotification\([^\n]+return; \}/u);
        assert.ok(body.includes('auth.currentUser?.uid === uid'));
        assert.ok(body.includes('readWalletMirrors(transaction,'));
        assert.ok(body.includes('transaction.update(privateUserRef, { balance: newBalance })'));
        assert.ok(body.includes('walletBalanceAfterDebit(wallet.balance,'));
        assert.ok(body.lastIndexOf('assertWalletSession(isActive)') < body.indexOf('transaction.update('));
        assert.ok(body.lastIndexOf('assertWalletSession(isActive)') > body.lastIndexOf('await transaction.get('));
        assert.ok(!body.includes('await updateDoc(privateUserRef'));
        assert.ok(!body.includes('balance: myProfile.balance -'));
    }
    assert.ok(source.includes("userDoc.data()[digitalField]) throw new Error('ALREADY_OWNED')"));
});

test('wallet errors explain account, session and funds refusals without hiding the reason', () => {
    for (const code of ['WALLET_OWNER_CONFLICT', 'WALLET_BALANCE_CONFLICT', 'WALLET_MISSING', 'CORRUPT_BALANCE']) {
        assert.match(walletErrorMessage(new Error(code)), /teacher.*No donuts spent/u);
    }
    assert.match(walletErrorMessage(new Error('WALLET_SESSION_CHANGED')), /sign in again/u);
    assert.match(walletErrorMessage(new Error('INSUFFICIENT_FUNDS')), /Not enough donuts/u);
    assert.equal(walletErrorMessage(new Error('OTHER')), null);
});

// Execute the actual scoped App handlers with synthetic dependencies, not copies
// of their spending logic. This complements (not replaces) browser/SDK testing.
function handlerFixture(name, { fail = false, sandbox = false } = {}) {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const endings = { handleContributeToGoal: '// RESTORED: Admin Goal Controls', handlePurchase: 'const handlePurchaseSponsorship', handlePurchaseSponsorship: 'const handleClearSponsorship' };
    const code = `const ${name} = async${source.split(`const ${name} = async`)[1].split(endings[name])[0]}`;
    const db = new WalletDb();
    const publicPath = 'artifacts/test/public/data/users/Same';
    const privatePath = 'artifacts/test/users/a/profile/data';
    db.data.set(publicPath, db.data.get('public'));
    db.data.set(privatePath, db.data.get('private'));
    db.data.delete('public'); db.data.delete('private');
    db.data.set('artifacts/test/public/data/goals/active_goal', { current: 9, contributors: {}, title: 'Goal' });
    if (fail) db.failWriteAt = 2;
    const notices = [];
    let serial = 0;
    const auth = { currentUser: { uid: 'a', isAnonymous: false } };
    const env = {
        db, APP_ID: 'test', auth, user: { uid: 'a' }, isSandbox: sandbox,
        myProfile: { name: 'Same', balance: 30.5 }, users: [],
        getDonutBalance: (value, fallback) => Number.isFinite(value) && value >= 0 ? value : fallback,
        isValidDonutAmount: (amount) => Number.isFinite(amount) && amount > 0,
        showNotification: (message) => notices.push(message), triggerConfetti: () => {},
        doc: (...args) => args.length === 1 ? `${args[0]}/receipt-${++serial}` : args.slice(1).join('/'),
        collection: (...args) => args.slice(1).join('/'), runTransaction: (_db, callback) => db.run(callback),
        increment: (amount) => ({ incrementBy: amount }), serverTimestamp: () => 'SERVER_TIME',
        Timestamp: { fromMillis: (value) => value }, getTimestampMillis: (value) => value,
        getLocalDateKey: () => '2026-09-08', normaliseDailyLimit: (value) => value,
        getShopDailyPurchaseDocId: (...args) => args.join('-'),
        assertWalletSession, readWalletMirrors, walletBalanceAfterDebit, walletErrorMessage,
        console: { error: () => {} },
    };
    const handler = new Function('env', `const { ${Object.keys(env).join(',')} } = env; ${code}; return ${name};`)(env);
    const argument = name === 'handleContributeToGoal' ? 2 : name === 'handlePurchase'
        ? { id: 'rainbow_name', type: 'digital', cost: 2, name: 'Rainbow' }
        : { id: 'slot', cost: 2, durationDays: 3, title: 'Slot', sectionLabel: 'Section' };
    return { db, handler, argument, notices, publicPath, privatePath, auth };
}

test('actual goal/shop/sponsor handlers atomically preserve cost, mirrors, receipt and benefit; rollback stages nothing', async () => {
    for (const name of ['handleContributeToGoal', 'handlePurchase', 'handlePurchaseSponsorship']) {
        for (const fail of [false, true]) {
            const { db, handler, argument, publicPath, privatePath } = handlerFixture(name, { fail });
            const before = structuredClone(db.data);
            await handler(argument);
            if (fail) { assert.deepEqual(db.data, before); continue; }
            assert.equal(db.data.get(publicPath).balance, 28.5);
            assert.deepEqual(db.data.get(privatePath), { ...before.get(privatePath), balance: 28.5 });
            assert.equal(db.data.get(publicPath).bank_balance, 100);
            const receipts = [...db.data].filter(([path]) => path.includes('/transactions/'));
            assert.equal(receipts.length, 1);
            assert.equal(receipts[0][1].amount, 2);
            assert.equal(db.data.get(publicPath).lifetime_given, name === 'handleContributeToGoal' ? 9 : 7);
            if (name === 'handleContributeToGoal') assert.equal(db.data.get('artifacts/test/public/data/goals/active_goal').current, 11);
            if (name === 'handlePurchase') assert.equal(db.data.get(publicPath).rainbow_name, true);
            if (name === 'handlePurchaseSponsorship') assert.equal(db.data.get('artifacts/test/public/data/sponsorships/slot').cost, 2);
        }
    }
});

test('actual spend handlers leave sandbox, wrong UID, missing mirrors, conflicts and insufficient funds unchanged', async () => {
    for (const name of ['handleContributeToGoal', 'handlePurchase', 'handlePurchaseSponsorship']) {
        for (const kind of ['sandbox', 'uid', 'missing', 'conflict', 'funds', 'signout']) {
            const f = handlerFixture(name, { sandbox: kind === 'sandbox' });
            if (kind === 'uid') f.db.data.get(f.publicPath).uid = 'b';
            if (kind === 'missing') f.db.data.delete(f.privatePath);
            if (kind === 'conflict') f.db.data.get(f.privatePath).balance = 20;
            if (kind === 'funds') for (const path of [f.publicPath, f.privatePath]) f.db.data.get(path).balance = 1;
            if (kind === 'signout') f.auth.currentUser = null;
            const before = structuredClone(f.db.data);
            await f.handler(f.argument);
            assert.deepEqual(f.db.data, before, `${name}: ${kind}`);
            assert.match(f.notices.at(-1), /No donuts spent|no donuts spent/u);
        }
    }
});

test('actual handlers retry overlapping mirror reads without lost spending or duplicate owned benefits', async () => {
    for (const name of ['handleContributeToGoal', 'handlePurchase', 'handlePurchaseSponsorship']) {
        const f = handlerFixture(name);
        const run = f.db.run.bind(f.db);
        const barrier = deferred();
        let arrivals = 0;
        f.db.run = (callback) => run((transaction) => callback({ ...transaction, get: async (path) => {
            const result = await transaction.get(path);
            if (path === f.privatePath && arrivals < 2) {
                arrivals += 1;
                if (arrivals === 2) barrier.resolve();
                await barrier.promise;
            }
            return result;
        } }));
        await Promise.all([f.handler(f.argument), f.handler(f.argument)]);
        const count = name === 'handleContributeToGoal' ? 2 : 1;
        assert.ok(f.db.conflicts > 0, name);
        assert.equal(f.db.data.get(f.publicPath).balance, 30.5 - count * 2);
        assert.equal(f.db.data.get(f.privatePath).balance, 30.5 - count * 2);
        assert.equal([...f.db.data.keys()].filter((path) => path.includes('/transactions/')).length, count);
        if (name === 'handleContributeToGoal') assert.equal(f.db.data.get('artifacts/test/public/data/goals/active_goal').current, 13);
    }
});

test('actual handlers recheck auth after extra goal/shop/sponsor reads before any write', async () => {
    for (const name of ['handleContributeToGoal', 'handlePurchase', 'handlePurchaseSponsorship']) {
        const f = handlerFixture(name);
        const before = structuredClone(f.db.data);
        const run = f.db.run.bind(f.db);
        f.db.run = (callback) => run((transaction) => {
            let reads = 0;
            return callback({ ...transaction, get: async (path) => {
                const result = await transaction.get(path);
                reads += 1;
                if (reads === 3) f.auth.currentUser = { uid: 'b', isAnonymous: false };
                return result;
            } });
        });
        await f.handler(f.argument);
        assert.deepEqual(f.db.data, before);
        assert.match(f.notices.at(-1), /sign in again/u);
    }
});
