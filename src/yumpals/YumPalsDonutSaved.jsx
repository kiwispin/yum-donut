import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { advance, describePal, needsAttention, takeEvents } from './donutPal.js';
import { EVENT_TEXT, TICK_MS } from './donutUi.js';
import { useDonutUi, makeOperationId } from './useDonutUi.js';
import DonutDevice, { HowToPlay } from './DonutDevice.jsx';
import { validName } from './pocketClient.js';
import { markPalVisited } from './visitReminder.js';

// The real Donut pal: the server keeps the pal and decides every action; this
// draws it, runs the same rules between reads so it moves in real time, and sends
// each press as a pocket request. Reads again every minute and on return.
const READ_EVERY_MS = 60000;
const SPECIES = [['mossbit', 'Mossbit'], ['pufflet', 'Pufflet'], ['emberoo', 'Emberoo']];
const GLAZE_NAMES = [['berry', 'Berry'], ['mint', 'Mint'], ['sky', 'Sky'], ['sun', 'Lemon']];
const COLOURS = ['#d94878', '#336699', '#2f9e44', '#e8590c', '#7048e8', '#495057'];
const LOAD_ERRORS = {
    POCKET_NOT_READY: 'The Donut pal is not open yet.',
    UNAUTHENTICATED: 'Please sign in again to see your pal.',
    UNAVAILABLE: 'Your pal could not be reached. Please try again.',
};
const seenKey = uid => `yumpals-donut-seen-${uid}`;
const soundKey = uid => `yumpals-donut-sound-${uid}`;

function giftMessage(view) {
    const parts = [];
    if (view.visit) {
        const { welcomeBack, gains } = view.visit;
        if (welcomeBack) parts.push('Welcome back! A free heart of food and happy.');
        else if (gains.hunger) parts.push('A free gift for visiting today: +1 food.');
        else if (gains.happy) parts.push('A free gift for visiting today: +1 happy.');
        else parts.push('Thanks for visiting today!');
    }
    if (view.cheer) parts.push(view.cheer.gain ? 'Giving a donut cheered your pal up: +1 happy.' : 'Thanks for giving a donut today!');
    return parts.join(' ');
}

function read(storage, key) { try { return storage?.getItem(key) ?? null; } catch { return null; } }
function write(storage, key, value) { try { storage?.setItem(key, value); } catch { /* fine */ } }

function Adopt({ price, balance, busy, onAdopt }) {
    const [name, setName] = useState('');
    const [species, setSpecies] = useState('mossbit');
    const [casing, setCasing] = useState('berry');
    const [color, setColor] = useState(COLOURS[0]);
    const valid = validName(name);
    const enough = balance >= price;
    return (
        <form className="donut-adopt" onSubmit={event => { event.preventDefault(); if (valid && enough && !busy) onAdopt({ name: valid, species, casing, color }); }}>
            <h2 className="donut-pal-name">Adopt a Donut pal</h2>
            <label>Name <input value={name} maxLength={16} onChange={event => setName(event.target.value)} /></label>
            <fieldset><legend>Kind</legend>
                {SPECIES.map(([id, label]) => <label key={id}><input type="radio" name="species" checked={species === id} onChange={() => setSpecies(id)} /> {label}</label>)}
            </fieldset>
            <fieldset><legend>Glaze</legend>
                {GLAZE_NAMES.map(([id, label]) => <label key={id}><input type="radio" name="glaze" checked={casing === id} onChange={() => setCasing(id)} /> {label}</label>)}
            </fieldset>
            <fieldset><legend>Colour</legend>
                {COLOURS.map(c => <label key={c} className="donut-swatch" style={{ '--swatch': c }}>
                    <input type="radio" name="colour" checked={color === c} onChange={() => setColor(c)} aria-label={c} /></label>)}
            </fieldset>
            <button type="submit" disabled={!valid || !enough || busy}>Adopt an egg for {price} donuts</button>
            {!enough && <p>You need {price} donuts to adopt.</p>}
        </form>
    );
}

export default function YumPalsDonutSaved({ ownerUid, transport, storage = globalThis.localStorage }) {
    const [view, setView] = useState(null);
    const [error, setError] = useState(null);
    const [adopting, setAdopting] = useState(false);
    const [sound, setSound] = useState(() => read(storage, soundKey(ownerUid)) === 'on');
    const [pal, setPal] = useState(null);
    const [clock, setClock] = useState(() => Date.now());
    // Latest values for presses and timers; state is for drawing.
    const live = useRef({ view: null, pal: null, skew: 0, giftShown: '', queue: [] });
    const getNow = useCallback(() => Date.now() + live.current.skew, []);

    const device = useDonutUi({
        pal: pal || { stage: 'egg', name: '', species: 'mossbit', hatchAt: Infinity, events: [] },
        now: clock, getNow, donuts: view?.wallet?.available ? view.wallet.balance : 0,
        reducedMotion: Boolean(view?.pal?.reducedMotion) || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        perform: async intent => {
            const request = intent.kind === 'care' ? { operationId: intent.operationId, action: intent.action }
                : { operationId: intent.operationId, action: 'guess', gameId: intent.gameId, round: intent.round, choice: intent.side };
            const reply = await transport.act(ownerUid, request);
            accept(reply.view);
            const { outcome } = reply;
            return { ok: outcome.ok, animation: outcome.animation, reason: outcome.reason, pal: reply.view.pal?.state,
                target: outcome.game?.target, complete: outcome.game?.complete };
        },
    });
    const ui = useRef(device);
    useLayoutEffect(() => { ui.current = device; });
    // Hatching, growing and gifts play one after another, never cutting each other off.
    const enqueue = useCallback((type, message) => { live.current.queue.push([type, message]); }, []);

    // A new server view: adopt its pal and time, and show growth since last time.
    const accept = useCallback(next => {
        live.current.view = next;
        live.current.skew = next.serverNowMs - Date.now();
        live.current.pal = next.pal?.state || null;
        setView(next); setPal(live.current.pal); setError(null);
        if (!next.pal) return;
        const stage = `${next.pal.state.stage}:${next.pal.state.form}`;
        const before = read(storage, seenKey(ownerUid));
        write(storage, seenKey(ownerUid), stage);
        if (before && before !== stage) {
            const grownUp = before.startsWith('egg') ? { type: 'hatched' } : { type: 'grew', stage: next.pal.state.stage, form: next.pal.state.form };
            enqueue(grownUp.type, EVENT_TEXT[grownUp.type](next.pal.state, grownUp));
        }
    }, [enqueue, ownerUid, storage]);

    const load = useCallback(async () => {
        try {
            const next = await transport.read(ownerUid);
            accept(next);
            markPalVisited(ownerUid, next.aucklandDate, Boolean(next.pal));
            const gift = giftMessage(next);
            if (gift && live.current.giftShown !== `${next.aucklandDate}:${gift}`) {
                live.current.giftShown = `${next.aucklandDate}:${gift}`;
                enqueue('happy', gift);
            }
        } catch (failure) {
            if (!live.current.view) setError(failure?.details?.reason || 'UNAVAILABLE');
        }
    }, [accept, enqueue, ownerUid, transport]);

    useEffect(() => {
        void load();
        const visible = () => { if (document.visibilityState === 'visible') void load(); };
        const timer = setInterval(visible, READ_EVERY_MS);
        window.addEventListener('focus', visible);
        document.addEventListener('visibilitychange', visible);
        return () => { clearInterval(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
    }, [load]);

    // Between reads the same rules run here, so the pal moves and hatches on time.
    useEffect(() => {
        const id = setInterval(() => {
            setClock(getNow());
            const current = live.current.pal;
            if (current && live.current.view?.enabled) {
                const caught = takeEvents(advance(current, getNow()));
                if (caught.pal !== current) {
                    live.current.pal = caught.pal; setPal(caught.pal);
                    const shown = [...caught.events].reverse().find(event => event.type !== 'sick');
                    if (shown) {
                        write(storage, seenKey(ownerUid), `${caught.pal.stage}:${caught.pal.form}`);
                        enqueue(shown.type, EVENT_TEXT[shown.type](caught.pal, shown));
                    }
                }
            }
            const { queue } = live.current;
            if (queue.length && ui.current.ui.mode !== 'anim' && !ui.current.busy) ui.current.show(...queue.shift());
        }, TICK_MS);
        return () => clearInterval(id);
    }, [enqueue, getNow, ownerUid, storage]);

    const toggleSound = () => {
        write(storage, soundKey(ownerUid), sound ? 'off' : 'on');
        device.say(sound ? 'Sound off.' : 'Sound on.'); setSound(!sound);
    };

    const adopt = async adoption => {
        setAdopting(true);
        try {
            const reply = await transport.act(ownerUid, { operationId: makeOperationId(), action: 'adopt', adoption });
            accept(reply.view);
            if (!reply.outcome.ok) setError(reply.outcome.reason === 'donuts' ? 'You need more donuts to adopt.' : 'Please try again.');
        } catch { setError('UNAVAILABLE'); } finally { setAdopting(false); }
    };

    if (!view) {
        return <section className="donut-pal donut-status-only"><p className="donut-caption" aria-live="polite">
            {error ? LOAD_ERRORS[error] || LOAD_ERRORS.UNAVAILABLE : 'Loading your pal…'}</p>
            {error && <button type="button" className="donut-retry" onClick={() => { setError(null); void load(); }}>Try again</button>}</section>;
    }
    if (!view.pal || !pal) {
        return <section className="donut-pal">
            <Adopt price={view.prices.adoption} balance={view.wallet.available ? view.wallet.balance : 0} busy={adopting} onAdopt={adopt} />
            {error && <p className="donut-caption" aria-live="polite">{LOAD_ERRORS[error] || error}</p>}
        </section>;
    }
    const caption = !view.enabled ? 'YumPals is resting right now.' : device.ui.message;
    return (
        <DonutDevice name={view.pal.name} glaze={view.pal.casing} rows={device.rows} describe={describePal(pal, clock)} attention={view.enabled && needsAttention(pal, clock)}
            selectedIcon={device.ui.mode === 'room' ? device.ui.selected : -1} help={device.help} caption={caption} sound={sound}
            onPress={device.press} onPick={device.pick} onToggleSound={toggleSound}>
            <HowToPlay />
        </DonutDevice>
    );
}
