import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { payBountyTransaction, payInterestTransaction, validateInterestRecipients, prepareInterestRun, completeInterestRun } from './rewardCompatibility.js';
import { assertWalletSession } from './walletCompatibility.js';

class Db {
    constructor() { this.values = new Map(); this.version = 0; this.conflicts = 0; this.failAt = 0; }
    async run(callback) {
        for (let attempt = 0; attempt < 15; attempt += 1) {
            const version = this.version;
            const data = structuredClone(this.values);
            const writes = new Map();
            let count = 0;
            const stage = (path, value) => {
                if (++count === this.failAt) throw new Error('WRITE_FAILURE');
                writes.set(path, value);
            };
            const transaction = {
                get: async (path) => {
                    assert.equal(writes.size, 0, 'read after write');
                    return { exists: () => data.has(path), data: () => data.get(path) };
                },
                update: (path, patch) => stage(path, { ...data.get(path), ...patch }),
                set: stage,
            };
            const result = await callback(transaction);
            if (version !== this.version) { this.conflicts += 1; continue; }
            for (const [path, value] of writes) this.values.set(path, value);
            if (writes.size) this.version += 1;
            return result;
        }
        throw new Error('RETRY_EXHAUSTED');
    }
}
const root = 'artifacts/test/public/data';
const pub = (id) => `${root}/users/${id}`;
const priv = (uid) => `artifacts/test/users/${uid}/profile/data`;
const job = (id) => `${root}/bounties/${id}`;
const bountyReceipt = (id) => `${root}/bounty_payments/${id}`;
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { resolve, promise }; };

function fixture() {
    const db = new Db();
    for (const [id, uid] of [['Alice', 'a'], ['Bob', 'b']]) {
        db.values.set(pub(id), { name: id, uid, claimed: true, balance: 30.5, bank_balance: 100, lifetime_received: 80, lifetime_given: 9, opaque: { keep: true } });
        db.values.set(priv(uid), { name: id, balance: 30.5, bank_balance: 100, given_today: 2, opaque: { keep: true } });
    }
    db.values.set(job('parent'), { status: 'open', remaining: 2, reward: 999, title: 'Parent' });
    db.values.set(job('child'), { status: 'claimed', parentId: 'parent', claimantId: 'a', claimantName: 'Alice', reward: 3, title: 'Job' });
    const bountyOptions = (id = 'child') => ({ bountyId: id, bountyRef: job(id), receiptRef: bountyReceipt(id), activityRef: `${root}/transactions/bounty_${id}`,
        publicRefFor: pub, privateRefFor: priv, isActive: () => true, timestamp: () => 'TIME' });
    const interestOptions = (uid = 'a', id = 'Alice') => ({ uid, operationId: 'run-1', rate: 0.05,
        publicRef: pub(id), privateRef: priv(uid), receiptRef: `${root}/bank_interest_runs/run-1/recipients/${uid}`,
        activityRef: `${root}/transactions/interest_run-1_${uid}`, isActive: () => true, timestamp: () => 'TIME' });
    return { db, bountyOptions, interestOptions };
}

function actualHandler(name, f, overrides = {}) {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const end = name === 'handlePayBounty' ? '// --- BANK ACTIONS ---' : 'const handleDeleteTransaction';
    const code = `const ${name} = async${source.split(`const ${name} = async`)[1].split(end)[0]}`;
    const notices = [];
    const storage = new Map();
    const env = { db: f.db, APP_ID: 'test', isAdmin: true, isSandbox: false, user: { uid: 'teacher' },
        auth: { currentUser: { uid: 'teacher', isAnonymous: false } },
        showNotification: (message) => notices.push(message), triggerConfetti: () => {},
        doc: (...args) => { assert.ok(args.slice(1).every((x) => typeof x === 'string' && x)); return args.slice(1).join('/'); },
        runTransaction: (_db, callback) => f.db.run(callback), serverTimestamp: () => 'TIME',
        payBountyTransaction, payInterestTransaction, prepareInterestRun, completeInterestRun, assertWalletSession,
        localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
        interestRunRef: { current: null }, interestBusyRef: { current: false }, BANK_INTEREST_RATE: 0.05,
        users: [{ id: 'Alice', uid: 'a', bank_balance: 9999 }, { id: 'Bob', uid: 'b', bank_balance: 0 }],
        crypto: { randomUUID: () => 'run-1' }, console: { error: () => {} }, ...overrides };
    const handler = new Function('env', `const {${Object.keys(env).join(',')}} = env; ${code}; return ${name};`)(env);
    return { handler, notices, env };
}

test('actual bounty uses saved claimant/reward, preserves multi-claim parent and unrelated fields, retries once', async () => {
    for (const status of ['claimed', 'pending_review']) {
        const f = fixture();
        f.db.values.get(job('child')).status = status;
        const before = structuredClone(f.db.values);
        const { handler } = actualHandler('handlePayBounty', f);
        await handler('child', 'Bob', 5000);
        assert.deepEqual(f.db.values.get(pub('Alice')), { ...before.get(pub('Alice')), balance: 33.5, lifetime_received: 83 });
        assert.deepEqual(f.db.values.get(priv('a')), { ...before.get(priv('a')), balance: 33.5 });
        assert.deepEqual(f.db.values.get(job('parent')), before.get(job('parent')));
        assert.deepEqual(f.db.values.get(pub('Bob')), before.get(pub('Bob')));
        const receipt = f.db.values.get(bountyReceipt('child'));
        assert.equal(receipt.amount, 3); assert.equal(receipt.walletBefore, 30.5); assert.equal(receipt.walletAfter, 33.5);
        assert.equal(receipt.lifetimeBefore, 80); assert.equal(receipt.lifetimeAfter, 83);
        f.db.values.delete(`${root}/transactions/bounty_child`);
        f.db.values.get(job('child')).status = 'claimed'; // Old controls must not repay it.
        const paid = structuredClone(f.db.values);
        await handler('child');
        assert.deepEqual(f.db.values, paid);
    }
});

test('bounty corrupted binding, UID, reward, status, missing mirrors and failed writes leave records unchanged', async () => {
    const cases = [
        (f) => { f.db.values.get(job('child')).claimantId = 'b'; },
        (f) => { f.db.values.get(job('child')).reward = NaN; },
        (f) => { f.db.values.get(job('child')).status = 'open'; },
        (f) => { f.db.values.delete(priv('a')); },
        (f) => { f.db.values.get(priv('a')).balance = 1; },
        (f) => { f.db.values.get(pub('Alice')).lifetime_received = undefined; },
    ];
    for (const mutate of cases) {
        const f = fixture(); mutate(f); const before = structuredClone(f.db.values);
        await assert.rejects(f.db.run((t) => payBountyTransaction(t, f.bountyOptions())));
        assert.deepEqual(f.db.values, before);
    }
    for (const failAt of [1, 2, 3, 4, 5]) {
        const f = fixture(); f.db.failAt = failAt; const before = structuredClone(f.db.values);
        await actualHandler('handlePayBounty', f).handler('child');
        assert.deepEqual(f.db.values, before);
    }
    for (const patch of [{ bountyId: 'other' }, { bountyPath: 'other' }, { walletAfter: 900 }, { lifetimeBefore: -1 }, { recipientUid: 'b' }]) {
        const f = fixture(); await f.db.run((t) => payBountyTransaction(t, f.bountyOptions()));
        Object.assign(f.db.values.get(bountyReceipt('child')), patch);
        await assert.rejects(f.db.run((t) => payBountyTransaction(t, f.bountyOptions())), /CORRUPT_BOUNTY_RECEIPT/u);
    }
});

test('deterministic concurrent bounty approvals retry and deliver one payment', async () => {
    const f = fixture(); const ready = deferred(); let arrived = 0;
    const run = f.db.run.bind(f.db);
    f.db.run = (callback) => run((t) => callback({ ...t, get: async (path) => {
        const snap = await t.get(path);
        if (path === priv('a') && arrived < 2) { if (++arrived === 2) ready.resolve(); await ready.promise; }
        return snap;
    } }));
    const { handler } = actualHandler('handlePayBounty', f);
    await Promise.all([handler('child'), handler('child')]);
    assert.ok(f.db.conflicts > 0); assert.equal(f.db.values.get(pub('Alice')).balance, 33.5);
    assert.equal([...f.db.values.keys()].filter((path) => path.includes('/bounty_payments/')).length, 1);
});

test('actual interest reads current savings not list values; wallet/Given stay unchanged; receipts survive feed deletion', async () => {
    const f = fixture(); const before = structuredClone(f.db.values);
    const { handler, notices } = actualHandler('handlePayInterest', f);
    await handler();
    for (const [id, uid] of [['Alice', 'a'], ['Bob', 'b']]) {
        for (const path of [pub(id), priv(uid)]) assert.deepEqual(f.db.values.get(path), { ...before.get(path), bank_balance: 105 });
        const options = f.interestOptions(uid, id);
        assert.equal(f.db.values.get(options.receiptRef).amount, 5);
        f.db.values.delete(options.activityRef);
        const result = await f.db.run((t) => payInterestTransaction(t, options));
        assert.equal(result.duplicate, true); assert.equal(result.amount, 5);
        assert.equal(f.db.values.get(pub(id)).bank_balance, 105);
    }
    assert.match(notices.at(-1), /10.*10 newly paid/u);
});

test('interest partial failure retries same run, reports confirmed totals separately from new payments', async () => {
    const f = fixture(); f.db.values.get(priv('b')).bank_balance = 50;
    const { handler, notices, env } = actualHandler('handlePayInterest', f);
    await handler();
    assert.match(notices.at(-1), /Confirmed 5.*1 accounts not confirmed/u);
    assert.equal(env.interestRunRef.current.operationId, 'run-1');
    f.db.values.get(priv('b')).bank_balance = 100;
    await handler();
    assert.match(notices.at(-1), /Confirmed 10.*5 newly paid/u);
    assert.equal(f.db.values.get(pub('Alice')).bank_balance, 105);
    assert.equal(f.db.values.get(pub('Bob')).bank_balance, 105);
    assert.equal(env.interestRunRef.current, null);
});

test('interest preserves absent-bank policy, records zero eligibility, and refuses corrupt/missing/ambiguous records', async () => {
    const f = fixture();
    delete f.db.values.get(priv('a')).bank_balance;
    await f.db.run((t) => payInterestTransaction(t, f.interestOptions()));
    assert.equal(f.db.values.get(priv('a')).bank_balance, 105);
    const zero = fixture();
    delete zero.db.values.get(pub('Alice')).bank_balance; delete zero.db.values.get(priv('a')).bank_balance;
    await zero.db.run((t) => payInterestTransaction(t, zero.interestOptions()));
    assert.equal(zero.db.values.get(zero.interestOptions().receiptRef).amount, 0);
    zero.db.values.get(pub('Alice')).bank_balance = 100; zero.db.values.get(priv('a')).bank_balance = 100;
    assert.equal((await zero.db.run((t) => payInterestTransaction(t, zero.interestOptions()))).amount, 0);
    for (const mutate of [
        (x) => x.db.values.delete(priv('a')),
        (x) => { x.db.values.get(pub('Alice')).uid = 'b'; },
        (x) => { x.db.values.get(priv('a')).bank_balance = null; },
        (x) => { x.db.values.get(priv('a')).bank_balance = 1; },
        (x) => { x.db.values.get(pub('Alice')).ownerUid = 'a'; },
    ]) {
        const x = fixture(); mutate(x); const before = structuredClone(x.db.values);
        await assert.rejects(x.db.run((t) => payInterestTransaction(t, x.interestOptions())));
        assert.deepEqual(x.db.values, before);
    }
    assert.throws(() => validateInterestRecipients([{ id: 'Alice', uid: 'a' }, { id: 'Bob', uid: 'a' }]));
    assert.throws(() => validateInterestRecipients([{ id: 'Alice', uid: 'a' }, { id: 'Alice', uid: 'b' }]));
});

test('interest second-write rollback leaves savings and receipts unchanged; invalid replay after rejects', async () => {
    for (const failAt of [1, 2, 3, 4]) {
        const f = fixture(); f.db.failAt = failAt; const before = structuredClone(f.db.values);
        await assert.rejects(f.db.run((t) => payInterestTransaction(t, f.interestOptions())));
        assert.deepEqual(f.db.values, before);
    }
    const f = fixture(); await f.db.run((t) => payInterestTransaction(t, f.interestOptions()));
    f.db.values.get(f.interestOptions().receiptRef).after = Infinity;
    await assert.rejects(f.db.run((t) => payInterestTransaction(t, f.interestOptions())), /CORRUPT_INTEREST_RECEIPT/u);
});

test('actual payout handlers sandbox/auth guards and interest double-click lock prevent mutation', async () => {
    for (const name of ['handlePayBounty', 'handlePayInterest']) {
        for (const overrides of [{ isSandbox: true }, { auth: { currentUser: null } }]) {
            const f = fixture(); const before = structuredClone(f.db.values);
            await actualHandler(name, f, overrides).handler('child');
            assert.deepEqual(f.db.values, before);
        }
    }
    const f = fixture(); const ready = deferred(); const release = deferred();
    const run = f.db.run.bind(f.db);
    f.db.run = async (callback) => { ready.resolve(); await release.promise; return run(callback); };
    const { handler, notices } = actualHandler('handlePayInterest', f);
    const first = handler(); await ready.promise; await handler();
    assert.match(notices.at(-1), /still being checked/u);
    release.resolve(); await first;
    assert.equal(f.db.values.get(pub('Alice')).bank_balance, 105);
});

test('unclaimed roster entries skip; claimed missing UID refuses before manifest storage or payout', async () => {
    const f = fixture();
    const normal = actualHandler('handlePayInterest', f, { users: [
        { id: 'Alice', uid: 'a', claimed: true }, { id: 'Unclaimed', claimed: false }, { id: 'LegacyUnclaimed' },
    ] });
    await normal.handler();
    assert.equal(f.db.values.get(pub('Alice')).bank_balance, 105);
    assert.match(normal.notices.at(-1), /Confirmed 5/u);
    const x = fixture(); const before = structuredClone(x.db.values);
    let writes = 0;
    const missing = actualHandler('handlePayInterest', x, { users: [{ id: 'Alice', uid: 'a' }, { id: 'Missing', claimed: true }],
        localStorage: { getItem: () => null, setItem: () => { writes += 1; } } });
    await missing.handler();
    assert.deepEqual(x.db.values, before); assert.equal(writes, 0);
    assert.match(missing.notices.at(-1), /missing its sign-in link.*No interest run started/u);
});

test('partial payout survives handler reload using persisted manifest and original rate/recipients', async () => {
    const f = fixture(); f.db.values.get(priv('b')).bank_balance = 10;
    const first = actualHandler('handlePayInterest', f);
    await first.handler();
    const saved = first.env.localStorage.getItem('yum-donut:interest-run:v1:teacher');
    assert.equal(JSON.parse(saved).operationId, 'run-1');
    f.db.values.get(priv('b')).bank_balance = 100;
    const reloaded = actualHandler('handlePayInterest', f, { localStorage: first.env.localStorage,
        users: [], BANK_INTEREST_RATE: 0.9, crypto: { randomUUID: () => { throw new Error('MUST_REUSE'); } } });
    await reloaded.handler();
    assert.equal(f.db.values.get(pub('Alice')).bank_balance, 105);
    assert.equal(f.db.values.get(pub('Bob')).bank_balance, 105);
    assert.match(reloaded.notices.at(-1), /Confirmed 10.*5 newly paid/u);
    assert.equal(first.env.localStorage.getItem('yum-donut:interest-run:v1:teacher'), null);
});

test('storage failures and invalid/null-UID manifests fail closed; completion cannot erase a different run', async () => {
    for (const storage of [
        { getItem: () => { throw new Error('DENIED'); } },
        { getItem: () => null, setItem: () => { throw new Error('FULL'); } },
        { getItem: () => null, setItem: () => {} },
        { getItem: () => '{bad json' },
        { getItem: () => JSON.stringify({ schemaVersion: 1, uid: 'other', operationId: 'old', rate: 0.05, recipients: [] }) },
        { getItem: () => JSON.stringify({ schemaVersion: 1, uid: 'teacher', operationId: 'old', rate: 0.05, recipients: [{ id: 'Alice', uid: null }] }) },
    ]) {
        const f = fixture(); const before = structuredClone(f.db.values);
        await actualHandler('handlePayInterest', f, { localStorage: storage }).handler();
        assert.deepEqual(f.db.values, before);
    }
    let removed = false;
    const run = { schemaVersion: 1, uid: 'teacher', operationId: 'old', rate: 0.05, recipients: [] };
    assert.throws(() => completeInterestRun({ getItem: () => JSON.stringify({ ...run, operationId: 'other' }), removeItem: () => { removed = true; } }, run));
    assert.equal(removed, false);
});

test('uncertain committed interest response retains manifest and reload confirms without repeat payment', async () => {
    const f = fixture(); const run = f.db.run.bind(f.db); let uncertain = true;
    f.db.run = async (callback) => {
        const result = await run(callback);
        if (uncertain) { uncertain = false; throw new Error('RESPONSE_LOST_AFTER_COMMIT'); }
        return result;
    };
    const first = actualHandler('handlePayInterest', f);
    await first.handler();
    assert.match(first.notices.at(-1), /some may already be paid/u);
    const reload = actualHandler('handlePayInterest', f, { localStorage: first.env.localStorage });
    await reload.handler();
    assert.match(reload.notices.at(-1), /Confirmed 10.*0 newly paid/u);
    assert.equal(f.db.values.get(pub('Alice')).bank_balance, 105);
    assert.equal(f.db.values.get(pub('Bob')).bank_balance, 105);
});

test('interest overlaps a current savings change deterministically and retries with the new savings', async () => {
    const f = fixture(); const ready = deferred(); const release = deferred();
    const pending = f.db.run(async (t) => payInterestTransaction({ ...t, get: async (path) => {
        const result = await t.get(path);
        if (path === priv('a')) { ready.resolve(); await release.promise; }
        return result;
    } }, f.interestOptions()));
    await ready.promise;
    await f.db.run(async (t) => {
        await t.get(pub('Alice')); await t.get(priv('a'));
        t.update(pub('Alice'), { bank_balance: 200 }); t.update(priv('a'), { bank_balance: 200 });
    });
    release.resolve(); await pending;
    assert.ok(f.db.conflicts > 0);
    assert.equal(f.db.values.get(pub('Alice')).bank_balance, 210);
    assert.equal(f.db.values.get(f.interestOptions().receiptRef).amount, 10);
});
