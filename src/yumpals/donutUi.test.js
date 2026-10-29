import test from 'node:test';
import assert from 'node:assert/strict';
import { HATCH_MS, advance, createDonutPal } from './donutPal.js';
import { INITIAL_UI, donutUiReducer, screenRows } from './donutUi.js';
import { donutPalShown } from './donutRollout.js';

const NOW = Date.parse('2026-11-01T20:00:00Z'); // Monday 9am Auckland.
const baby = (fields = {}) => ({ ...advance(createDonutPal({ name: 'Pip', nowMs: NOW - HATCH_MS }), NOW), events: [], hunger: 2, happy: 2, ...fields });
let n = 0;
const ctx = (pal = baby(), extra = {}) => ({ pal, now: NOW, donuts: 5, id: `id-${++n}`, random: 0.9, reducedMotion: true, ...extra });
const run = (state, ...steps) => steps.reduce((s, [type, extra = {}, c = ctx()]) => donutUiReducer(s, { type, ...extra, ctx: c }), state);

test('a care action becomes one intent with its own operation id; the result plays', () => {
    const fed = run(INITIAL_UI, ['A'], ['B'], ['B']);
    assert.equal(fed.intent.kind, 'care'); assert.equal(fed.intent.action, 'meal'); assert.match(fed.intent.operationId, /^id-/);
    assert.equal(run(fed, ['A']).intent, fed.intent, 'buttons wait while it is sent');
    const done = run(fed, ['result', { seq: fed.intent.seq, result: { ok: true, animation: 'eat', pal: baby({ hunger: 3 }) } }]);
    assert.equal(done.intent, null); assert.equal(done.mode, 'anim'); assert.equal(done.message, 'Yum!');
    assert.equal(run(fed, ['result', { seq: fed.intent.seq + 1, result: { ok: true, animation: 'eat' } }]).intent, fed.intent, 'stale answers are ignored');
});

test('refusals the rules can predict are shown at once, with no request', () => {
    const full = run(INITIAL_UI, ['A'], ['B'], ['B', {}, ctx(baby({ hunger: 4 }))]);
    assert.equal(full.intent, null); assert.equal(full.message, 'Your pal is full.');
    const noDonuts = run(INITIAL_UI, ['A'], ['B'], ['A'], ['B', {}, ctx(baby({ happy: 1 }), { donuts: 0 })]);
    assert.equal(noDonuts.intent, null); assert.equal(noDonuts.message, 'A treat costs 1 donut.');
    const server = run(run(INITIAL_UI, ['A'], ['B'], ['B']), ['result', { seq: 1, result: { ok: false, reason: 'paused' } }]);
    assert.equal(server.message, 'YumPals is resting right now.');
});

test('the game: each guess asks the host, the turn is revealed, and round 5 shows the score', () => {
    let s = run(INITIAL_UI, ['A'], ['A'], ['B']);
    assert.equal(s.mode, 'game');
    const gameId = s.game.id;
    for (let round = 0; round < 5; round++) {
        s = run(s, ['A']);
        assert.equal(s.intent.kind, 'guess'); assert.equal(s.intent.round, round); assert.equal(s.intent.gameId, gameId);
        const complete = round === 4;
        s = run(s, ['result', { seq: s.intent.seq, result: { ok: true, target: 'left', complete, animation: complete ? 'happy' : 'right', pal: baby() } }]);
        assert.equal(s.game.reveal.turn, 'left');
        s = run(s, ['tick'], ['tick'], ['tick']);
    }
    assert.equal(s.mode, 'anim'); assert.equal(s.anim.then, 'game'); assert.match(s.message, /^You won!/);
    assert.equal(run(s, ['C']).mode, 'room');
});

test('C leaves a game even while a guess is on its way; its late answer is ignored', () => {
    let s = run(INITIAL_UI, ['A'], ['A'], ['B'], ['A']);
    const seq = s.intent.seq;
    s = run(s, ['C']);
    assert.equal(s.mode, 'room'); assert.equal(s.intent, null);
    assert.equal(run(s, ['result', { seq, result: { ok: true, target: 'left' } }]).mode, 'room');
});

test('events from outside (hatching, gifts) play from the room; B alone shows the clock', () => {
    const shown = run(INITIAL_UI, ['A'], ['B'], ['event', { animation: 'happy', message: 'A free gift!' }]);
    assert.equal(shown.mode, 'anim'); assert.equal(shown.message, 'A free gift!');
    const clock = run(INITIAL_UI, ['B']);
    assert.equal(clock.mode, 'clock');
    assert.equal(screenRows(clock, { pal: baby(), now: NOW, donuts: 0 }).length, 16);
});

test('who sees the Donut pal: the teacher only in teacher mode, everyone when enabled, never in sandbox', () => {
    assert.equal(donutPalShown({ mode: 'teacher', sandbox: false, uid: 'u', teacher: true }), true);
    assert.equal(donutPalShown({ mode: 'teacher', sandbox: false, uid: 'u', teacher: false }), false);
    assert.equal(donutPalShown({ mode: 'enabled', sandbox: false, uid: 'u', teacher: false }), true);
    assert.equal(donutPalShown({ mode: 'enabled', sandbox: true, uid: 'u', teacher: true }), false);
    assert.equal(donutPalShown({ mode: undefined, sandbox: false, uid: 'u', teacher: true }), false);
    assert.equal(donutPalShown({ mode: 'teacher', sandbox: false, uid: '', teacher: true }), false);
});
