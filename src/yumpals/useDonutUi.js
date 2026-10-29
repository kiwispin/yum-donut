import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { BUTTON_HELP, INITIAL_UI, TICK_MS, donutUiReducer, screenRows } from './donutUi.js';

export function makeOperationId() {
    const raw = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return raw.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 64);
}

// Runs the shared Donut pal controls. `perform(intent)` carries out a care action
// or a game guess and resolves to { ok, animation, reason, pal?, target?, complete? }.
// `now` draws this render; `getNow()` is read when a button is pressed.
export function useDonutUi({ pal, now, getNow, donuts, perform, reducedMotion = false }) {
    const [ui, dispatch] = useReducer(donutUiReducer, INITIAL_UI);
    const latest = useRef({ pal, getNow, donuts, perform, reducedMotion });
    useLayoutEffect(() => { latest.current = { pal, getNow, donuts, perform, reducedMotion }; });
    const send = useCallback((type, extra = {}) => {
        const l = latest.current;
        dispatch({ type, ...extra, ctx: { pal: l.pal, now: l.getNow(), donuts: l.donuts, id: makeOperationId(), random: Math.random(), reducedMotion: l.reducedMotion } });
    }, []);

    useEffect(() => {
        const id = setInterval(() => send('tick'), TICK_MS);
        return () => clearInterval(id);
    }, [send]);

    // Each intent is performed exactly once, even when React runs effects twice.
    const performed = useRef(0);
    const intent = ui.intent;
    useEffect(() => {
        if (!intent || performed.current >= intent.seq) return;
        performed.current = intent.seq;
        Promise.resolve()
            .then(() => latest.current.perform(intent))
            .catch(() => ({ ok: false, reason: 'offline', animation: 'no' }))
            .then(result => send('result', { seq: intent.seq, result: result || { ok: false, reason: 'offline' } }));
    }, [intent, send]);

    return {
        ui,
        rows: screenRows(ui, { pal, now, donuts, reducedMotion }),
        help: BUTTON_HELP[ui.mode] || BUTTON_HELP.room,
        busy: Boolean(ui.intent),
        press: name => send(name),
        pick: index => send('icon', { index }),
        show: (animation, message) => send('event', { animation, message }),
        say: message => send('message', { message }),
    };
}
