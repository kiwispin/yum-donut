import React, { useEffect, useReducer } from 'react';
import PixelDrawing from './PixelDrawing.jsx';
import {
    GAME_ROUNDS, REFUSALS, act, advance, aucklandParts, createDonutPal, describePal, needsAttention, takeEvents,
} from './donutPal.js';
import {
    ICONS, ICON_LABELS, ICON_ORDER, STATUS_PAGES, animationFrames, drawFoodMenu, drawGame, drawRoom, drawStatus, walkRange,
} from './donutPalArt.js';
import './donutPal.css';

// Preview only: the Donut pal runs in this browser, with its own pretend donuts.
// Nothing here talks to the server or spends real donuts.
const STORAGE_KEY = 'yumpals-donut-preview-v1';
const TICK_MS = 450;
const START_DONUTS = 10;
const GLAZES = { berry: '#f48fb1', mint: '#8fe0c4', sky: '#8ecbf5', sun: '#ffd36e' };
const SPECIES = ['mossbit', 'pufflet', 'emberoo'];
const LCD_PALETTE = { '#': '#232b1c', '.': 'rgba(35, 43, 28, 0.07)' };
const SUCCESS = {
    eat: 'Yum!', snack: 'A cupcake treat! 1 donut spent.', happy: 'You won! Your pal is happier.',
    shrug: 'Close! Win 3 of 5 to cheer your pal up.', clean: 'All clean!', medicine: 'All better!',
    lightsOff: 'Lights off. Sleep tight.', lightsOn: 'Lights on.',
};
// Sprinkles sit on the glaze ring around the screen: [left %, top %, turn deg, colour].
const SPRINKLES = [
    [41, 9, 30, 0], [55, 9, -35, 3], [13, 29, 60, 1], [9, 39, -20, 2], [8, 49, 70, 1], [9, 60, 40, 3], [88, 49, -40, 2],
    [87, 60, 20, 1], [83, 69, -60, 0], [18, 76, -70, 0], [78, 76, 25, 3], [48, 89, 10, 1], [58, 88, -30, 2], [38, 88, 50, 0],
];

function loadSaved(realNow) {
    try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved?.pal?.version === 1) return saved;
    } catch { /* fall through to a new egg */ }
    return { pal: createDonutPal({ name: 'Pip', species: 'mossbit', nowMs: realNow }), offset: 0, donuts: START_DONUTS, casing: 'berry' };
}

function initialState(realNow) {
    const saved = loadSaved(realNow);
    return { ...saved, mode: 'room', selected: -1, cursor: 0, page: 0, game: null, anim: null, x: 8, tick: 0, message: '' };
}

function nextMorning(ms) {
    let t = Math.ceil(ms / 3600000) * 3600000;
    while (aucklandParts(t).hour !== 7) t += 3600000;
    return t + 60000;
}

const EVENT_TEXT = {
    hatched: () => 'Your egg hatched!', sick: pal => `${pal.name} feels sick. Try Medicine.`,
    grew: (pal, event) => `${pal.name} grew into ${event.stage === 'adult' ? 'an adult' : 'a child'}!`, napped: pal => `${pal.name} had a good nap.`,
};

function play(state, frames, message) {
    return { ...state, mode: 'anim', anim: { frames, i: 0 }, message };
}

// Catch the pal up to now, and show anything that happened while you were away.
function sync(state, now) {
    const caught = takeEvents(advance(state.pal, now));
    let next = { ...state, pal: caught.pal };
    const shown = [...caught.events].reverse().find(event => event.type !== 'sick') || caught.events.at(-1);
    if (!shown) return next;
    const message = EVENT_TEXT[shown.type](next.pal, shown);
    if (shown.type === 'sick') return { ...next, message };
    if (next.mode === 'game' || next.mode === 'food' || next.mode === 'status') next = { ...next, mode: 'room', game: null };
    return play(next, animationFrames(next.pal, shown.type), message);
}

function apply(state, action, now, extra = {}) {
    const result = act(state.pal, action, { nowMs: now, donuts: state.donuts, ...extra });
    const next = { ...state, pal: result.ok ? result.pal : state.pal, donuts: state.donuts - (result.cost || 0), selected: state.selected };
    return play(next, animationFrames(next.pal, result.animation), result.ok ? SUCCESS[result.animation] : REFUSALS[result.reason]);
}

function runIcon(state, index, now) {
    const icon = ICON_ORDER[index];
    if (icon === 'food') {
        const check = act(state.pal, 'meal', { nowMs: now });
        if (!check.ok && ['egg', 'asleep'].includes(check.reason)) return apply(state, 'meal', now);
        return { ...state, mode: 'food', cursor: 0, message: '' };
    }
    if (icon === 'play') {
        const check = act(state.pal, 'game', { nowMs: now, wins: 0 });
        if (!check.ok) return apply(state, 'game', now);
        return { ...state, mode: 'game', game: { results: [], reveal: null, revealTicks: 0 }, message: 'Which way will your pal turn? A left, B right.' };
    }
    if (icon === 'status') return { ...state, mode: 'status', page: 0, message: '' };
    return apply(state, icon, now);
}

function guess(state, side) {
    if (!state.game || state.game.reveal) return state;
    const turn = Math.random() < 0.5 ? 'left' : 'right';
    return { ...state, game: { ...state.game, reveal: { guess: side, turn }, revealTicks: 3 } };
}

function reducer(state, action) {
    const now = (action.realNow || 0) + state.offset;
    switch (action.type) {
        case 'tick': {
            let next = sync({ ...state, tick: state.tick + 1 }, now);
            if (next.mode === 'anim') {
                const i = next.anim.i + 1;
                next = i >= next.anim.frames.length ? { ...next, mode: 'room', anim: null } : { ...next, anim: { ...next.anim, i } };
            } else if (next.mode === 'game' && next.game.reveal && --next.game.revealTicks <= 0) {
                const { guess: side, turn } = next.game.reveal;
                const results = [...next.game.results, side === turn];
                if (results.length >= GAME_ROUNDS) return apply({ ...next, mode: 'room', game: null }, 'game', now, { wins: results.filter(Boolean).length });
                next = { ...next, game: { results, reveal: null, revealTicks: 0 } };
            } else if (next.mode === 'room' && !action.reducedMotion && !next.pal.sick && !next.pal.sleepy) {
                const r = Math.random();
                const x = Math.max(0, Math.min(walkRange(next.pal), next.x + (r < 0.3 ? -2 : r < 0.6 ? 2 : 0)));
                next = { ...next, x };
            }
            return next;
        }
        case 'A': {
            const next = sync(state, now);
            if (next.mode === 'room') return { ...next, selected: (next.selected + 1) % ICON_ORDER.length, message: '' };
            if (next.mode === 'food') return { ...next, cursor: 1 - next.cursor };
            if (next.mode === 'status') return next.page + 1 >= STATUS_PAGES ? { ...next, mode: 'room' } : { ...next, page: next.page + 1 };
            if (next.mode === 'game') return guess(next, 'left');
            return next;
        }
        case 'B': {
            const next = sync(state, now);
            if (next.mode === 'room') return next.selected < 0 ? next : runIcon(next, next.selected, now);
            if (next.mode === 'food') return apply({ ...next, mode: 'room' }, next.cursor === 0 ? 'meal' : 'snack', now);
            if (next.mode === 'status') return next.page + 1 >= STATUS_PAGES ? { ...next, mode: 'room' } : { ...next, page: next.page + 1 };
            if (next.mode === 'game') return guess(next, 'right');
            return next;
        }
        case 'C': {
            const next = sync(state, now);
            if (next.mode === 'room') return { ...next, selected: -1, message: '' };
            if (next.mode === 'anim') return { ...next, mode: 'room', anim: null };
            return { ...next, mode: 'room', game: null, message: '' };
        }
        case 'icon': {
            const next = sync(state, now);
            if (next.mode !== 'room') return next;
            return next.selected === action.index ? runIcon(next, action.index, now) : { ...next, selected: action.index, message: '' };
        }
        case 'skip': return sync({ ...state, offset: state.offset + action.ms }, now + action.ms);
        case 'morning': {
            const target = nextMorning(now);
            return sync({ ...state, offset: state.offset + (target - now) }, target);
        }
        case 'newEgg':
            return { ...state, pal: createDonutPal({ name: 'Pip', species: action.species, nowMs: now }), mode: 'room', anim: null, game: null, selected: -1, message: 'A new egg! It hatches in a minute.' };
        case 'donuts': return { ...state, donuts: state.donuts + action.add };
        case 'casing': return { ...state, casing: action.value };
        default: return state;
    }
}

function screenRows(state, now) {
    if (state.mode === 'anim') return state.anim.frames[state.anim.i];
    if (state.mode === 'food') return drawFoodMenu(state.cursor);
    if (state.mode === 'status') return drawStatus(state.pal, state.page, { donuts: state.donuts, ms: now });
    if (state.mode === 'game') return drawGame(state.pal, state.game, state.tick);
    return drawRoom(state.pal, { x: state.x, tick: state.tick, ms: now, reducedMotion: state.reducedMotion });
}

const BUTTON_HELP = {
    room: ['A: next icon', 'B: use icon', 'C: cancel'], food: ['A: switch food', 'B: eat it', 'C: back'],
    status: ['A: next page', 'B: next page', 'C: back'], game: ['A: guess left', 'B: guess right', 'C: stop playing'],
    anim: ['A', 'B', 'C: skip'],
};

function ignoreKey(event) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return true;
    const target = event.target;
    if (target?.closest?.('input,select,textarea,[contenteditable="true"],details,.donut-tools')) return true;
    return Boolean(target?.closest?.('button') && ['Enter', ' '].includes(event.key));
}

const KEYS = { a: 'A', arrowright: 'A', arrowdown: 'A', b: 'B', enter: 'B', ' ': 'B', c: 'C', escape: 'C', backspace: 'C' };

function Icon({ id, index, selected, onPick }) {
    return (
        <button type="button" className={`donut-icon${selected ? ' is-selected' : ''}`} aria-pressed={selected}
            aria-label={ICON_LABELS[id]} title={ICON_LABELS[id]} onClick={() => onPick(index)}>
            <span className="donut-icon-pixels"><PixelDrawing pixels={ICONS[id]} palette={{ '#': '#232b1c' }} /></span>
        </button>
    );
}

export default function YumPalsDonutPreview() {
    const [state, dispatch] = useReducer(reducer, Date.now(), initialState);
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        const id = setInterval(() => dispatch({ type: 'tick', realNow: Date.now(), reducedMotion }), TICK_MS);
        return () => clearInterval(id);
    }, [reducedMotion]);

    useEffect(() => {
        const onKey = event => {
            const press = KEYS[event.key.toLowerCase()];
            if (!press || ignoreKey(event)) return;
            event.preventDefault();
            dispatch({ type: press, realNow: Date.now() });
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const { pal, offset, donuts, casing } = state;
    useEffect(() => {
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pal, offset, donuts, casing })); } catch { /* preview still works */ }
    }, [pal, offset, donuts, casing]);

    const now = Date.now() + offset;
    const rows = screenRows({ ...state, reducedMotion }, now);
    const attention = needsAttention(pal, now);
    const help = BUTTON_HELP[state.mode];
    const press = type => dispatch({ type, realNow: Date.now() });
    const pick = index => dispatch({ type: 'icon', index, realNow: Date.now() });
    const clock = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(now);

    return (
        <section className="donut-pal" style={{ '--glaze': GLAZES[casing] || GLAZES.berry }} aria-label={`${pal.name}, your Donut pal`}>
            <h2 className="donut-pal-name">{pal.name}</h2>
            <div className="donut-device">
                <span className="donut-loop" aria-hidden="true" />
                <div className="donut-body" aria-hidden="true">
                    <span className="donut-glaze" />
                    {SPRINKLES.map(([left, top, turn, colour]) => (
                        <span key={`${left}-${top}`} className={`donut-sprinkle c${colour}`} style={{ left: `${left}%`, top: `${top}%`, transform: `rotate(${turn}deg)` }} />
                    ))}
                    <span className="donut-shine" />
                </div>
                <span className={`donut-led${attention ? ' is-on' : ''}`} role="status" aria-label={attention ? `${pal.name} needs you` : `${pal.name} is fine`} />
                <div className="donut-screen">
                    <div className="donut-glass">
                        <div className="donut-icons">
                            {ICON_ORDER.slice(0, 3).map((id, i) => <Icon key={id} id={id} index={i} selected={state.mode === 'room' && state.selected === i} onPick={pick} />)}
                        </div>
                        <div className="donut-lcd" role="img" aria-label={describePal(pal, now)}>
                            <PixelDrawing pixels={rows} palette={LCD_PALETTE} />
                        </div>
                        <div className="donut-icons">
                            {ICON_ORDER.slice(3).map((id, i) => <Icon key={id} id={id} index={i + 3} selected={state.mode === 'room' && state.selected === i + 3} onPick={pick} />)}
                        </div>
                    </div>
                </div>
                <div className="donut-buttons">
                    {['A', 'B', 'C'].map((name, i) => (
                        <button key={name} type="button" className="donut-button" aria-label={help[i]} title={help[i]} onClick={() => press(name)}>{name}</button>
                    ))}
                </div>
            </div>
            <p className="donut-caption" aria-live="polite">{state.message}</p>
            <details className="donut-help">
                <summary>How to play</summary>
                <ul>
                    <li><b>A</b> picks an icon, <b>B</b> uses it, <b>C</b> goes back. You can also tap an icon, then tap it again.</li>
                    <li><b>Food:</b> meals are free. A cupcake treat costs 1 donut (up to 3 a day).</li>
                    <li><b>Play:</b> guess which way your pal turns. Win 3 of 5 to cheer it up.</li>
                    <li><b>Clean</b> up messes, give <b>Medicine</b> when it is sick, and use <b>Lights</b> for a nap when it is sleepy.</li>
                    <li><b>Status</b> shows age, food, happy and your donuts.</li>
                    <li>The light on the donut blinks when your pal needs you.</li>
                    <li>Care for it on school days and it grows: egg, baby, child, adult. A sick pal waits to grow, but never gets worse than sick.</li>
                </ul>
            </details>
            <div className="donut-tools">
                <p className="donut-tools-title">Preview only (pretend donuts, nothing saved to the server)</p>
                <p className="donut-tools-clock">Pal time: {clock} · {pal.stage} · {donuts} pretend donuts</p>
                <div className="donut-tools-row">
                    <button type="button" onClick={() => dispatch({ type: 'skip', ms: 3600000, realNow: Date.now() })}>+1 hour</button>
                    <button type="button" onClick={() => dispatch({ type: 'skip', ms: 6 * 3600000, realNow: Date.now() })}>+6 hours</button>
                    <button type="button" onClick={() => dispatch({ type: 'morning', realNow: Date.now() })}>Next morning</button>
                    <button type="button" onClick={() => dispatch({ type: 'donuts', add: 5 })}>+5 donuts</button>
                </div>
                <div className="donut-tools-row">
                    {SPECIES.map(species => <button key={species} type="button" onClick={() => dispatch({ type: 'newEgg', species, realNow: Date.now() })}>New {species} egg</button>)}
                    <label>Glaze <select value={casing} onChange={event => dispatch({ type: 'casing', value: event.target.value })}>
                        {Object.keys(GLAZES).map(name => <option key={name} value={name}>{name}</option>)}
                    </select></label>
                </div>
            </div>
        </section>
    );
}
