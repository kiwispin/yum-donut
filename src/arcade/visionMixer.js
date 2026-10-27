// Vision Mixer rules: on-screen director calls "Ready" then "Take", and the
// player cuts to that camera inside the take window. Kept free of React so the
// timing and scoring can be tested directly.
//
// Stage 1 (takes 0–4): "Ready Cam n…" then "TAKE n!".
// Stage 2 (takes 5–9): TAKE no longer repeats the number, and the director may
// change their mind during Ready ("Ready Cam 3…" → "No, Ready Cam 1!").
// Stage 3 (takes 10+): some calls end in HOLD instead of TAKE; cutting is a mistake.

export const VISION_MIXER_CAMERAS = [
    { id: 1, name: 'Presenter', scene: '🧑‍💼' },
    { id: 2, name: 'Guest', scene: '🙋' },
    { id: 3, name: 'Wide', scene: '🎬' },
    { id: 4, name: 'Close-up', scene: '🎤' }
];

export const VISION_MIXER_TARGET_TAKES = 20;
export const VISION_MIXER_LIVES = 3;
export const VISION_MIXER_GAP_MS = 550;
export const VISION_MIXER_STAGE_TAKES = [5, 10];

const FIRST_TAKE_WINDOW_MS = 1500;
const TAKE_WINDOW_STEP_MS = 55;
const MIN_TAKE_WINDOW_MS = 500;
const BASE_READY_MS = 1000;
const READY_STEP_MS = 30;
const MIN_READY_MS = 400;
const MIN_HOLD_MS = 700;
const CHANGE_OF_MIND_CHANCE = 0.4;
const HOLD_CHANCE = 0.25;

export function visionMixerStage(hits) {
    return 1 + VISION_MIXER_STAGE_TAKES.filter(start => hits >= start).length;
}

// The take window shrinks with every clean take, down to half a second.
export function takeWindowMs(hits) {
    return Math.max(MIN_TAKE_WINDOW_MS, FIRST_TAKE_WINDOW_MS - hits * TAKE_WINDOW_STEP_MS);
}

// "Ready" lasts a slightly random time so the take can't be predicted by rhythm.
export function readyMs(hits, random = Math.random) {
    const base = Math.max(MIN_READY_MS, BASE_READY_MS - hits * READY_STEP_MS);
    return Math.round(base * (0.75 + random() * 0.5));
}

// A hold lasts at least as long as a take would, so the urge to cut is real.
export function holdMs(hits) {
    return Math.max(MIN_HOLD_MS, takeWindowMs(hits));
}

function pickCamera(exclude, random) {
    const choices = VISION_MIXER_CAMERAS.filter(camera => !exclude.includes(camera.id));
    return choices[Math.floor(random() * choices.length)].id;
}

// Never call the camera that is already on air; a decoy is never the real call.
export function nextCall(liveCamera, hits, random = Math.random) {
    const stage = visionMixerStage(hits);
    const camera = pickCamera([liveCamera], random);
    const call = {
        camera, stage, numbered: stage === 1, phase: 'ready',
        readyMs: readyMs(hits, random), takeMs: takeWindowMs(hits), decoy: null, decoyMs: 0, hold: false, holdMs: 0
    };
    if (stage >= 3 && random() < HOLD_CHANCE) return { ...call, hold: true, holdMs: holdMs(hits) };
    if (stage >= 2 && random() < CHANGE_OF_MIND_CHANCE) {
        return { ...call, phase: 'decoy', decoy: pickCamera([liveCamera, camera], random), decoyMs: readyMs(hits, random) };
    }
    return call;
}

export function judgePress(call, pressedCamera) {
    if (!call || call.phase === 'gap') return 'ignored';
    if (call.phase === 'decoy' || call.phase === 'ready') return 'early';
    if (call.phase === 'hold') return 'cut-on-hold';
    return pressedCamera === call.camera ? 'hit' : 'wrong';
}

export function visionMixerPrize(livesLost) {
    return livesLost === 0 ? 2 : 1;
}

export const visionMixerInitialState = { status: 'start', hits: 0, lives: VISION_MIXER_LIVES, live: 1, call: null, round: 0, feedback: null };

// Game state machine; timers dispatch advance/timeout/next with their round so a
// late timer from an earlier call can never affect the current one.
export function visionMixerReducer(state, action) {
    if (action.type === 'start') {
        return { ...visionMixerInitialState, status: 'playing', call: action.call, round: 1 };
    }
    if (state.status !== 'playing' || (action.round && action.round !== state.round)) return state;
    const toGap = (changes) => ({ ...state, ...changes, call: { ...state.call, phase: 'gap' } });
    switch (action.type) {
        case 'advance':
            if (state.call.phase === 'decoy') return { ...state, call: { ...state.call, phase: 'ready' } };
            if (state.call.phase === 'ready') return { ...state, call: { ...state.call, phase: state.call.hold ? 'hold' : 'take' } };
            return state;
        case 'timeout':
            if (state.call.phase === 'take') return toGap({ lives: state.lives - 1, feedback: 'missed' });
            if (state.call.phase === 'hold') return toGap({ feedback: 'held' });
            return state;
        case 'press': {
            const result = judgePress(state.call, action.camera);
            if (result === 'ignored') return state;
            if (result === 'hit') return toGap({ hits: state.hits + 1, live: action.camera, feedback: 'hit' });
            // A wrong cut still goes to air, like a real gallery mistake.
            const cutToAir = result === 'wrong' || result === 'cut-on-hold';
            return toGap({ lives: state.lives - 1, live: cutToAir ? action.camera : state.live, feedback: result });
        }
        case 'next':
            if (state.call.phase !== 'gap') return state;
            if (state.hits >= VISION_MIXER_TARGET_TAKES) return { ...state, status: 'won' };
            if (state.lives <= 0) return { ...state, status: 'lost' };
            return { ...state, call: action.call, round: state.round + 1, feedback: null };
        default:
            return state;
    }
}
