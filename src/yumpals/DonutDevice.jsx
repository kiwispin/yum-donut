import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Gamepad2, Sprout, Utensils } from 'lucide-react';
import PixelDrawing from './PixelDrawing.jsx';
import { ICONS, ICON_LABELS, ICON_ORDER } from './donutPalArt.js';
import { CARDS, GLAZES } from './donutUi.js';
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-700.css';
import './donutPal.css';

// The Donut pal handheld itself: glazed donut case, dot-matrix screen, six care
// icons, the attention light and the A/B/C buttons, with keyboard keys, hold C +
// press A for sound, and beeps. Shared by the preview and the real handheld.
// It is shown like a toy on its retail card: a hang tab, the donut in a clear
// plastic bubble, a name sticker, a starburst that follows the pal's stage, and
// feature badges. Our own packaging, not any real toy's.
const LCD_PALETTE = { '#': '#232b1c', '.': 'rgba(35, 43, 28, 0.07)' };
// Sprinkles sit on the glaze ring around the screen: [left %, top %, turn deg, colour].
const SPRINKLES = [
    [41, 9, 30, 0], [55, 9, -35, 3], [13, 29, 60, 1], [9, 39, -20, 2], [8, 49, 70, 1], [9, 60, 40, 3], [88, 49, -40, 2],
    [87, 60, 20, 1], [83, 69, -60, 0], [18, 76, -70, 0], [78, 76, 25, 3], [48, 89, 10, 1], [58, 88, -30, 2], [38, 88, 50, 0],
];
const ICON_NAMES = new Set(Object.values(ICON_LABELS));
const BURST = { egg: 'Hatching!', baby: 'New pal!', child: 'Growing!', teen: 'Teen pal!', adult: 'All grown!' };
const STAR = '50,2 60,30 90,16 72,44 98,58 66,64 74,96 50,74 26,96 34,64 2,58 28,44 10,16 40,30';
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

export default function DonutDevice({ name, glaze, stage, rows, describe, attention, selectedIcon, help, caption, sound, onPress, onPick, onToggleSound, children }) {
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
        if (sound && /hatched|grew/i.test(caption)) beep(BEEPS.tune);
    }, [caption, sound]);

    const press = button => {
        if (sound) beep(BEEPS.press);
        if (button === 'A' && (cPointers.current.size > 0 || cKey.current)) onToggleSound(); else onPress(button);
    };

    return (
        <section className="donut-pal" style={{ '--glaze': GLAZES[glaze] || GLAZES.berry, '--card': CARDS[glaze] || CARDS.berry }} aria-label={`${name}, your Donut pal`}>
            <div className="pack-card">
            <span className="pack-hang" aria-hidden="true" />
            <p className="pack-brand" aria-hidden="true">YumPals</p>
            <p className="pack-sub" aria-hidden="true">Your pocket Donut pal</p>
            <div className="pack-bubble">
            <span className="pack-shine" aria-hidden="true" />
            <h2 className="donut-pal-name">{name}</h2>
            {BURST[stage] && <span className="pack-burst" aria-hidden="true">
                <svg viewBox="0 0 100 100"><polygon points={STAR} /></svg><span>{BURST[stage]}</span></span>}
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
            </div>
            {/* One short line, like a label on the card; an icon name gets a pointer. */}
            <p className={`donut-caption${caption ? '' : ' is-empty'}${ICON_NAMES.has(caption) ? ' is-pick' : ''}`} aria-live="polite">{caption}</p>
            <ul className="pack-feats" aria-hidden="true">
                <li><Utensils size={18} />Feed it!</li><li><Gamepad2 size={18} />Play!</li><li><Sprout size={18} />Watch it grow!</li>
            </ul>
            </div>
            {children}
        </section>
    );
}

function Btn({ children }) {
    return <span className="manual-btn">{children}</span>;
}

function Step({ n, icon, title, children }) {
    return (
        <li className="box-step">
            <span className="box-num" aria-hidden="true">{n}</span>
            {icon && <span className="box-icon" aria-hidden="true"><PixelDrawing pixels={ICONS[icon]} palette={{ '#': '#3b2f45' }} /></span>}
            <div><h3>{title}</h3><p>{children}</p></div>
        </li>
    );
}

// How to play, written like the back of a toy's box.
export function HowToPlay() {
    return (
        <details className="donut-help box-back">
            <summary className="box-tab"><span>How to play</span><span className="box-tab-note" aria-hidden="true">Back of the box</span></summary>
            <ol className="box-steps">
                <Step n={1} title="The buttons"><Btn>A</Btn> picks an icon, <Btn>B</Btn> uses it, <Btn>C</Btn> goes back. Or tap an icon, then tap it again. <Btn>B</Btn> on its own shows the clock.</Step>
                <Step n={2} icon="food" title="Feed it">Meals are free. A cupcake treat costs 1 donut (up to 3 a day) and adds weight.</Step>
                <Step n={3} icon="play" title="Play left or right">Guess which way your pal turns: <Btn>A</Btn> left, <Btn>B</Btn> right. Win 3 of 5 to cheer it up. Games burn off weight.</Step>
                <Step n={4} icon="medicine" title="Keep it well"><b>Clean</b> up messes and give <b>Medicine</b> when it is sick (sometimes 2 or 3 doses). Sleepy? Turn the <b>Lights</b> off for a nap. From 9pm to 7am it sleeps.</Step>
                <Step n={5} icon="status" title="Watch it grow">Egg, baby, child, teen, adult. Few care mistakes and it grows into a well-raised adult; lots, and it turns out scruffy. It never gets worse than sick. <b>Status</b> shows how it is doing.</Step>
            </ol>
            <aside className="box-tip">
                <b>Top tip!</b>
                The light on the donut blinks when your pal needs you. Hold <Btn>C</Btn> and press <Btn>A</Btn> to turn beeps on or off.
            </aside>
        </details>
    );
}
