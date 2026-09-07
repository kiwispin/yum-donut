import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    advanceYumPalsAnimation,
    createYumPalsAnimationState,
    getYumPalsAnimationSequence,
    getYumPalsFrame,
    startYumPalsAnimation,
    YUMPALS_FOOD_PIXELS,
    YUMPALS_HEART_PIXELS,
    YUMPALS_SPRITES,
} from './yumpalsSprites.js';

test('every compatible species key uses the same rectangular 16x16 blob grids and valid palettes', () => {
    assert.deepEqual(Object.keys(YUMPALS_SPRITES), ['mossbit', 'pufflet', 'emberoo']);
    for (const sprite of Object.values(YUMPALS_SPRITES)) {
        for (const [frameName, pixels] of Object.entries(sprite.frames)) {
            assert.equal(pixels.length, 16, `${sprite.name} ${frameName} row count`);
            for (const row of pixels) {
                assert.equal([...row].length, 16, `${sprite.name} ${frameName} row width`);
                for (const cell of row) assert.ok(cell === '.' || sprite.palette[cell], `${sprite.name} ${frameName} has an uncoloured cell`);
            }
        }
        assert.deepEqual(sprite.pixels, sprite.frames.idleA);
    }
});

test('pixel food and heart assets have stable rectangular grids', () => {
    for (const [remaining, pixels] of Object.entries(YUMPALS_FOOD_PIXELS)) {
        assert.equal(pixels.length, 8, `food ${remaining} row count`);
        for (const row of pixels) assert.equal([...row].length, 8, `food ${remaining} row width`);
    }
    assert.equal(YUMPALS_HEART_PIXELS.length, 5);
    assert.ok(YUMPALS_HEART_PIXELS.every((row) => [...row].length === 5));
});

test('feed frames hold whole food while open and reduce it on each closing bite', () => {
    const feed = getYumPalsAnimationSequence('feed');
    assert.deepEqual(feed.map((frame) => frame.mouth), ['open', 'closed', 'open', 'closed', 'open', 'closed', 'closed']);
    assert.deepEqual(feed.map((frame) => frame.foodRemaining), [3, 2, 2, 1, 1, 0, 0]);
    assert.deepEqual(feed.slice(0, 6).filter((frame) => frame.mouth === 'closed').map((frame) => frame.foodRemaining), [2, 1, 0]);
    assert.equal(feed.at(-1).spriteFrame, 'happy');
    assert.ok(feed.every((frame) => frame.duration >= 300 || frame.key === 'feed-happy'));
});

test('idle, pat, sleep, and wake use minimal meaningful poses', () => {
    assert.deepEqual(getYumPalsAnimationSequence('idle').map((frame) => frame.key), ['idle-a', 'idle-b', 'blink']);
    assert.equal(getYumPalsFrame('mossbit', 'blink').pixels, YUMPALS_SPRITES.mossbit.frames.blink);
    assert.equal(getYumPalsAnimationSequence('pat')[0].heart, true);
    assert.deepEqual(getYumPalsAnimationSequence('sleep').map((frame) => [frame.eyes, frame.sleepMark]), [['closed', 'Z'], ['closed', 'Zz']]);
    assert.deepEqual(getYumPalsAnimationSequence('wake').map((frame) => frame.spriteFrame), ['wake', 'happy']);
    assert.equal(getYumPalsFrame('pufflet', 'sleep', 0).pixels, YUMPALS_SPRITES.pufflet.frames.sleep);
});

test('animation lifecycle tokens prevent stale frames and return completed actions to idle', () => {
    let state = createYumPalsAnimationState();
    const first = startYumPalsAnimation(state, 'feed');
    const second = startYumPalsAnimation(first, 'pat');
    assert.equal(second.token, first.token + 1);
    assert.equal(advanceYumPalsAnimation(second).type, 'idle');
    assert.equal(advanceYumPalsAnimation({ ...first, index: 6 }).type, 'idle');
    assert.equal(advanceYumPalsAnimation(startYumPalsAnimation(state, 'sleep', false)).type, 'sleep');
});

test('reduced motion keeps a static meaningful action pose', () => {
    assert.equal(getYumPalsAnimationSequence('feed', true).length, 1);
    assert.equal(getYumPalsAnimationSequence('feed', true)[0].spriteFrame, 'happy');
    assert.equal(getYumPalsAnimationSequence('pat', true)[0].heart, true);
    assert.equal(getYumPalsAnimationSequence('sleep', true)[0].eyes, 'closed');
});
