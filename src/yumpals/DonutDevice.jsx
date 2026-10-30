import React, { useEffect, useLayoutEffect, useRef } from 'react';
import PixelDrawing from './PixelDrawing.jsx';
import { ICONS, ICON_LABELS, ICON_ORDER } from './donutPalArt.js';
import { GLAZES } from './donutUi.js';
import '@fontsource/press-start-2p/latin-400.css';
import './donutPal.css';

// The Donut pal handheld itself: glazed donut case, dot-matrix screen, six care
// icons, the attention light and the A/B/C buttons, with keyboard keys, hold C +
// press A for sound, and beeps. Shared by the preview and the real handheld.
const LCD_PALETTE = { '#': '#232b1c', '.': 'rgba(35, 43, 28, 0.07)' };
// Sprinkles sit on the glaze ring around the screen: [left %, top %, turn deg, colour].
const SPRINKLES = [
    [41, 9, 30, 0], [55, 9, -35, 3], [13, 29, 60, 1], [9, 39, -20, 2], [8, 49, 70, 1], [9, 60, 40, 3], [88, 49, -40, 2],
    [87, 60, 20, 1], [83, 69, -60, 0], [18, 76, -70, 0], [78, 76, 25, 3], [48, 89, 10, 1], [58, 88, -30, 2], [38, 88, 50, 0],
];
const ICON_NAMES = new Set(Object.values(ICON_LABELS));
const KEYS = { a: 'A', arrowright: 'A', arrowdown: 'A', b: 'B', enter: 'B', ' ': 'B', c: 'C', escape: 'C', backspace: 'C' };

function ignoreKey(event) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return true;
    const target = event.target;
    if (target?.closest?.('input,select,textarea,[contenteditable="true"],details,[role="dialog"],.donut-tools,.donut-adopt')) return true;
    return Boolean(target?.closest?.('button') && ['Enter', ' '].includes(event.key));
}

// Short square-wave beeps, like a pocket pet's buzzer. Off unless switched on.
let audio = null;
function beep(pattern) {
    try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        let at = audio.currentTime;
        for (const [freq, ms] of pattern) {
            const osc = audio.createOscillator(); const gain = audio.createGain();
            osc.type = 'square'; osc.frequency.value = freq; gain.gain.value = 0.04;
            osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at + ms / 1000);
            at += ms / 1000 + 0.04;
        }
    } catch { /* no sound available */ }
}
const BEEPS = { press: [[2200, 35]], call: [[2600, 90], [2600, 90], [2600, 90]], tune: [[1800, 80], [2200, 80], [2600, 140]] };

function Icon({ id, index, selected, onPick }) {
    return (
        <button type="button" className={`donut-icon${selected ? ' is-selected' : ''}`} aria-pressed={selected}
            aria-label={ICON_LABELS[id]} title={ICON_LABELS[id]} onClick={() => onPick(index)}>
            <span className="donut-icon-pixels"><PixelDrawing pixels={ICONS[id]} palette={{ '#': '#232b1c' }} /></span>
        </button>
    );
}

export default function DonutDevice({ name, glaze, rows, describe, attention, selectedIcon, help, caption, sound, onPress, onPick, onToggleSound, children }) {
    // C is "held" while a pointer is down on it or the C key is down.
    const cPointers = useRef(new Set());
    const cKey = useRef(false);
    const handlers = useRef({ onPress, onToggleSound });
    useLayoutEffect(() => { handlers.current = { onPress, onToggleSound }; });

    useEffect(() => {
        const onKey = event => {
            const press = KEYS[event.key.toLowerCase()];
            if (!press || ignoreKey(event)) return;
            event.preventDefault();
            const toggle = press === 'A' && (cPointers.current.size > 0 || cKey.current);
            if (press === 'C') cKey.current = true;
            if (toggle) handlers.current.onToggleSound(); else handlers.current.onPress(press);
        };
        const onKeyUp = event => { if (KEYS[event.key.toLowerCase()] === 'C') cKey.current = false; };
        const release = event => cPointers.current.delete(event.pointerId);
        const reset = () => { cPointers.current.clear(); cKey.current = false; };
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        window.addEventListener('blur', reset);
        return () => {
            window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release);
            window.removeEventListener('blur', reset);
        };
    }, []);

    // Beep when your pal starts calling, and a little tune when it hatches or grows.
    const calling = useRef(attention);
    useEffect(() => {
        if (sound && attention && !calling.current) beep(BEEPS.call);
        calling.current = attention;
    }, [attention, sound]);
    useEffect(() => {
        if (sound && /hatched|grew/.test(caption)) beep(BEEPS.tune);
    }, [caption, sound]);

    const press = button => {
        if (sound) beep(BEEPS.press);
        if (button === 'A' && (cPointers.current.size > 0 || cKey.current)) onToggleSound(); else onPress(button);
    };

    return (
        <section className="donut-pal" style={{ '--glaze': GLAZES[glaze] || GLAZES.berry }} aria-label={`${name}, your Donut pal`}>
            <h2 className="donut-pal-name">{name}</h2>
            <div className="donut-device">
                <span className="donut-loop" aria-hidden="true" />
                <div className="donut-body" aria-hidden="true">
                    <span className="donut-glaze" />
                    {SPRINKLES.map(([left, top, turn, colour]) => (
                        <span key={`${left}-${top}`} className={`donut-sprinkle c${colour}`} style={{ left: `${left}%`, top: `${top}%`, transform: `rotate(${turn}deg)` }} />
                    ))}
                    <span className="donut-shine" />
                </div>
                <span className={`donut-led${attention ? ' is-on' : ''}`} role="status" aria-label={attention ? `${name} needs you` : `${name} is fine`} />
                <div className="donut-screen">
                    <div className="donut-glass">
                        <div className="donut-icons">
                            {ICON_ORDER.slice(0, 3).map((id, i) => <Icon key={id} id={id} index={i} selected={selectedIcon === i} onPick={onPick} />)}
                        </div>
                        <div className="donut-lcd" role="img" aria-label={describe}>
                            <PixelDrawing pixels={rows} palette={LCD_PALETTE} />
                        </div>
                        <div className="donut-icons">
                            {ICON_ORDER.slice(3).map((id, i) => <Icon key={id} id={id} index={i + 3} selected={selectedIcon === i + 3} onPick={onPick} />)}
                        </div>
                    </div>
                </div>
                <div className="donut-buttons">
                    {['A', 'B', 'C'].map((button, i) => (
                        <button key={button} type="button" className="donut-button" aria-label={help[i]} title={help[i]} onClick={() => press(button)}
                            {...(button === 'C' ? { onPointerDown: event => cPointers.current.add(event.pointerId) } : {})}>{button}</button>
                    ))}
                </div>
            </div>
            {/* A game-style dialog box; an icon name gets a pointer in front. */}
            <p className={`donut-caption${caption ? '' : ' is-empty'}${ICON_NAMES.has(caption) ? ' is-pick' : ''}`} aria-live="polite">{caption}</p>
            {children}
        </section>
    );
}

function Btn({ children }) {
    return <span className="manual-btn" aria-label={`${children} button`}>{children}</span>;
}

// How to play, laid out like a page from an old game manual.
export function HowToPlay() {
    return (
        <details className="donut-help manual">
            <summary className="manual-bar"><span>How to play</span><span aria-hidden="true">P.1</span></summary>
            <section className="manual-sec">
                <h3><span className="manual-num">1</span>The buttons</h3>
                <p><Btn>A</Btn> picks an icon, <Btn>B</Btn> uses it, <Btn>C</Btn> goes back. You can also tap an icon, then tap it again. <Btn>B</Btn> on its own shows the clock.</p>
            </section>
            <section className="manual-sec">
                <h3><span className="manual-num">2</span>Feed your pal</h3>
                <p>Meals are free. A cupcake treat costs 1 donut (up to 3 a day) and adds weight. <b>Status</b> shows age and weight, food, happy, and your donuts.</p>
            </section>
            <section className="manual-sec">
                <h3><span className="manual-num">3</span>Left or right?</h3>
                <p>Guess which way your pal turns: <Btn>A</Btn> left, <Btn>B</Btn> right. Win 3 of 5 to cheer it up. Games burn off weight and keep going until you press <Btn>C</Btn>.</p>
            </section>
            <section className="manual-sec">
                <h3><span className="manual-num">4</span>Keep it well</h3>
                <p><b>Clean</b> up messes. Give <b>Medicine</b> when it is sick (sometimes it needs 2 or 3 doses). Sleepy? Turn the <b>Lights</b> off for a nap. At night (9pm to 7am) it sleeps, and only Lights and Status work.</p>
            </section>
            <section className="manual-sec">
                <h3><span className="manual-num">5</span>Watch it grow</h3>
                <p>Care for it on school days and it grows: egg, baby, child, teen, adult. Few care mistakes (leaving it hungry, sad or sick) and it grows into a well-raised adult; lots, and it turns out scruffy. It never gets worse than sick.</p>
            </section>
            <aside className="manual-tip">
                <b>Pro tip!</b>
                The light on the donut blinks when your pal needs you. Check <b>Status</b> to see why. Hold <Btn>C</Btn> and press <Btn>A</Btn> to turn beeps on or off.
            </aside>
        </details>
    );
}
