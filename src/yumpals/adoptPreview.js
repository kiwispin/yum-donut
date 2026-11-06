// The live preview on the adoption form: the pal's life stages on the real
// screen, ending on the adult of the chosen kind (the only stage where kinds
// differ). Pure, so the loop can be tested.
import { drawRoom } from './donutPalArt.js';

const NOON = Date.parse('2026-11-02T23:00:00Z'); // daytime in Auckland, so the pal is awake
export const KIND_NAMES = { mossbit: 'Mossbit', pufflet: 'Pufflet', emberoo: 'Emberoo' };
// [stage, ticks shown, caption (at most 22 characters, like every caption)].
export const PREVIEW_STEPS = [
    ['egg', 6, 'It starts as an egg'], ['baby', 5, 'Then a baby'], ['child', 5, 'Then a child'], ['teen', 5, 'Then a teen'], ['adult', 12, null],
];
export const PREVIEW_LOOP = PREVIEW_STEPS.reduce((sum, [, ticks]) => sum + ticks, 0);
// Where the adult starts in the loop, so picking a kind shows its adult at once.
export const ADULT_START = PREVIEW_LOOP - PREVIEW_STEPS.at(-1)[1];

export function previewPal(stage, species) {
    return { stage, species, form: stage === 'adult' ? 'good' : null, name: '', hunger: 4, happy: 4, weight: 0, mess: 0,
        sick: false, sleepy: false, napUntil: 0, lightsOff: false, at: NOON, hatchAt: NOON, bornAt: NOON };
}

// tick counts up for ever; returns what to show for that moment of the loop.
export function previewFrame(species, tick, reducedMotion = false) {
    let at = ((tick % PREVIEW_LOOP) + PREVIEW_LOOP) % PREVIEW_LOOP;
    const step = PREVIEW_STEPS.find(([, ticks]) => (at -= ticks) < 0);
    const [stage, , caption] = step;
    return {
        stage,
        caption: caption || `Grows into ${KIND_NAMES[species] || 'a pal'}`,
        rows: drawRoom(previewPal(stage, species), { x: 8, tick, ms: NOON, reducedMotion }),
    };
}
