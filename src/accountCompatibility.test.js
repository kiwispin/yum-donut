import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { bootstrapProfile, watchAuthProfile } from './accountCompatibility.js';
import { assertWalletSession } from './walletCompatibility.js';

const pub = 'artifacts/test/public/data/users/Alice';
const priv = (uid) => `artifacts/test/users/${uid}/profile/data`;
const roster = 'artifacts/test/public/data/config/roster';
const gate = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { resolve, promise }; };
class Db {
    constructor() {
        this.values = new Map([[pub, { name: 'Alice', claimed: false, balance: 12.5, bank_balance: 6, lifetime_given: 8,
            lifetime_received: 30, gold_border: true, typing_license: true, training_earned_today: 2,
            avatar_pixels: ['pixels'], unknownProgress: { keep: true } }], [roster, { names: ['Alice'] }]]);
        this.version = 0; this.conflicts = 0; this.failAt = 0;
    }
    async run(callback) {
        for (let i = 0; i < 10; i += 1) {
            const version = this.version; const data = structuredClone(this.values); const writes = new Map(); let n = 0;
            const set = (p, v) => { if (++n === this.failAt) throw new Error('STAGE_FAILURE'); writes.set(p, v); };
            const result = await callback({
                get: async (p) => { assert.equal(writes.size, 0); return { exists: () => data.has(p), data: () => data.get(p) }; },
                set, update: (p, v) => set(p, { ...data.get(p), ...v }),
            });
            if (version !== this.version) { this.conflicts += 1; continue; }
            for (const [p, v] of writes) this.values.set(p, v);
            if (writes.size) this.version += 1;
            return result;
        }
        throw new Error('RETRIES');
    }
}
function wrapper(db, uid = 'a') {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const code = `const createProfile =${source.split('const createProfile =')[1].split('// --- AUTHENTICATION ---')[0]}`;
    const auth = { currentUser: { uid, isAnonymous: false } };
    const env = { db, auth, APP_ID: 'test', bootstrapProfile, assertWalletSession, doc: (...args) => args.slice(1).join('/'),
        runTransaction: (_db, cb) => db.run(cb), AVATAR_COLORS: ['blue'], MEDIA_EMOJIS: ['camera'], serverTimestamp: () => 'TIME' };
    return { auth, create: new Function('env', `const {${Object.keys(env).join(',')}}=env; ${code}; return createProfile;`)(env) };
}
function login(db, overrides = {}) {
    const w = wrapper(db); const notices = []; const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const code = `const handleLoginOrRegister =${source.split('const handleLoginOrRegister =')[1].split('const handleLogout =')[0]}`;
    const env = { auth: w.auth, db, APP_ID: 'test', loginAttemptRef: { current: 0 }, createProfile: w.create, assertWalletSession,
        setLoading: () => {}, setIsSandbox: () => {}, showNotification: (m) => notices.push(m),
        doc: (...args) => args.slice(1).join('/'), getDoc: async (p) => ({ exists: () => db.values.has(p), data: () => db.values.get(p) }),
        accountEmailCandidatesForName: () => ['email'], accountEmailForName: () => 'email',
        signInWithEmailAndPassword: async () => ({ user: w.auth.currentUser }),
        createUserWithEmailAndPassword: async () => ({ user: w.auth.currentUser }), updateProfile: async () => {},
        signOut: async () => { w.auth.currentUser = null; }, console: { error: () => {} }, ...overrides };
    return { ...w, env, notices, handler: new Function('env', `const {${Object.keys(env).join(',')}}=env; ${code}; return handleLoginOrRegister;`)(env) };
}

test('actual createProfile preserves all public fields and seeds appropriate private progress; repeat is a no-op', async () => {
    const db = new Db(); const before = structuredClone(db.values.get(pub)); const { create } = wrapper(db);
    assert.equal((await create('a', 'Alice')).created, true);
    assert.deepEqual(db.values.get(pub), { ...before, claimed: true, uid: 'a' });
    const p = db.values.get(priv('a'));
    for (const key of ['balance', 'bank_balance', 'gold_border', 'typing_license', 'training_earned_today', 'avatar_pixels']) assert.deepEqual(p[key], before[key]);
    assert.equal(p.ownerUid, undefined); assert.equal(p.given_today, 0);
    p.privateHistory = { retain: ['all'] }; const saved = structuredClone(db.values);
    assert.equal((await create('a', 'Alice')).created, false); assert.deepEqual(db.values, saved);
});

test('new absent public requires active roster; missing claimed private and conflicts/corruption never fabricate profiles', async () => {
    const fresh = new Db(); fresh.values.delete(pub); await wrapper(fresh).create('a', 'Alice'); assert.equal(fresh.values.get(priv('a')).balance, 0);
    for (const mutate of [
        (db) => { db.values.get(pub).claimed = true; db.values.get(pub).uid = 'a'; },
        (db) => { db.values.get(pub).uid = 'b'; },
        (db) => { db.values.get(pub).ownerUid = 'a'; },
        (db) => { db.values.get(pub).name = 'Other'; },
        (db) => { db.values.get(pub).balance = null; },
        (db) => { db.values.get(pub).lifetime_received = undefined; },
        (db) => { db.values.get(pub).bank_balance = '6'; },
        (db) => { db.values.get(roster).removed_names = ['Alice']; },
        (db) => { db.values.delete(pub); db.values.get(roster).names = []; },
        (db) => { db.values.set(priv('a'), { name: 'Other', balance: 12.5 }); },
    ]) {
        const db = new Db(); mutate(db); const before = structuredClone(db.values);
        await assert.rejects(wrapper(db).create('a', 'Alice')); assert.deepEqual(db.values, before);
    }
});

test('deterministic simultaneous claims of same public by different UIDs yield one winner', async () => {
    const db = new Db(); const run = db.run.bind(db); const ready = gate(); let arrivals = 0;
    db.run = (cb) => run((t) => cb({ ...t, get: async (p) => {
        const result = await t.get(p); if (p === roster && arrivals < 2) { if (++arrivals === 2) ready.resolve(); await ready.promise; } return result;
    } }));
    const results = await Promise.allSettled([wrapper(db, 'a').create('a', 'Alice'), wrapper(db, 'b').create('b', 'Alice')]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1); assert.ok(db.conflicts > 0);
    assert.equal([priv('a'), priv('b')].filter((p) => db.values.has(p)).length, 1);
});

test('gift during bootstrap forces retry and preserves new balance and lifetime', async () => {
    const db = new Db(); const run = db.run.bind(db); const ready = gate(); const release = gate();
    db.run = (cb) => run((t) => cb({ ...t, get: async (p) => {
        const result = await t.get(p); if (p === roster) { ready.resolve(); await release.promise; } return result;
    } }));
    const pending = wrapper(db).create('a', 'Alice'); await ready.promise;
    await run(async (t) => { await t.get(pub); t.update(pub, { balance: 15.5, lifetime_received: 33 }); });
    release.resolve(); await pending;
    assert.ok(db.conflicts > 0); assert.equal(db.values.get(priv('a')).balance, 15.5); assert.equal(db.values.get(pub).lifetime_received, 33);
});

test('all bootstrap writes roll back and auth change after reads aborts', async () => {
    for (const failAt of [1, 2]) {
        const db = new Db(); db.failAt = failAt; const before = structuredClone(db.values);
        await assert.rejects(wrapper(db).create('a', 'Alice')); assert.deepEqual(db.values, before);
    }
    const db = new Db(); const w = wrapper(db); const before = structuredClone(db.values); const run = db.run.bind(db);
    db.run = (cb) => run((t) => cb({ ...t, get: async (p) => { const r = await t.get(p); if (p === roster) w.auth.currentUser = { uid: 'b' }; return r; } }));
    await assert.rejects(w.create('a', 'Alice'), /WALLET_SESSION_CHANGED/u); assert.deepEqual(db.values, before);
});

test('actual login refuses missing claimed history, signs out mismatched names, and checks auth after reads', async () => {
    const db = new Db(); Object.assign(db.values.get(pub), { claimed: true, uid: 'a' });
    const missing = login(db); await missing.handler('Alice', 'secret');
    assert.equal(db.values.has(priv('a')), false); assert.match(missing.notices.at(-1), /not reset/u);
    db.values.set(priv('a'), { name: 'Other' }); const mismatch = login(db); await mismatch.handler('Alice', 'secret');
    assert.equal(mismatch.auth.currentUser, null); assert.match(mismatch.notices.at(-1), /different Yum Donut name/u);
    // Compile with the overridden read dependency.
    const switched = login(new Db(), { getDoc: async () => { switched.auth.currentUser = { uid: 'b' }; return { exists: () => false }; } });
    await switched.handler('Alice', 'secret'); assert.match(switched.notices.at(-1), /account changed/u);
});

test('signup auth success with failed bootstrap remains recoverable and never reports restored or deletes account', async () => {
    const db = new Db(); db.failAt = 2; const a = login(db); const before = structuredClone(db.values);
    await a.handler('Alice', 'secret', false, true);
    assert.deepEqual(db.values, before); assert.equal(a.auth.currentUser.uid, 'a');
    assert.match(a.notices.at(-1), /sign-in account was created.*same password/u);
    assert.doesNotMatch(a.notices.at(-1), /secret|restored/u);
    db.failAt = 0;
    await a.handler('Alice', 'secret');
    assert.equal(db.values.get(priv('a')).balance, 12.5);
    assert.deepEqual(db.values.get(pub).unknownProgress, { keep: true });
    assert.match(a.notices.at(-1), /Welcome back/u);
});

test('auth/profile listener detaches on switch, ignores queued old auth/profile/errors and fully cleans up', () => {
    const auth = { currentUser: { uid: 'a' } }; let authCallback; let authStops = 0; const listeners = []; const shown = []; const errors = [];
    const stop = watchAuthProfile({ auth,
        onAuthStateChanged: (_auth, cb) => { authCallback = cb; cb(auth.currentUser); return () => { authStops += 1; }; },
        onSnapshot: (uid, cb, error) => { const item = { uid, cb, error, stops: 0 }; listeners.push(item); cb({ exists: () => true, data: () => ({ name: uid }) }); return () => { item.stops += 1; }; },
        profileRef: (uid) => uid, setUser: () => {}, setMyProfile: (p) => shown.push(p), setLoading: () => {}, onError: (e) => errors.push(e) });
    auth.currentUser = { uid: 'b' }; authCallback(auth.currentUser);
    assert.equal(listeners[0].stops, 1); assert.equal(shown.at(-1).name, 'b');
    const length = shown.length;
    authCallback({ uid: 'a' }); listeners[0].cb({ exists: () => true, data: () => ({ name: 'OLD' }) }); listeners[0].error('OLD');
    assert.equal(shown.length, length); assert.equal(errors.length, 0);
    stop(); authCallback({ uid: 'b' }); listeners[1].cb({ exists: () => false }); listeners[1].error('STOPPED');
    assert.equal(shown.length, length); assert.equal(listeners.length, 2); assert.equal(listeners[1].stops, 1); assert.equal(authStops, 1);
});

test('late sandbox read cannot replace newer login profile or loading state; logout invalidates attempts', async () => {
    const db = new Db(); const pending = gate(); const profiles = []; const loading = [];
    let reads = 0;
    const a = login(db, { users: [{ name: 'Alice', uid: 'a' }], setUser: () => {}, setMyProfile: (p) => profiles.push(p),
        setLoading: (v) => loading.push(v), getDoc: async (p) => {
            if (++reads === 1) return pending.promise;
            return { exists: () => db.values.has(p), data: () => db.values.get(p) };
        } });
    const sandbox = a.handler('Alice', 'secret', true);
    await a.handler('Alice', 'secret');
    const before = { profiles: profiles.length, loading: loading.length, notices: a.notices.length };
    pending.resolve({ exists: () => true, data: () => ({ name: 'OLD SANDBOX' }) });
    await sandbox;
    assert.equal(profiles.length, before.profiles); assert.equal(loading.length, before.loading); assert.equal(a.notices.length, before.notices);
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    assert.match(source, /const handleLogout = \(\) => \{\s*loginAttemptRef.current \+= 1/u);
    assert.ok(source.includes('if (isCurrentAttempt()) setLoading(false)'));
});

test('opaque public cosmetics and cooldown values are retained by reference without rewriting public progress', async () => {
    const pixels = Object.freeze(['opaque']); const stamp = Object.freeze({ toDate: () => new Date(0) });
    const publicData = { name: 'Alice', claimed: false, balance: 1, bank_balance: 0, lifetime_given: 0, lifetime_received: 1,
        avatar_pixels: pixels, last_daily_bonus: stamp, unknown: Object.freeze({ progress: true }) };
    const data = new Map([[pub, publicData], [roster, { names: ['Alice'] }]]); const writes = [];
    await bootstrapProfile({ get: async (p) => ({ exists: () => data.has(p), data: () => data.get(p) }),
        set: (p, v) => writes.push([p, v]), update: (p, v) => writes.push([p, v]) }, {
        uid: 'a', name: 'Alice', publicRef: pub, privateRef: priv('a'), rosterRef: roster, isActive: () => true,
        defaults: { given_today: 0 },
    });
    assert.equal(writes[0][1].avatar_pixels, pixels); assert.equal(writes[0][1].last_daily_bonus, stamp);
    assert.deepEqual(writes[1], [pub, { claimed: true, uid: 'a' }]);
    assert.equal(publicData.unknown.progress, true);
});
