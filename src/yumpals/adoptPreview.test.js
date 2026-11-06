import test from 'node:test';
import assert from 'node:assert/strict';
import { ADULT_START, KIND_NAMES, PREVIEW_LOOP, PREVIEW_STEPS, previewFrame } from './adoptPreview.js';
import { MAX_CAPTION, stickerColours } from './donutUi.js';

test('the preview loops egg, baby, child, teen, then the chosen kind as an adult', () => {
    const stages = []; for (let tick = 0; tick < PREVIEW_LOOP; tick++) { const s = previewFrame('pufflet', tick).stage; if (stages.at(-1) !== s) stages.push(s); }
    assert.deepEqual(stages, ['egg', 'baby', 'child', 'teen', 'adult']);
    assert.equal(previewFrame('pufflet', PREVIEW_LOOP).stage, 'egg', 'it starts again');
    assert.equal(previewFrame('emberoo', ADULT_START).stage, 'adult', 'picking a kind jumps to its adult');
});

test('each kind shows its own adult; every frame fills the screen; captions fit the label', () => {
    const adults = Object.keys(KIND_NAMES).map(kind => previewFrame(kind, ADULT_START + 1).rows.join(''));
    assert.equal(new Set(adults).size, 3, 'three different adults');
    for (const kind of Object.keys(KIND_NAMES)) for (let tick = 0; tick < PREVIEW_LOOP; tick++) {
        const { rows, caption } = previewFrame(kind, tick);
        assert.ok(rows.length === 16 && rows.every(r => r.length === 32));
        assert.ok(caption.length <= MAX_CAPTION, caption);
    }
    assert.equal(previewFrame('emberoo', ADULT_START).caption, 'Grows into Emberoo');
    assert.equal(PREVIEW_STEPS[0][2], 'It starts as an egg');
});

test('the name sticker takes the chosen colour with readable text', () => {
    assert.deepEqual(stickerColours('#d94878'), { background: '#d94878', color: '#ffffff' });
    assert.equal(stickerColours('#495057').color, '#ffffff', 'dark colour, white text');
    assert.equal(stickerColours('#ffd43b').color, '#3b2f45', 'light colour, ink text');
    assert.equal(stickerColours('#FFFFFF').color, '#3b2f45');
    for (const bad of [null, undefined, 'red', '#fff', '#12345g', 42]) assert.equal(stickerColours(bad), null);
});
