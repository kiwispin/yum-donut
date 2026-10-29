// What the A, B and C buttons do on the Donut pal, shared by the preview and the
// real (server-backed) handheld. A pure reducer: the host passes the pal, the time
// and its donuts with every action, and carries out `intent` (a care action or a
// game guess) itself: the preview with the local rules, the real handheld on the
// server. Refusals the rules can predict are shown at once, with no request.
import { GAME_ROUNDS, REFUSALS, act, aucklandParts } from './donutPal.js';
import {
    ICON_ORDER, STATUS_PAGES, animationFrames, drawClock, drawFoodMenu, drawGame, drawGameScore, drawRoom, drawStatus, walkRange,
} from './donutPalArt.js';

export const TICK_MS = 450;
export const GLAZES = { berry: '#f48fb1', mint: '#8fe0c4', sky: '#8ecbf5', sun: '#ffd36e' };
export const EVENT_TEXT = {
    hatched: () => 'Your egg hatched!', sick: pal => `${pal.name} feels sick. Try Medicine.`,
    grew: (pal, event) => event.stage !== 'adult' ? `${pal.name} grew into a ${event.stage}!`
        : event.form === 'scruffy' ? `${pal.name} grew into a scruffy adult. Too many care mistakes!` : `${pal.name} grew into a well-raised adult!`,
    napped: pal => `${pal.name} had a good nap.`,
};
export const SUCCESS = {
    eat: 'Yum!', snack: 'A cupcake treat! 1 donut spent.', happy: 'You won! Your pal is happier.',
    shrug: 'Close! Win 3 of 5 to cheer your pal up.', clean: 'All clean!', medicine: 'All better!', dose: 'One more dose needed.',
    lightsOff: 'Lights off. Sleep tight.', lightsOn: 'Lights on.',
};
export const UI_REFUSALS = {
    ...REFUSALS,
    paused: 'YumPals is resting right now.',
    offline: 'Your pal could not be reached. Please try again.',
};
export const BUTTON_HELP = {
    room: ['A: next icon', 'B: use icon', 'C: cancel'], food: ['A: switch food', 'B: eat it', 'C: back'],
    status: ['A: next page', 'B: next page', 'C: back'], game: ['A: guess left', 'B: guess right', 'C: stop playing'],
    anim: ['A', 'B', 'C: skip'], clock: ['A', 'B: back', 'C: back'],
};
const GAME_HINT = 'Which way will your pal turn? A left, B right. C stops.';

export const INITIAL_UI = { mode: 'room', selected: -1, cursor: 0, page: 0, game: null, anim: null, x: 8, tick: 0, message: '', intent: null, seq: 0 };

function play(state, frames, message, then = 'room') {
    return { ...state, mode: 'anim', anim: { frames, i: 0, then }, game: null, message, intent: null };
}

function refuse(state, pal, reason) {
    return play(state, animationFrames(pal, 'no'), UI_REFUSALS[reason] || UI_REFUSALS.unknown);
}

function newGame(id) {
    return { id, results: [], reveal: null, revealTicks: 0, ending: null };
}

// Each intent gets its own operation id, so a repeated send is never done twice.
function startIntent(state, intent, id) {
    return { ...state, intent: { ...intent, seq: state.seq + 1, operationId: id }, seq: state.seq + 1, message: '' };
}

// A care action: refused at once when the rules say so, otherwise handed to the host.
function care(state, ctx, action) {
    const check = act(ctx.pal, action, { nowMs: ctx.now, donuts: ctx.donuts });
    if (!check.ok) return refuse(state, ctx.pal, check.reason);
    return startIntent({ ...state, mode: 'room' }, { kind: 'care', action }, ctx.id);
}

function startGame(state, ctx) {
    const check = act(ctx.pal, 'game', { nowMs: ctx.now, wins: 0 });
    if (!check.ok) return refuse(state, ctx.pal, check.reason);
    return { ...state, mode: 'game', game: newGame(ctx.id), message: GAME_HINT };
}

function runIcon(state, ctx, index) {
    const icon = ICON_ORDER[index];
    if (icon === 'food') {
        const check = act(ctx.pal, 'meal', { nowMs: ctx.now });
        if (!check.ok && ['egg', 'asleep'].includes(check.reason)) return refuse(state, ctx.pal, check.reason);
        return { ...state, mode: 'food', cursor: 0, message: '' };
    }
    if (icon === 'play') return startGame(state, ctx);
    if (icon === 'status') return { ...state, mode: 'status', page: 0, message: '' };
    return care(state, ctx, icon);
}

function guess(state, side, id) {
    if (!state.game || state.game.reveal || state.intent) return state;
    const { results } = state.game;
    return startIntent(state, { kind: 'guess', gameId: state.game.id, round: results.length, side, winsSoFar: results.filter(Boolean).length }, id);
}

function finishAnimation(state, ctx) {
    if (state.anim.then === 'game' && act(ctx.pal, 'game', { nowMs: ctx.now, wins: 0 }).ok) {
        return { ...state, mode: 'game', anim: null, game: newGame(ctx.id) };
    }
    return { ...state, mode: 'room', anim: null };
}

function gameMessage(ending, pal) {
    if (!ending.ok) return UI_REFUSALS[ending.reason] || UI_REFUSALS.unknown;
    return `${SUCCESS[ending.animation]} ${pal.sleepy ? 'Your pal is sleepy now.' : 'Next game! C stops.'}`;
}

// ctx: { pal, now, donuts, id (a fresh id for a new game), random, reducedMotion }
export function donutUiReducer(state, action) {
    const ctx = action.ctx;
    const busy = Boolean(state.intent);
    switch (action.type) {
        case 'tick': {
            let next = { ...state, tick: state.tick + 1 };
            if (next.mode === 'anim') {
                const i = next.anim.i + 1;
                return i >= next.anim.frames.length ? finishAnimation(next, ctx) : { ...next, anim: { ...next.anim, i } };
            }
            if (next.mode === 'game' && next.game.reveal && --next.game.revealTicks <= 0) {
                const { guess: side, turn } = next.game.reveal;
                const results = [...next.game.results, side === turn];
                const { ending } = next.game;
                if (ending) {
                    const pal = ending.pal || ctx.pal;
                    const score = drawGameScore(results.filter(Boolean).length, GAME_ROUNDS);
                    return play(next, [score, score, score, ...animationFrames(pal, ending.ok ? ending.animation : 'no')], gameMessage(ending, pal), 'game');
                }
                return { ...next, game: { ...next.game, results, reveal: null, revealTicks: 0 } };
            }
            if (next.mode === 'room' && !ctx.reducedMotion && !ctx.pal.sick && !ctx.pal.sleepy) {
                const r = ctx.random;
                next = { ...next, x: Math.max(0, Math.min(walkRange(ctx.pal), next.x + (r < 0.3 ? -2 : r < 0.6 ? 2 : 0))) };
            }
            return next;
        }
        case 'A':
            if (busy) return state;
            if (state.mode === 'room') return { ...state, selected: (state.selected + 1) % ICON_ORDER.length, message: '' };
            if (state.mode === 'food') return { ...state, cursor: 1 - state.cursor };
            if (state.mode === 'status') return state.page + 1 >= STATUS_PAGES ? { ...state, mode: 'room' } : { ...state, page: state.page + 1 };
            if (state.mode === 'game') return guess(state, 'left', ctx.id);
            return state;
        case 'B':
            if (busy) return state;
            if (state.mode === 'room') return state.selected < 0 ? { ...state, mode: 'clock', message: '' } : runIcon(state, ctx, state.selected);
            if (state.mode === 'clock') return { ...state, mode: 'room' };
            if (state.mode === 'food') return care(state, ctx, state.cursor === 0 ? 'meal' : 'snack');
            if (state.mode === 'status') return state.page + 1 >= STATUS_PAGES ? { ...state, mode: 'room' } : { ...state, page: state.page + 1 };
            if (state.mode === 'game') return guess(state, 'right', ctx.id);
            return state;
        case 'C':
            if (busy && state.intent.kind === 'care') return state;
            if (state.mode === 'room') return { ...state, selected: -1, message: '' };
            return { ...state, mode: 'room', anim: null, game: null, intent: null, message: '' };
        case 'icon':
            if (busy || state.mode !== 'room') return state;
            return state.selected === action.index ? runIcon(state, ctx, action.index) : { ...state, selected: action.index, message: '' };
        // The host's answer to `intent`. result: { ok, animation, reason, pal?, target?, complete? }
        case 'result': {
            if (!state.intent || state.intent.seq !== action.seq) return state;
            const { result } = action; const intent = state.intent;
            const pal = result.pal || ctx.pal;
            if (intent.kind === 'care') {
                return play({ ...state, intent: null }, animationFrames(pal, result.ok ? result.animation : 'no'),
                    result.ok ? SUCCESS[result.animation] : UI_REFUSALS[result.reason] || UI_REFUSALS.unknown);
            }
            if (!state.game || state.game.id !== intent.gameId || !result.target) {
                return play({ ...state, intent: null }, animationFrames(pal, 'no'), UI_REFUSALS[result.reason] || UI_REFUSALS.offline);
            }
            const ending = result.complete ? { ok: result.ok, animation: result.animation, reason: result.reason, pal: result.pal } : null;
            return { ...state, intent: null, game: { ...state.game, reveal: { guess: intent.side, turn: result.target }, revealTicks: 3, ending } };
        }
        // Something happened on its own (hatched, grew, a gift): show it from the room.
        case 'event':
            if (busy) return { ...state, message: action.message };
            return play({ ...state, mode: 'room', game: null }, animationFrames(ctx.pal, action.animation), action.message);
        case 'message':
            return { ...state, message: action.message };
        default:
            return state;
    }
}

export function screenRows(ui, { pal, now, donuts, reducedMotion }) {
    if (ui.mode === 'anim') return ui.anim.frames[ui.anim.i];
    if (ui.mode === 'food') return drawFoodMenu(ui.cursor);
    if (ui.mode === 'status') return drawStatus(pal, ui.page, { donuts, ms: now });
    if (ui.mode === 'game') return drawGame(pal, ui.game, ui.tick);
    if (ui.mode === 'clock') { const { hour, minute } = aucklandParts(now); return drawClock(hour, minute); }
    return drawRoom(pal, { x: ui.x, tick: ui.tick, ms: now, reducedMotion });
}
