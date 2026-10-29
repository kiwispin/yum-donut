import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GAME_ROUNDS, act, advance, aucklandParts, createDonutPal, describePal, needsAttention, takeEvents } from './donutPal.js';
import { EVENT_TEXT, GLAZES, TICK_MS } from './donutUi.js';
import { useDonutUi } from './useDonutUi.js';
import DonutDevice, { HowToPlay } from './DonutDevice.jsx';

// Preview only: the Donut pal runs in this browser, with its own pretend donuts.
// Nothing here talks to the server or spends real donuts.
const STORAGE_KEY = 'yumpals-donut-preview-v2';
const START_DONUTS = 10;
const SPECIES = ['mossbit', 'pufflet', 'emberoo'];

function loadSaved() {
    try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved?.pal?.version === 2) return saved;
    } catch { /* fall through to a new egg */ }
    return { pal: createDonutPal({ name: 'Pip', species: 'mossbit', nowMs: Date.now() }), offset: 0, donuts: START_DONUTS, casing: 'berry', sound: false };
}

function nextMorning(ms) {
    let t = Math.ceil(ms / 3600000) * 3600000;
    while (aucklandParts(t).hour !== 7) t += 3600000;
    return t + 60000;
}

export default function YumPalsDonutPreview() {
    const [saved] = useState(loadSaved);
    const [pal, setPal] = useState(saved.pal);
    const [offset, setOffset] = useState(saved.offset);
    const [donuts, setDonuts] = useState(saved.donuts);
    const [casing, setCasing] = useState(saved.casing);
    const [sound, setSound] = useState(saved.sound);
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // The latest values for button presses and timers (state is for drawing).
    const live = useRef({ pal: saved.pal, offset: saved.offset, donuts: saved.donuts });
    useLayoutEffect(() => { live.current.donuts = donuts; }, [donuts]);
    const getNow = () => Date.now() + live.current.offset;
    const commitPal = next => { live.current.pal = next; setPal(next); };

    // The local stand-in for the server.
    const perform = async intent => {
        const now = getNow(); const current = live.current.pal;
        if (intent.kind === 'care') {
            const result = act(current, intent.action, { nowMs: now, donuts: live.current.donuts });
            const next = takeEvents(result.pal).pal;
            if (result.ok) { commitPal(next); setDonuts(d => d - (result.cost || 0)); }
            return { ...result, pal: next };
        }
        const target = Math.random() < 0.5 ? 'left' : 'right';
        if (intent.round < GAME_ROUNDS - 1) return { ok: true, target, complete: false };
        const result = act(current, 'game', { nowMs: now, wins: intent.winsSoFar + (intent.side === target ? 1 : 0) });
        const next = takeEvents(result.pal).pal;
        if (result.ok) commitPal(next);
        return { ...result, pal: next, target, complete: true };
    };

    const now = Date.now() + offset;
    const device = useDonutUi({ pal, now, getNow, donuts, perform, reducedMotion });

    // Time passes: catch the pal up and show anything that happened.
    const showEvent = useRef(device);
    useLayoutEffect(() => { showEvent.current = device; });
    useEffect(() => {
        const id = setInterval(() => {
            const caught = takeEvents(advance(live.current.pal, getNow()));
            if (caught.pal === live.current.pal) return;
            commitPal(caught.pal);
            const shown = [...caught.events].reverse().find(event => event.type !== 'sick') || caught.events.at(-1);
            if (!shown) return;
            const message = EVENT_TEXT[shown.type](caught.pal, shown);
            if (shown.type === 'sick') showEvent.current.say(message); else showEvent.current.show(shown.type, message);
        }, TICK_MS);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pal, offset, donuts, casing, sound })); } catch { /* preview still works */ }
    }, [pal, offset, donuts, casing, sound]);

    const skip = ms => { live.current.offset += ms; setOffset(live.current.offset); };
    const clock = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(now);

    return (
        <DonutDevice name={pal.name} glaze={casing} rows={device.rows} describe={describePal(pal, now)} attention={needsAttention(pal, now)}
            selectedIcon={device.ui.mode === 'room' ? device.ui.selected : -1} help={device.help} caption={device.ui.message} sound={sound}
            onPress={device.press} onPick={device.pick}
            onToggleSound={() => { device.say(sound ? 'Sound off.' : 'Sound on.'); setSound(!sound); }}>
            <HowToPlay />
            <div className="donut-tools">
                <p className="donut-tools-title">Preview only (pretend donuts, nothing saved to the server)</p>
                <p className="donut-tools-clock">Pal time: {clock} · {pal.stage}{pal.form ? ` (${pal.form})` : ''} · {donuts} pretend donuts · care mistakes {pal.mistakes} · sound {sound ? 'on' : 'off'}</p>
                <div className="donut-tools-row">
                    <button type="button" onClick={() => skip(3600000)}>+1 hour</button>
                    <button type="button" onClick={() => skip(6 * 3600000)}>+6 hours</button>
                    <button type="button" onClick={() => skip(nextMorning(now) - now)}>Next morning</button>
                    <button type="button" onClick={() => setDonuts(d => d + 5)}>+5 donuts</button>
                </div>
                <div className="donut-tools-row">
                    {SPECIES.map(species => <button key={species} type="button" onClick={() => {
                        commitPal(createDonutPal({ name: 'Pip', species, nowMs: getNow() }));
                        device.press('C'); device.say('A new egg! It hatches in about 5 minutes.');
                    }}>New {species} egg</button>)}
                    <label>Glaze <select value={casing} onChange={event => setCasing(event.target.value)}>
                        {Object.keys(GLAZES).map(name => <option key={name} value={name}>{name}</option>)}
                    </select></label>
                </div>
            </div>
        </DonutDevice>
    );
}
