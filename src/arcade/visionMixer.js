// Vision Mixer rules: on-screen director calls "Ready" then "Take", and the
// player cuts to that camera inside the take window. Kept free of React so the
// timing and scoring can be tested directly.

export const VISION_MIXER_CAMERAS = [
    { id: 1, name: 'Presenter', scene: '🧑‍💼' },
    { id: 2, name: 'Guest', scene: '🙋' },
    { id: 3, name: 'Wide', scene: '🎬' },
    { id: 4, name: 'Close-up', scene: '🎤' }
];

export const VISION_MIXER_TARGET_TAKES = 15;
export const VISION_MIXER_LIVES = 3;
export const VISION_MIXER_GAP_MS = 650;

const FIRST_TAKE_WINDOW_MS = 2000;
const TAKE_WINDOW_STEP_MS = 80;
const MIN_TAKE_WINDOW_MS = 900;
const BASE_READY_MS = 1100;
const READY_STEP_MS = 30;
const MIN_READY_MS = 600;

// The take window shrinks as the streak grows, down to a floor.
export function takeWindowMs(hits) {
    return Math.max(MIN_TAKE_WINDOW_MS, FIRST_TAKE_WINDOW_MS - hits * TAKE_WINDOW_STEP_MS);
}

// "Ready" lasts a slightly random time so the take can't be predicted by rhythm.
export function readyMs(hits, random = Math.random) {
    const base = Math.max(MIN_READY_MS, BASE_READY_MS - hits * READY_STEP_MS);
    return Math.round(base * (0.75 + random() * 0.5));
}

// Never call the camera that is already on air.
export function nextCall(liveCamera, hits, random = Math.random) {
    const choices = VISION_MIXER_CAMERAS.filter(camera => camera.id !== liveCamera);
    const camera = choices[Math.floor(random() * choices.length)].id;
    return { camera, phase: 'ready', readyMs: readyMs(hits, random), takeMs: takeWindowMs(hits) };
}

export function judgePress(call, pressedCamera) {
    if (!call || call.phase === 'gap') return 'ignored';
    if (call.phase === 'ready') return 'early';
    return pressedCamera === call.camera ? 'hit' : 'wrong';
}

export function visionMixerPrize(livesLost) {
    return livesLost === 0 ? 2 : 1;
}

export const visionMixerInitialState = { status: 'start', hits: 0, lives: VISION_MIXER_LIVES, live: 1, call: null, round: 0, feedback: null };

// Game state machine; timers dispatch take/timeout/next with their round so a
// late timer from an earlier call can never affect the current one.
export function visionMixerReducer(state, action) {
    if (action.type === 'start') {
        return { ...visionMixerInitialState, status: 'playing', call: action.call, round: 1 };
    }
    if (state.status !== 'playing' || (action.round && action.round !== state.round)) return state;
    switch (action.type) {
        case 'take':
            return state.call.phase === 'ready' ? { ...state, call: { ...state.call, phase: 'take' } } : state;
        case 'timeout':
            return state.call.phase === 'take'
                ? { ...state, lives: state.lives - 1, feedback: 'missed', call: { ...state.call, phase: 'gap' } }
                : state;
        case 'press': {
            const result = judgePress(state.call, action.camera);
            if (result === 'ignored') return state;
            const gap = { ...state.call, phase: 'gap' };
            if (result === 'hit') return { ...state, hits: state.hits + 1, live: action.camera, feedback: 'hit', call: gap };
            // A wrong cut still goes to air, like a real gallery mistake.
            return { ...state, lives: state.lives - 1, live: result === 'wrong' ? action.camera : state.live, feedback: result, call: gap };
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
