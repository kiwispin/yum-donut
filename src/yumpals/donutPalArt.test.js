import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BODY_NAMES, FACES, ICONS, ICON_ORDER, SCREEN_H, SCREEN_W, STATUS_PAGES, animationFrames, bodyFor, drawClock, drawFoodMenu,
    drawGame, drawGameScore, drawRoom, drawStatus, palSprite,
} from './donutPalArt.js';

const PAL = {
    name: 'Pip', species: 'mossbit', stage: 'baby', hunger: 2, happy: 0, mess: 3, sick: false, sleepy: false,
    napUntil: 0, lightsOff: false, weight: 12, form: null, at: Date.parse('2026-11-01T22:00:00Z'), bornAt: Date.parse('2026-10-31T22:00:00Z'),
};
const isScreen = rows => rows.length === SCREEN_H && rows.every(row => row.length === SCREEN_W && /^[#.]+$/.test(row));

test('every life stage has every face as a 16x16 sprite', () => {
    for (const body of BODY_NAMES) for (const face of Object.keys(FACES)) {
        const sprite = palSprite(body, face);
        assert.equal(sprite.length, 16, `${body} ${face}`);
        assert.ok(sprite.every(row => row.length === 16 && /^[#.]+$/.test(row)), `${body} ${face}`);
    }
    assert.notDeepEqual(palSprite('baby', 'happy'), palSprite('baby', 'idle'));
});

test('six 8x8 icons in A-button order', () => {
    assert.deepEqual(ICON_ORDER, ['food', 'play', 'clean', 'medicine', 'lights', 'status']);
    for (const id of ICON_ORDER) assert.ok(ICONS[id].length === 8 && ICONS[id].every(row => row.length === 8), id);
});

test('every screen and animation frame fills the 32x16 dot matrix exactly', () => {
    const stages = [...['egg', 'baby', 'child', 'teen'].map(stage => ({ ...PAL, stage })),
        ...['mossbit', 'pufflet', 'emberoo'].flatMap(species => ['good', 'scruffy'].map(form => ({ ...PAL, stage: 'adult', species, form })))];
    const night = Date.parse('2026-11-02T09:00:00Z');
    for (const pal of stages) {
        for (const variant of [pal, { ...pal, sick: true }, { ...pal, sleepy: true, mess: 0 }, { ...pal, lightsOff: true }])
            for (let tick = 0; tick < 8; tick++) {
                assert.ok(isScreen(drawRoom(variant, { x: tick * 3, tick })), pal.stage);
                assert.ok(isScreen(drawRoom(variant, { tick, ms: night })));
            }
        for (const type of ['eat', 'snack', 'no', 'shrug', 'happy', 'napped', 'clean', 'dose', 'medicine', 'lightsOff', 'lightsOn', 'hatched', 'grew'])
            for (const frame of animationFrames(pal, type)) assert.ok(isScreen(frame), `${pal.stage} ${type}`);
        for (let page = 0; page < STATUS_PAGES; page++) assert.ok(isScreen(drawStatus(pal, page, { donuts: 1234 })));
        assert.ok(isScreen(drawGame(pal, { results: [true, false, true, true, false], reveal: { guess: 'left', turn: 'right' } })));
    }
    assert.ok(isScreen(drawFoodMenu(0)) && isScreen(drawFoodMenu(1)));
    for (let wins = 0; wins <= 5; wins++) assert.ok(isScreen(drawGameScore(wins)));
    for (const [h, m] of [[0, 0], [9, 5], [12, 30], [23, 59]]) assert.ok(isScreen(drawClock(h, m)));
});

test('a scruffy adult looks different from a well-raised one', () => {
    for (const species of ['mossbit', 'pufflet', 'emberoo']) {
        const good = bodyFor({ stage: 'adult', species, form: 'good' }); const scruffy = bodyFor({ stage: 'adult', species, form: 'scruffy' });
        assert.equal(good, species); assert.equal(scruffy, `${species}Scruffy`);
        assert.notDeepEqual(palSprite(good, 'idle'), palSprite(scruffy, 'idle'));
    }
    assert.notDeepEqual(drawClock(9, 5), drawClock(21, 5));
});

test('the room shows mess, sickness and lights out', () => {
    const lit = rows => rows.join('').split('#').length - 1;
    const clean = drawRoom({ ...PAL, mess: 0 }); const messy = drawRoom(PAL);
    assert.ok(lit(messy) > lit(clean));
    assert.notDeepEqual(drawRoom({ ...PAL, sick: true }), drawRoom(PAL));
    const night = Date.parse('2026-11-02T09:00:00Z');
    assert.ok(lit(drawRoom({ ...PAL, lightsOff: true }, { ms: night })) > 256);
});
