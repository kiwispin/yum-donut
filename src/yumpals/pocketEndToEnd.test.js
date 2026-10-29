import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPocketTransport, validatePocketView } from './pocketClient.js';
import { HATCH_MS } from './donutPal.js';

const require = createRequire(import.meta.url);
const { setup } = require('../../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../../functions/src/yumpals/paidCareCallables.js');

class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
const NOW = Date.parse('2026-09-07T00:00:00Z'); // Monday noon Auckland.

// The real server code behind a fake network, and the real app client in front.
function connect({ pet = true, balance = 30, admin = true, targets = [] } = {}) {
    const f = setup({ pet, balance });
    Object.assign(f.refs, { refusal: (uid, id) => `fixture/refusals/${uid}/${id}`, visit: (uid, date) => `fixture/visits/${uid}/${date}`,
        pocketAct: (uid, id) => `fixture/pocketActs/${uid}/${id}`, pocketMove: uid => `fixture/migrations/${uid}_pocket` });
    let clock = NOW; const queue = [...targets];
    const api = createPaidCareCallables({ db: f.db, refs: f.refs, walletAdapter: f.walletAdapter, HttpsError, ready: () => true,
        now: () => clock, elapsedCare: true, pocketReady: () => false, chooseTarget: () => queue.shift() ?? 'left' });
    const sent = [];
    const fetchImpl = async (url, init) => {
        const name = url.split('/').pop(); const { data } = JSON.parse(init.body); sent.push({ name, data });
        const auth = { uid: 'student-a', token: { firebase: { sign_in_provider: 'password' }, ...(admin ? { yumpalsAdmin: true } : {}) } };
        try {
            const result = await (name === 'yumpalsGetPaidCareState' ? api.getState : api.purchase)({ auth, data });
            return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify({ result })) };
        } catch (error) {
            return { ok: false, status: 400, json: async () => ({ error: { status: 'FAILED_PRECONDITION', message: error.message, details: error.details } }) };
        }
    };
    const user = { uid: 'student-a', isAnonymous: false, getIdToken: async () => 'token' };
    const client = createPocketTransport({ projectId: 'yum-donut-school', getCurrentUser: () => user, fetchImpl });
    return { f, client, sent, later: ms => { clock += ms; } };
}

test('every real server reply passes the app checks: move, hatch, gift, care, treat, game', async () => {
    const { client, sent, later } = connect({ targets: ['left', 'right', 'left', 'left', 'right'] });
    const egg = await client.read('student-a');
    assert.equal(egg.pal.state.stage, 'egg'); assert.equal(egg.pal.name, 'Niblet');
    later(HATCH_MS);
    const baby = await client.read('student-a');
    assert.equal(baby.pal.state.stage, 'baby'); assert.equal(baby.visit.gains.hunger, 1);
    const meal = await client.act('student-a', { operationId: 'meal-1', action: 'meal' });
    assert.equal(meal.outcome.ok, true); assert.equal(meal.view.pal.state.hunger, 2);
    const treat = await client.act('student-a', { operationId: 'treat-1', action: 'snack' });
    assert.equal(treat.outcome.amount, 1); assert.equal(treat.view.wallet.balance, 29);
    let last;
    for (let round = 0; round < 5; round++) last = await client.act('student-a', { operationId: `g-${round}`, action: 'guess', gameId: 'game-1', round, choice: 'left' });
    assert.equal(last.outcome.game.complete, true); assert.equal(last.outcome.game.wins, 3);
    assert.ok(sent.every(({ data }) => data.pocket === 1), 'only pocket requests are sent');
});

test('a new pal: adoption for 5 donuts passes the app checks', async () => {
    const { client } = connect({ pet: false, balance: 9 });
    assert.equal((await client.read('student-a')).pal, null);
    const adopted = await client.act('student-a', { operationId: 'adopt-1', action: 'adopt',
        adoption: { name: 'Sprinkle', species: 'emberoo', casing: 'sun', color: '#e8590c' } });
    assert.equal(adopted.outcome.ok, true); assert.equal(adopted.view.wallet.balance, 4);
    assert.equal(adopted.view.pal.state.stage, 'egg'); assert.equal(adopted.view.pal.casing, 'sun');
});

test('server refusals arrive as reasons the app can show', async () => {
    const { client } = connect({ admin: false });
    await assert.rejects(client.read('student-a'), error => error.details.reason === 'POCKET_NOT_READY');
});

test('tampered or unexpected replies are rejected', async () => {
    const { client } = connect();
    const view = await client.read('student-a');
    assert.throws(() => validatePocketView({ ...view, extra: 1 }, 'student-a'));
    assert.throws(() => validatePocketView({ ...view, ownerUid: 'student-b' }, 'student-a'));
    assert.throws(() => validatePocketView({ ...view, pal: { ...view.pal, state: { ...view.pal.state, hunger: 7 } } }, 'student-a'));
    assert.throws(() => validatePocketView({ ...view, visit: { date: view.aucklandDate, welcomeBack: false, gains: { hunger: 1, happy: 1 } } }, 'student-a'));
    assert.doesNotThrow(() => validatePocketView(view, 'student-a'));
});
