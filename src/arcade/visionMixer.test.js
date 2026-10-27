import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    VISION_MIXER_CAMERAS, VISION_MIXER_LIVES, VISION_MIXER_TARGET_TAKES,
    holdMs, judgePress, nextCall, readyMs, takeWindowMs, visionMixerInitialState, visionMixerPrize, visionMixerReducer, visionMixerStage
} from './visionMixer.js';

const call = (camera, extra = {}) => ({ camera, phase: 'ready', readyMs: 800, takeMs: 1500, decoy: null, decoyMs: 0, hold: false, holdMs: 0, ...extra });
const start = first => visionMixerReducer(visionMixerInitialState, { type: 'start', call: call(first) });
const after = (state, ...actions) => actions.reduce((current, action) => visionMixerReducer(current, { round: current.round, ...action }), state);
const hit = state => {
    const target = state.call.camera;
    const next = after(state, { type: 'advance' }, { type: 'press', camera: target });
    return after(next, { type: 'next', call: call(target === 2 ? 3 : 2) });
};
// Feeds a fixed sequence of "random" numbers.
const sequence = (...values) => { let n = 0; return () => values[n++ % values.length]; };

test('take window starts at 1.5s and shrinks to half a second', () => {
    assert.equal(takeWindowMs(0), 1500);
    assert.ok(takeWindowMs(10) < takeWindowMs(9));
    assert.equal(takeWindowMs(19), 500);
    assert.equal(takeWindowMs(100), 500);
});

test('ready time varies within bounds and shortens with the streak', () => {
    assert.equal(readyMs(0, () => 0), 750);
    assert.equal(readyMs(0, () => 0.999), 1250);
    assert.equal(readyMs(100, () => 0), 300);
    assert.equal(holdMs(19), 700);
});

test('stages begin at takes 5 and 10', () => {
    assert.deepEqual([0, 4, 5, 9, 10, 19].map(visionMixerStage), [1, 1, 2, 2, 3, 3]);
});

test('next call never repeats the camera on air, and a decoy is never the real call', () => {
    for (const live of VISION_MIXER_CAMERAS.map(camera => camera.id)) {
        for (const r of [0, 0.3, 0.6, 0.999]) {
            const plain = nextCall(live, 0, () => r);
            assert.notEqual(plain.camera, live);
            const changed = nextCall(live, 5, sequence(r, 0.5, 0.1, 0.999 - r, 0.5));
            assert.equal(changed.phase, 'decoy');
            assert.ok(changed.decoy !== changed.camera && changed.decoy !== live);
        }
    }
});

test('stage 1 numbers the take; later stages do not, and only stage 3 holds', () => {
    assert.equal(nextCall(1, 0, () => 0.1).numbered, true);
    assert.equal(nextCall(1, 0, () => 0.1).phase, 'ready', 'no change of mind in stage 1');
    assert.equal(nextCall(1, 5, () => 0.9).numbered, false);
    assert.equal(nextCall(1, 9, () => 0.1).hold, false, 'no holds before take 10');
    assert.equal(nextCall(1, 10, () => 0.1).hold, true);
    assert.equal(nextCall(1, 10, () => 0.9).hold, false);
});

test('presses are judged as early, hit, wrong, cut-on-hold or ignored', () => {
    assert.equal(judgePress(call(2, { phase: 'decoy' }), 2), 'early');
    assert.equal(judgePress(call(2), 2), 'early');
    assert.equal(judgePress(call(2, { phase: 'take' }), 2), 'hit');
    assert.equal(judgePress(call(2, { phase: 'take' }), 3), 'wrong');
    assert.equal(judgePress(call(2, { phase: 'hold' }), 2), 'cut-on-hold');
    assert.equal(judgePress(call(2, { phase: 'gap' }), 2), 'ignored');
    assert.equal(judgePress(null, 2), 'ignored');
});

test('a perfect show wins 2 donuts, any mistake wins 1', () => {
    assert.equal(visionMixerPrize(0), 2);
    assert.equal(visionMixerPrize(1), 1);
    assert.equal(visionMixerPrize(VISION_MIXER_LIVES - 1), 1);
});

test('twenty clean takes win the show', () => {
    assert.equal(VISION_MIXER_TARGET_TAKES, 20);
    let state = start(2);
    for (let n = 0; n < VISION_MIXER_TARGET_TAKES; n++) state = hit(state);
    assert.equal(state.status, 'won');
    assert.equal(state.lives, VISION_MIXER_LIVES);
});

test('a change of mind goes decoy, ready, take, and only the final camera counts', () => {
    let state = visionMixerReducer(visionMixerInitialState, { type: 'start', call: call(3, { phase: 'decoy', decoy: 2, decoyMs: 500 }) });
    state = after(state, { type: 'advance' });
    assert.equal(state.call.phase, 'ready');
    state = after(state, { type: 'advance' }, { type: 'press', camera: 2 });
    assert.equal(state.feedback, 'wrong', 'cutting to the decoy is a mistake');
    assert.equal(state.lives, VISION_MIXER_LIVES - 1);
});

test('a hold is survived by not cutting, and cutting on a hold costs a life', () => {
    let state = visionMixerReducer(visionMixerInitialState, { type: 'start', call: call(3, { hold: true, holdMs: 700 }) });
    state = after(state, { type: 'advance' });
    assert.equal(state.call.phase, 'hold');
    const survived = after(state, { type: 'timeout' });
    assert.equal(survived.feedback, 'held');
    assert.equal(survived.lives, VISION_MIXER_LIVES);
    assert.equal(survived.hits, 0, 'a hold is not a take');
    const cut = after(state, { type: 'press', camera: 3 });
    assert.equal(cut.feedback, 'cut-on-hold');
    assert.equal(cut.live, 3, 'the bad cut goes to air');
    assert.equal(cut.lives, VISION_MIXER_LIVES - 1);
});

test('early, wrong and missed takes each cost a life, and three end the show', () => {
    let state = after(start(2), { type: 'press', camera: 2 });
    assert.equal(state.feedback, 'early');
    state = after(state, { type: 'next', call: call(3) }, { type: 'advance' }, { type: 'press', camera: 4 });
    assert.equal(state.feedback, 'wrong');
    assert.equal(state.live, 4, 'a wrong cut goes to air');
    state = after(state, { type: 'next', call: call(2) }, { type: 'advance' }, { type: 'timeout' });
    assert.equal(state.feedback, 'missed');
    assert.equal(state.lives, 0);
    assert.equal(after(state, { type: 'next', call: call(3) }).status, 'lost');
});

test('a late timer from an earlier call is ignored', () => {
    let state = hit(start(2));
    assert.equal(visionMixerReducer(state, { type: 'timeout', round: state.round - 1 }), state);
    state = after(state, { type: 'advance' });
    assert.equal(visionMixerReducer(state, { type: 'advance', round: state.round - 1 }), state);
});

test('the Arcade wires Vision Mixer to its own daily reward field', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    assert.match(app, /lastPlayed=\{profile\?\.last_vision_mixer_win\}/);
    assert.match(app, /onWinBonus\(prize, 'last_vision_mixer_win', 'Vision Mixer'\)/);
});
