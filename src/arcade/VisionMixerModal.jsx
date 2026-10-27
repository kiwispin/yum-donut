import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { XCircle } from 'lucide-react';
import {
    VISION_MIXER_CAMERAS, VISION_MIXER_GAP_MS, VISION_MIXER_LIVES, VISION_MIXER_STAGE_TAKES, VISION_MIXER_TARGET_TAKES,
    nextCall, visionMixerInitialState, visionMixerPrize, visionMixerReducer, visionMixerStage
} from './visionMixer.js';

const FEEDBACK = {
    hit: { text: 'Clean cut!', className: 'text-emerald-300' },
    wrong: { text: 'Wrong camera!', className: 'text-red-400' },
    early: { text: 'Too early. Wait for TAKE.', className: 'text-red-400' },
    missed: { text: 'Missed the take!', className: 'text-red-400' },
    'cut-on-hold': { text: 'You cut on a hold!', className: 'text-red-400' },
    held: { text: 'Good hold.', className: 'text-emerald-300' }
};

function talkbackFor(call, feedback) {
    switch (call?.phase) {
        case 'decoy': return { text: `Ready Cam ${call.decoy}…`, className: 'text-amber-300' };
        case 'ready': return call.decoy
            ? { text: `No, Ready Cam ${call.camera}!`, className: 'text-amber-300' }
            : { text: `Ready Cam ${call.camera}…`, className: 'text-amber-300' };
        case 'take': return { text: call.numbered ? `TAKE ${call.camera}!` : 'TAKE!', className: 'text-red-400 text-3xl motion-safe:animate-pulse' };
        case 'hold': return { text: 'HOLD!', className: 'text-sky-300 text-3xl' };
        default: return feedback ? FEEDBACK[feedback] : { text: '', className: '' };
    }
}

export default function VisionMixerModal({ user, lastPlayed, onWin, onClose }) {
    const today = new Date().toDateString();
    const lockKey = `vision_mixer_lock_${user?.uid}_${today}`;
    const [localLock, setLocalLock] = useState(() => {
        try { return localStorage.getItem(lockKey) === 'true'; } catch { return false; }
    });
    const [state, dispatch] = useReducer(visionMixerReducer, visionMixerInitialState);
    const [wonPrize, setWonPrize] = useState(1);
    const rewarded = useRef(false);

    const lastPlayedDate = lastPlayed ? lastPlayed.toDate().toDateString() : null;
    const hasPlayedToday = lastPlayedDate === today || localLock;
    const { status, call, round, hits, lives, live, feedback } = state;
    const phase = call?.phase;

    const startGame = () => {
        if (hasPlayedToday) return;
        rewarded.current = false;
        dispatch({ type: 'start', call: nextCall(1, 0) });
    };
    const press = useCallback(camera => dispatch({ type: 'press', camera }), []);

    // Drive (decoy →) Ready → Take/Hold → gap → next call, one timer per phase.
    useEffect(() => {
        if (status !== 'playing' || !call) return undefined;
        const delays = { decoy: [call.decoyMs, 'advance'], ready: [call.readyMs, 'advance'], take: [call.takeMs, 'timeout'], hold: [call.holdMs, 'timeout'] };
        const timerId = phase === 'gap'
            ? setTimeout(() => dispatch({ type: 'next', round, call: nextCall(live, hits) }), VISION_MIXER_GAP_MS)
            : setTimeout(() => dispatch({ type: delays[phase][1], round }), delays[phase][0]);
        return () => clearTimeout(timerId);
    }, [status, phase, round, call, live, hits]);

    useEffect(() => {
        if (status !== 'won' || rewarded.current) return;
        rewarded.current = true;
        const prizeAmount = visionMixerPrize(VISION_MIXER_LIVES - lives);
        setWonPrize(prizeAmount);
        setLocalLock(true);
        try { localStorage.setItem(lockKey, 'true'); } catch { /* lock still applies through lastPlayed */ }
        onWin({
            type: 'donut',
            amount: prizeAmount,
            label: prizeAmount === 2 ? 'Vision Mixer Perfect Show' : 'Vision Mixer Win',
            icon: '🎛️'
        });
    }, [status, lives, lockKey, onWin]);

    useEffect(() => {
        if (status !== 'playing') return undefined;
        const onKey = event => {
            const camera = Number(event.key);
            if (VISION_MIXER_CAMERAS.some(item => item.id === camera)) { event.preventDefault(); press(camera); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [status, press]);

    const onAir = VISION_MIXER_CAMERAS.find(camera => camera.id === live);
    const talkback = talkbackFor(call, feedback);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <style>{'@keyframes vision-mixer-drain { from { width: 100%; } to { width: 0%; } }'}</style>
            <div className="relative w-full max-w-md bg-slate-900 rounded-2xl border-4 border-red-500 shadow-2xl p-6 flex flex-col items-center" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-5 px-8">
                    <h2 className="text-3xl font-black text-white tracking-tighter mb-1">VISION MIXER</h2>
                    <p className="text-red-300 text-xs font-bold uppercase tracking-widest">Cut to camera on cue</p>
                </div>

                {status === 'start' && (
                    <div className="w-full text-center">
                        <div className="grid grid-cols-4 gap-2 mb-5 opacity-70">
                            {VISION_MIXER_CAMERAS.map(camera => (
                                <div key={camera.id} className="aspect-square rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center">
                                    <span className="text-2xl">{camera.scene}</span>
                                    <span className="text-[10px] font-bold text-slate-400 mt-1">CAM {camera.id}</span>
                                </div>
                            ))}
                        </div>

                        {hasPlayedToday ? (
                            <div className="bg-slate-800 px-6 py-3 rounded-lg border border-slate-700 font-mono text-red-400">
                                DAILY LIMIT REACHED
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm font-bold text-slate-300 text-left space-y-1">
                                    <p>The director calls <span className="text-amber-300">READY</span>, then <span className="text-red-400">TAKE</span>. Cut on TAKE, not before.</p>
                                    <p>It gets faster. From take {VISION_MIXER_STAGE_TAKES[0]}, TAKE has no number and the director may change their mind. From take {VISION_MIXER_STAGE_TAKES[1]}, some calls end in <span className="text-sky-300">HOLD</span>: don't cut.</p>
                                    <p>{VISION_MIXER_TARGET_TAKES} clean takes for 1 donut. No mistakes for 2.</p>
                                </div>
                                <button
                                    onClick={startGame}
                                    className="w-full bg-red-500 hover:bg-red-400 text-white font-black py-4 rounded-xl shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all"
                                >
                                    START THE SHOW
                                </button>
                                <p className="text-xs text-slate-500">Keys 1–4 work too.</p>
                            </div>
                        )}
                    </div>
                )}

                {status !== 'start' && (
                    <>
                        <div className="w-full flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                            <span>Takes: {hits}/{VISION_MIXER_TARGET_TAKES}</span>
                            <span>Stage {visionMixerStage(hits)}</span>
                            <span aria-label={`${lives} of ${VISION_MIXER_LIVES} lives left`}>
                                {Array.from({ length: VISION_MIXER_LIVES }, (_, n) => (n < lives ? '❤️' : '🖤')).join(' ')}
                            </span>
                        </div>

                        <div className="w-full rounded-xl border-4 border-red-500 bg-black mb-3 relative overflow-hidden">
                            <span className="absolute top-2 left-2 text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded">ON AIR</span>
                            <span className="absolute top-2 right-2 text-[10px] font-bold text-slate-400">PGM · CAM {onAir.id}</span>
                            <div className="h-28 flex flex-col items-center justify-center">
                                <span className="text-5xl">{onAir.scene}</span>
                                <span className="text-xs font-bold text-slate-300 mt-1">{onAir.name}</span>
                            </div>
                        </div>

                        <div className="w-full h-14 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center mb-3 px-3 relative overflow-hidden">
                            <span className="absolute top-1 left-2 text-[9px] font-bold text-slate-500 uppercase">Talkback</span>
                            <p role="status" aria-live="polite" className={`font-black text-xl ${talkback.className}`}>{talkback.text}</p>
                            {(phase === 'take' || phase === 'hold') && (
                                <div key={round} className={`absolute bottom-0 left-0 h-1 ${phase === 'hold' ? 'bg-sky-400' : 'bg-red-500'}`} style={{ animation: `vision-mixer-drain ${phase === 'hold' ? call.holdMs : call.takeMs}ms linear forwards` }} />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 w-full">
                            {VISION_MIXER_CAMERAS.map(camera => (
                                <button
                                    key={camera.id}
                                    type="button"
                                    onClick={() => press(camera.id)}
                                    disabled={status !== 'playing'}
                                    aria-label={`Camera ${camera.id}, ${camera.name}`}
                                    className={`rounded-xl border-2 py-3 flex flex-col items-center justify-center ${camera.id === live
                                        ? 'bg-red-500/15 border-red-500'
                                        : 'bg-slate-800 border-slate-600 hover:border-slate-400 active:bg-slate-700'
                                        }`}
                                >
                                    <span className="text-3xl">{camera.scene}</span>
                                    <span className="text-sm font-black text-white mt-1">CAM {camera.id}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{camera.name}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {status === 'won' && (
                    <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center rounded-2xl z-10 p-6 text-center animate-in zoom-in">
                        <div className="text-6xl mb-4">🎛️</div>
                        <h3 className="text-2xl font-bold text-white mb-2">THAT'S A WRAP!</h3>
                        <p className="text-red-300 font-bold">{wonPrize === 2 ? 'A perfect show. Not one bad cut.' : 'Smooth show, nice cutting.'}</p>
                        <p className="text-white font-black text-lg mt-3 mb-6">
                            You earned {wonPrize} donut{wonPrize > 1 ? 's' : ''}!
                        </p>
                        <button onClick={onClose} className="bg-red-500 hover:bg-red-400 text-white font-bold py-2 px-6 rounded-full">
                            Close
                        </button>
                    </div>
                )}

                {status === 'lost' && (
                    <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center rounded-2xl z-10 p-6 text-center animate-in zoom-in">
                        <div className="text-6xl mb-4">📺</div>
                        <h3 className="text-2xl font-bold text-white mb-2">OFF AIR</h3>
                        <p className="text-red-300 font-bold mb-6">You made {hits} clean take{hits === 1 ? '' : 's'}. Need {VISION_MIXER_TARGET_TAKES}.</p>
                        <div className="flex gap-3">
                            <button onClick={startGame} className="bg-red-500 hover:bg-red-400 text-white font-bold py-2 px-6 rounded-full">
                                Try again
                            </button>
                            <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-full">
                                Close
                            </button>
                        </div>
                    </div>
                )}

                <button onClick={onClose} aria-label="Close Vision Mixer" className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                    <XCircle size={32} />
                </button>
            </div>
        </div>
    );
}
