import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    VISION_MIXER_CAMERAS, VISION_MIXER_LIVES, VISION_MIXER_TARGET_TAKES,
    judgePress, nextCall, readyMs, takeWindowMs, visionMixerInitialState, visionMixerPrize, visionMixerReducer
} from './visionMixer.js';

const call = (camera, phase = 'ready') => ({ camera, phase, readyMs: 800, takeMs: 1500 });
const start = first => visionMixerReducer(visionMixerInitialState, { type: 'start', call: call(first) });
const hit = state => {
    const target = state.call.camera;
    let next = visionMixerReducer(state, { type: 'take', round: state.round });
    next = visionMixerReducer(next, { type: 'press', camera: target });
    return visionMixerReducer(next, { type: 'next', round: next.round, call: call(target === 2 ? 3 : 2) });
};

test('take window shrinks with the streak down to a floor', () => {
    assert.equal(takeWindowMs(0), 2000);
    assert.ok(takeWindowMs(5) < takeWindowMs(4));
    assert.equal(takeWindowMs(100), 900);
});

test('ready time varies within bounds so the take cannot be timed by rhythm', () => {
    assert.equal(readyMs(0, () => 0), 825);
    assert.equal(readyMs(0, () => 0.999), 1374);
    assert.equal(readyMs(100, () => 0), 450);
});

test('next call never repeats the camera already on air', () => {
    for (const live of VISION_MIXER_CAMERAS.map(camera => camera.id)) {
        for (const r of [0, 0.3, 0.6, 0.999]) assert.notEqual(nextCall(live, 0, () => r).camera, live);
    }
    assert.equal(nextCall(1, 0, () => 0).phase, 'ready');
});

test('presses are judged as early, hit, wrong or ignored', () => {
    assert.equal(judgePress(call(2, 'ready'), 2), 'early');
    assert.equal(judgePress(call(2, 'take'), 2), 'hit');
    assert.equal(judgePress(call(2, 'take'), 3), 'wrong');
    assert.equal(judgePress(call(2, 'gap'), 2), 'ignored');
    assert.equal(judgePress(null, 2), 'ignored');
});

test('a perfect show wins 2 donuts, any mistake wins 1', () => {
    assert.equal(visionMixerPrize(0), 2);
    assert.equal(visionMixerPrize(1), 1);
    assert.equal(visionMixerPrize(VISION_MIXER_LIVES - 1), 1);
});

test('fifteen clean takes win the show', () => {
    let state = start(2);
    for (let n = 0; n < VISION_MIXER_TARGET_TAKES; n++) state = hit(state);
    assert.equal(state.status, 'won');
    assert.equal(state.hits, VISION_MIXER_TARGET_TAKES);
    assert.equal(state.lives, VISION_MIXER_LIVES);
});

test('early, wrong and missed takes each cost a life, and three end the show', () => {
    let state = start(2);
    state = visionMixerReducer(state, { type: 'press', camera: 2 });
    assert.equal(state.feedback, 'early');
    state = visionMixerReducer(state, { type: 'next', round: state.round, call: call(3) });
    state = visionMixerReducer(state, { type: 'take', round: state.round });
    state = visionMixerReducer(state, { type: 'press', camera: 4 });
    assert.equal(state.feedback, 'wrong');
    assert.equal(state.live, 4, 'a wrong cut goes to air');
    state = visionMixerReducer(state, { type: 'next', round: state.round, call: call(2) });
    state = visionMixerReducer(state, { type: 'take', round: state.round });
    state = visionMixerReducer(state, { type: 'timeout', round: state.round });
    assert.equal(state.feedback, 'missed');
    assert.equal(state.lives, 0);
    state = visionMixerReducer(state, { type: 'next', round: state.round, call: call(3) });
    assert.equal(state.status, 'lost');
});

test('a late timer from an earlier call is ignored', () => {
    let state = hit(start(2));
    const stale = visionMixerReducer(state, { type: 'timeout', round: state.round - 1 });
    assert.equal(stale, state);
    state = visionMixerReducer(state, { type: 'take', round: state.round });
    assert.equal(visionMixerReducer(state, { type: 'take', round: state.round - 1 }), state);
});

test('the Arcade wires Vision Mixer to its own daily reward field', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    assert.match(app, /lastPlayed=\{profile\?\.last_vision_mixer_win\}/);
    assert.match(app, /onWinBonus\(prize, 'last_vision_mixer_win', 'Vision Mixer'\)/);
});
