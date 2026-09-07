import React, { useEffect, useRef, useState } from 'react';
import {
    PAID_CARE_ADOPTION_PRICE,
    PAID_CARE_LABELS,
    PAID_CARE_PROP_PIXELS,
    PAID_CARE_PRICES,
    advanceDemoClock,
    advanceLocalDay,
    adoptPaidCareDemo,
    beginPaidCare,
    createPaidCareDemo,
    formatDemoClock,
    getActionBenefit,
    getCareValidation,
    isBedtimeSessionActive,
    isDemoNight,
    recoveryEstimate,
    resetPaidCareDemo,
    setPaidCareScenario,
    submitGameChoice,
} from './paidCareDemo.js';
import {
    YUMPALS_FOOD_PIXELS,
    YUMPALS_HEART_PIXELS,
    advanceYumPalsAnimation,
    createYumPalsAnimationState,
    getYumPalsAnimationSequence,
    getYumPalsFrame,
    startYumPalsAnimation,
} from './yumpalsSprites.js';
import { PAID_CARE_ICON_HELP, PAID_CARE_ICON_LABELS, PAID_CARE_ICON_MENU_IDS, PAID_CARE_ICON_ORDER, PAID_CARE_ICON_PIXELS, paidCareHelpIcon } from './paidCareIcons.js';
import './paidCareDemo.css';

const SUBMENUS = {
    food: [
        { id: 'meal', label: 'MEAL' },
        { id: 'snack', label: 'SNACK' },
        { id: 'back', label: 'BACK' },
    ],
    play: [
        { id: 'game', label: 'GAME' },
        { id: 'pat', label: 'PAT' },
        { id: 'back', label: 'BACK' },
    ],
    clean: [{ id: 'clean', label: 'CLEAN' }, { id: 'back', label: 'BACK' }],
    medicine: [{ id: 'medicine', label: 'MEDIC' }, { id: 'back', label: 'BACK' }],
    lights: [{ id: 'bedtime', label: 'BEDTIME' }, { id: 'back', label: 'BACK' }],
    reminder: [{ id: 'reminder', label: 'REMIND' }, { id: 'back', label: 'BACK' }],
};

const PROP_PIXELS = PAID_CARE_PROP_PIXELS;

const PROP_PALETTES = {
    meal: { a: '#5b3f2a', b: '#d99045' },
    snack: { a: '#5b3f2a', b: '#d99045' },
    clean: { a: '#4c665a', b: '#f0c45d' },
    medicine: { a: '#4c665a', b: '#e9e1bb' },
    pat: { a: '#a52f5a', b: '#d94878' },
    reminder: { a: '#4c665a', b: '#e9c957' },
    bedtime: { a: '#4c665a', b: '#71836a' },
    mess: { a: '#76593d', b: '#b78a4d' },
    illness: { a: '#7c4b52', b: '#b46870' },
};

function PixelGrid({ pixels, palette, className = 'paid-pixel-grid' }) {
    return (
        <span className={className} style={{ '--pixel-grid-columns': pixels[0]?.length || 1 }} aria-hidden="true">
            {pixels.flatMap((row, rowIndex) => [...row].map((cell, columnIndex) => (
                <span
                    className="paid-pixel-cell"
                    key={`${rowIndex}-${columnIndex}`}
                    style={{ backgroundColor: palette[cell] || 'transparent' }}
                />
            )))}
        </span>
    );
}

function PixelProp({ type, variant = '' }) {
    const pixels = PROP_PIXELS[`${type}${variant}`] || PROP_PIXELS[type];
    if (!pixels) return null;
    return <PixelGrid className={`paid-pixel-grid paid-prop-grid prop-${type}`} palette={PROP_PALETTES[type]} pixels={pixels} />;
}

function MeterHeart({ filled }) {
    return <PixelGrid className={`paid-pixel-grid paid-meter-heart ${filled ? 'filled' : 'empty'}`} palette={{ a: filled ? '#38543b' : '#82956e' }} pixels={YUMPALS_HEART_PIXELS} />;
}

function MeterRow({ label, value }) {
    return (
        <div className="paid-meter-row">
            <span>{label}</span>
            <span className="paid-meter-hearts" aria-label={`${label} ${value} of 4 hearts`}>
                {Array.from({ length: 4 }, (_, index) => <MeterHeart filled={index < value} key={index} />)}
            </span>
        </div>
    );
}

function PaidCareIcon({ id, selected }) {
    return <PixelGrid className="paid-pixel-grid paid-icon-grid" palette={{ a: selected ? '#f5efac' : '#304837' }} pixels={PAID_CARE_ICON_PIXELS[id]} />;
}

function IconRail({ position, selectedIcon, onSelect, onHover, onFocusIcon, disabled = false }) {
    const startIndex = position === 'top' ? 0 : 4;
    const iconIds = PAID_CARE_ICON_ORDER.slice(startIndex, startIndex + 4);
    return (
        <nav aria-label={`${position} care icons`} className={`paid-icon-strip paid-icon-strip-${position}`}>
            {iconIds.map((id, index) => {
                const absoluteIndex = startIndex + index;
                const selected = selectedIcon === absoluteIndex;
                return (
                    <button
                        aria-label={PAID_CARE_ICON_LABELS[id]}
                        aria-describedby={`paid-icon-help-${id}`}
                        aria-pressed={selected}
                        className={`paid-icon-button ${selected ? 'selected' : ''}`}
                        disabled={disabled}
                        key={id}
                        onClick={() => onSelect(absoluteIndex)}
                        onMouseEnter={() => onHover(absoluteIndex)}
                        onMouseLeave={() => onHover(null)}
                        onFocus={() => { onHover(null); onFocusIcon(absoluteIndex); }}
                        onBlur={() => onFocusIcon(null)}
                        title={`${PAID_CARE_ICON_LABELS[id]} — ${PAID_CARE_ICON_HELP[id]}`}
                        type="button"
                    >
                        <PaidCareIcon id={id} selected={selected} />
                    </button>
                );
            })}
        </nav>
    );
}

function DemoSprite({ animationState, forceAnimation, idleBlink = false, reducedMotion, sleeping, visualAction }) {
    const animation = forceAnimation || (sleeping && !visualAction ? 'sleep' : animationState.type);
    const frame = animation === 'idle'
        ? getYumPalsFrame('mossbit', idleBlink && !visualAction ? 'blink' : 'idle', 0, reducedMotion)
        : getYumPalsFrame('mossbit', animation, animationState.index, reducedMotion);
    const label = sleeping ? `sleeping, ${frame.sleepMark || 'Z'}` : visualAction ? PAID_CARE_LABELS[visualAction] || visualAction : 'idle';
    return (
        <div className="paid-sprite" role="img" aria-label={`Niblet pixel blob, ${label}`}>
            <PixelGrid palette={frame.palette} pixels={frame.pixels} />
            {animation === 'feed' && frame.foodRemaining > 0 && (
                <PixelGrid className="paid-pixel-grid paid-food-grid" palette={{ a: '#784632', b: '#f0ad42' }} pixels={YUMPALS_FOOD_PIXELS[frame.foodRemaining]} />
            )}
            {frame.heart && <PixelGrid className="paid-pixel-grid paid-sprite-heart" palette={{ a: '#d94878' }} pixels={YUMPALS_HEART_PIXELS} />}
            {frame.sleepMark && <span className="paid-sleep-mark" aria-hidden="true">{frame.sleepMark}</span>}
        </div>
    );
}

function receiptLine(receipt) {
    return `${receipt.label.toUpperCase()} -${receipt.amount} ${receipt.status}`;
}

export default function YumPalsHandheldDemo() {
    const [demoState, setDemoState] = useState(() => createPaidCareDemo(new Date(), { postAdoption: true }));
    const [screen, setScreen] = useState('room');
    const [selectedIcon, setSelectedIcon] = useState(0);
    const [hoveredIcon, setHoveredIcon] = useState(null);
    const [focusedIcon, setFocusedIcon] = useState(null);
    const helpIcon = paidCareHelpIcon(selectedIcon, hoveredIcon, focusedIcon);
    const [statusMode, setStatusMode] = useState('status');
    const [subMenuIndex, setSubMenuIndex] = useState(0);
    const [selectedMenu, setSelectedMenu] = useState(null);
    const [selectedAction, setSelectedAction] = useState(null);
    const [notice, setNotice] = useState(null);
    const [visualAction, setVisualAction] = useState(null);
    const [cleanFrame, setCleanFrame] = useState(0);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [animationState, setAnimationState] = useState(() => createYumPalsAnimationState());
    const [idleBlink, setIdleBlink] = useState(false);
    const [gameOutcome, setGameOutcome] = useState(null);
    const [gameReveal, setGameReveal] = useState(null);
    const noticeTimerRef = useRef(null);
    const propTimerRef = useRef(null);
    const cleanTimersRef = useRef([]);
    const gameRevealTimerRef = useRef(null);
    const operationCounterRef = useRef(0);
    const state = demoState;
    const pet = state.pet;
    const sleeping = Boolean(pet && isDemoNight(state));
    const bedtimeScheduled = Boolean(pet && (state.bedtimeDates.includes(state.dateKey) || isBedtimeSessionActive(state)));
    const recovery = recoveryEstimate(state);

    const showNotice = (message, type = 'info') => {
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
        setNotice({ message, type });
        noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500);
    };

    const showVisual = (action) => {
        setVisualAction(action);
        setCleanFrame(0);
        const animation = action === 'meal' || action === 'snack'
            ? 'feed'
            : action === 'pat' || action === 'clean' || action === 'medicine' || action === 'reminder'
                ? action
                : action === 'bedtime' ? 'sleep' : 'idle';
        setAnimationState((current) => startYumPalsAnimation(current, animation, reducedMotion));
        if (propTimerRef.current) window.clearTimeout(propTimerRef.current);
        if (gameRevealTimerRef.current) window.clearTimeout(gameRevealTimerRef.current);
        cleanTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        cleanTimersRef.current = [];
        if (action === 'clean' && !reducedMotion) {
            cleanTimersRef.current = [
                window.setTimeout(() => setCleanFrame(1), 210),
                window.setTimeout(() => setCleanFrame(2), 420),
                window.setTimeout(() => setCleanFrame(3), 630),
            ];
        } else if (action === 'clean') {
            setCleanFrame(3);
        }
        const animationDuration = getYumPalsAnimationSequence(animation, reducedMotion)
            .reduce((total, frame) => total + frame.duration, 0);
        const visualDuration = animationDuration + (reducedMotion ? 80 : 120);
        propTimerRef.current = window.setTimeout(() => setVisualAction(null), visualDuration);
    };

    useEffect(() => () => {
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
        if (propTimerRef.current) window.clearTimeout(propTimerRef.current);
        if (gameRevealTimerRef.current) window.clearTimeout(gameRevealTimerRef.current);
        cleanTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    }, []);

    useEffect(() => {
        if (reducedMotion) {
            setIdleBlink(false);
            return undefined;
        }
        let blinkTimer;
        const interval = window.setInterval(() => {
            setIdleBlink(true);
            blinkTimer = window.setTimeout(() => setIdleBlink(false), 160);
        }, 5600);
        return () => {
            window.clearInterval(interval);
            if (blinkTimer) window.clearTimeout(blinkTimer);
        };
    }, [reducedMotion]);

    useEffect(() => {
        const sequence = getYumPalsAnimationSequence(animationState.type, animationState.reducedMotion);
        if (animationState.reducedMotion && ['idle', 'sleep'].includes(animationState.type)) return undefined;
        const frame = sequence[Math.min(animationState.index, sequence.length - 1)];
        const timer = window.setTimeout(() => {
            setAnimationState((current) => current.token === animationState.token ? advanceYumPalsAnimation(current) : current);
        }, frame.duration);
        return () => window.clearTimeout(timer);
    }, [animationState]);

    const nextOperationId = () => {
        operationCounterRef.current += 1;
        return `demo-care-${operationCounterRef.current}`;
    };

    const submenu = selectedMenu ? SUBMENUS[selectedMenu] || [] : [];
    const currentSubItem = submenu[subMenuIndex] || submenu[0];

    const cycle = () => {
        if (visualAction) return;
        if (screen === 'room') {
            if (!pet) return;
            setSelectedIcon((index) => (index === null ? 0 : (index + 1) % PAID_CARE_ICON_ORDER.length));
            return;
        }
        if (screen === 'submenu') {
            setSubMenuIndex((index) => (index + 1) % submenu.length);
        }
    };

    const openSelectedIcon = () => {
        const iconId = selectedIcon === null ? null : PAID_CARE_ICON_ORDER[selectedIcon];
        if (!iconId || !pet) return;
        if (iconId === 'status' || iconId === 'attention') {
            setStatusMode(iconId);
            setScreen('status');
            return;
        }
        const menuId = PAID_CARE_ICON_MENU_IDS[iconId];
        if (!menuId) return;
        setSelectedMenu(menuId);
        setSubMenuIndex(0);
        setScreen('submenu');
    };

    const openSelectedSubItem = () => {
        if (currentSubItem?.id === 'back') {
            setScreen('room');
            return;
        }
        if (currentSubItem?.id === 'game' && state.gameSession) {
            setGameOutcome(null);
            setGameReveal(null);
            setScreen('game');
            return;
        }
        const validation = getCareValidation(state, currentSubItem?.id);
        if (validation.code !== 'OK') {
            showNotice(validation.message, 'error');
            return;
        }
        setSelectedAction(currentSubItem.id);
        setScreen('confirm');
    };

    const confirmAction = () => {
        if (!selectedAction || visualAction) return;
        const operationId = nextOperationId();
        const result = beginPaidCare(state, selectedAction, operationId);
        if (result.code !== 'OK') {
            showNotice(result.message || 'That purchase was not made. No donuts changed.', 'error');
            return;
        }
        setDemoState(result.state);
        showVisual(selectedAction);
        if (selectedAction === 'game') {
            setGameOutcome(null);
            setGameReveal(null);
            setScreen('game');
        } else {
            setScreen('room');
            showNotice(`${PAID_CARE_LABELS[selectedAction]} delivered. Wallet: ${result.state.balance} pretend donuts.`);
        }
    };

    const adopt = () => {
        const result = adoptPaidCareDemo(state, { name: 'Niblet', operationId: nextOperationId() });
        if (result.code !== 'OK') {
            showNotice(result.code === 'INSUFFICIENT' ? 'Adoption needs 5 pretend donuts. No charge was made.' : 'Adoption was not made.', 'error');
            return;
        }
        setDemoState({ ...result.state, scenario: 'post-adoption' });
        setScreen('room');
        showNotice('Niblet joined. Adoption cost 5 pretend donuts; needs start full.');
    };

    const gameChoice = (choice) => {
        if (screen !== 'game' || !state.gameSession) return;
        const result = submitGameChoice(state, choice);
        if (result.code !== 'OK') return;
        setDemoState(result.state);
        setAnimationState((current) => startYumPalsAnimation(current, choice === 'left' ? 'lookLeft' : 'lookRight', reducedMotion));
        setGameReveal({ target: result.target, correct: result.correct, round: result.round });
        if (gameRevealTimerRef.current) window.clearTimeout(gameRevealTimerRef.current);
        if (result.complete) {
            setGameOutcome({ target: result.target, correct: result.correct });
            setScreen('game-result');
            showNotice(`Game complete: happiness +${result.happinessGain} was already delivered. No prize or payout.`);
        } else {
            showNotice(result.correct ? 'Correct direction.' : 'Different direction. Keep going.');
            gameRevealTimerRef.current = window.setTimeout(() => setGameReveal(null), reducedMotion ? 220 : 520);
        }
    };

    const cancel = () => {
        if (visualAction && screen === 'room') return;
        if (screen === 'room') {
            if (selectedIcon !== null) setSelectedIcon(null);
            return;
        }
        if (screen === 'game') {
            setScreen('room');
            showNotice('Game paused. Press A, then B on PLAY to resume; no second fee.');
            return;
        }
        if (screen === 'game-result') {
            setScreen('room');
            return;
        }
        if (screen === 'submenu' || screen === 'confirm' || screen === 'status' || screen === 'settings' || screen === 'adopt') {
            setScreen('room');
        }
    };

    const confirm = () => {
        if (screen === 'room') {
            if (!pet) setScreen('adopt');
            else openSelectedIcon();
        } else if (screen === 'submenu') openSelectedSubItem();
        else if (screen === 'confirm') confirmAction();
        else if (screen === 'adopt') adopt();
        else if (screen === 'game') gameChoice('right');
        else if (screen === 'game-result') setScreen('room');
        else if (screen === 'settings') {
            setReducedMotion((current) => !current);
            showNotice(`Reduced motion ${reducedMotion ? 'off' : 'on'}; setting is uncharged.`);
        }
    };

    useEffect(() => {
        const onKeyDown = (event) => {
            const tag = event.target?.tagName;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || event.target?.closest?.('button')) return;
            if (visualAction && screen === 'room') return;
            const key = event.key.toLowerCase();
            if (screen === 'game') {
                if (gameReveal && !['c', 'escape'].includes(key)) return;
                if (key === 'a' || key === 'arrowleft') {
                    event.preventDefault();
                    gameChoice('left');
                } else if (key === 'b' || key === 'arrowright' || key === 'enter') {
                    event.preventDefault();
                    gameChoice('right');
                } else if (key === 'c' || key === 'escape') {
                    event.preventDefault();
                    cancel();
                }
                return;
            }
            if (key === 'a' || key === 'arrowright') {
                event.preventDefault();
                cycle();
            } else if (key === 'b' || key === 'enter') {
                event.preventDefault();
                confirm();
            } else if (key === 'c' || key === 'escape' || key === 'arrowleft') {
                event.preventDefault();
                cancel();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [screen, selectedIcon, subMenuIndex, selectedMenu, selectedAction, state, reducedMotion, visualAction, gameReveal]);

    const selectScenario = (event) => {
        const scenario = event.target.value;
        setDemoState((current) => setPaidCareScenario(current, scenario));
        setScreen(scenario === 'new-adoption' ? 'adopt' : 'room');
        setSelectedIcon(0);
        setSelectedMenu(null);
        setSelectedAction(null);
        showNotice('Local scenario changed. No account or wallet was touched.');
    };

    const advanceClock = () => {
        setDemoState((current) => advanceDemoClock(current, 60));
        showNotice('Fake clock advanced 1 hour. It is not the device or school clock.');
    };

    const advanceDay = () => {
        setDemoState((current) => advanceLocalDay(current));
        setScreen('room');
        showNotice('Local day advanced. Rest days freeze decline; meters stay between 0 and 4.');
    };

    const selectedBenefit = selectedAction ? getActionBenefit(state, selectedAction) : null;
    const actionProp = visualAction && ['clean', 'medicine', 'reminder', 'bedtime'].includes(visualAction) ? visualAction : null;
    const roomCue = pet && pet.needs.cleanliness <= 1 ? 'MESS' : pet && pet.needs.health <= 1 ? 'SICK' : pet?.attention ? 'ATTN' : null;
    const growthStage = pet?.ageDays >= 20 ? 'GROWN' : pet?.ageDays >= 10 ? 'JUNIOR' : pet?.ageDays >= 3 ? 'BUDDING' : 'HATCH';

    const gameInputLocked = screen === 'game' && Boolean(gameReveal);

    return (
        <main className="paid-demo-shell">
            <section className="paid-demo-page" aria-label="YumPals paid-care local demo">
                <header className="paid-demo-header">
                    <div>
                        <p className="paid-demo-kicker">YUMPALS / STAGE 2</p>
                        <h1>Handheld care demo</h1>
                        <p>SEE / TRY preview · pretend donuts only</p>
                    </div>
                    <span className="paid-demo-badge">LOCAL ONLY</span>
                </header>

                <p className="paid-demo-warning">Pet actions use pretend donuts only; this demo makes no pet or account database writes. Reload resets this temporary demo; game resume works within this open session.</p>

                <div className="paid-demo-device-wrap">
                    <div className={`paid-demo-device ${sleeping ? 'is-sleeping' : ''}`}>
                        <div className="paid-demo-brand">YUMPALS</div>
                        <div className="paid-demo-screen-frame">
                            <div className={`paid-demo-lcd ${sleeping ? 'is-sleeping' : ''} ${bedtimeScheduled ? 'is-bedtime-set' : ''}`} aria-live="polite">
                                <IconRail position="top" selectedIcon={selectedIcon} onSelect={setSelectedIcon} onHover={setHoveredIcon} onFocusIcon={setFocusedIcon} disabled={!pet} />
                                <div className="paid-lcd-content">
                                {screen === 'room' && pet && (
                                    <div className="paid-lcd-room">
                                        <div className="paid-lcd-top"><span>{pet.name.toUpperCase()}</span><span>D{state.balance}</span></div>
                                        <div className="paid-lcd-stage">
                                            <DemoSprite animationState={animationState} idleBlink={idleBlink} reducedMotion={reducedMotion} sleeping={sleeping} visualAction={visualAction} />
                                            {actionProp && <PixelProp type={actionProp} variant={actionProp === 'clean' ? String(cleanFrame || 1) : ''} />}
                                            {visualAction === 'clean' && cleanFrame < 3 && <PixelProp type="mess" />}
                                            {!actionProp && visualAction !== 'clean' && pet.needs.cleanliness <= 1 && <PixelProp type="mess" />}
                                            {!actionProp && pet.needs.health <= 1 && <PixelProp type="illness" />}
                                            {!actionProp && pet.attention && <PixelProp type="reminder" />}
                                        </div>
                                        <div className="paid-lcd-bottom"><span>{sleeping ? 'SLEEP' : visualAction ? PAID_CARE_LABELS[visualAction]?.toUpperCase() : bedtimeScheduled ? 'LIGHTS SET' : roomCue || 'READY'}</span><span>{growthStage}</span></div>
                                        <div className="paid-lcd-help">A SELECT · B CONFIRM · C CANCEL</div>
                                    </div>
                                )}

                                {screen === 'room' && !pet && (
                                    <div className="paid-lcd-message"><strong>NO PAL</strong><span>B TO ADOPT</span><span>5 DONUTS</span><small>C CANCEL</small></div>
                                )}

                                {screen === 'adopt' && (
                                    <div className="paid-lcd-message"><strong>ADOPT?</strong><span>NIBLET</span><span>COST {PAID_CARE_ADOPTION_PRICE}</span><small>B CONFIRM · C CANCEL</small></div>
                                )}

                                {screen === 'submenu' && (
                                    <div className="paid-lcd-menu"><span className="paid-lcd-title">{selectedMenu?.toUpperCase()}</span>{submenu.map((item, index) => <button aria-current={index === subMenuIndex ? 'true' : undefined} aria-label={`Select ${item.label}`} className={`paid-menu-row ${index === subMenuIndex ? 'selected' : ''}`} key={`${item.id}-${index}`} onClick={() => setSubMenuIndex(index)} type="button"><span className="paid-menu-arrow">{index === subMenuIndex ? '▶' : ' '}</span><span>{item.label}</span>{item.id !== 'back' && <small>{PAID_CARE_PRICES[item.id]}</small>}</button>)}<span className="paid-lcd-help">A SELECT · B CONFIRM · C CANCEL</span></div>
                                )}

                                {screen === 'confirm' && selectedAction && (
                                    <div className="paid-lcd-message"><strong>BUY {PAID_CARE_LABELS[selectedAction]?.toUpperCase()}</strong><span>COST {PAID_CARE_PRICES[selectedAction]} DONUT{PAID_CARE_PRICES[selectedAction] === 1 ? '' : 'S'}</span><span>WALLET AFTER {state.balance - PAID_CARE_PRICES[selectedAction]}</span><span>+{selectedBenefit?.amount || 1} {selectedBenefit?.label?.toUpperCase()}</span><small>B CONFIRM PAYMENT · C CANCEL</small></div>
                                )}

                                {screen === 'status' && pet && (
                                    <div className="paid-lcd-status"><span className="paid-lcd-title">{statusMode === 'attention' ? 'ATTENTION' : 'STATUS'} / {pet.ageDays}D / {growthStage}</span><MeterRow label="HUN" value={pet.needs.hunger} /><MeterRow label="HAP" value={pet.needs.happiness} /><MeterRow label="CLN" value={pet.needs.cleanliness} /><MeterRow label="HP" value={pet.needs.health} /><span className="paid-status-attention">{pet.attention ? 'ATTENTION FLAG' : 'NO ATTENTION'}</span><div className="paid-receipt-list">{state.receipts.slice(-3).reverse().map((receipt) => <span key={receipt.receiptId}>{receiptLine(receipt)}</span>)}</div><span className="paid-lcd-help">C CANCEL</span></div>
                                )}

                                {screen === 'settings' && (
                                    <div className="paid-lcd-message"><strong>SETTINGS</strong><span>MOTION {reducedMotion ? 'REDUCED' : 'FULL'}</span><span>B TOGGLE</span><small>C CANCEL · NO COST</small></div>
                                )}

                                {screen === 'game' && state.gameSession && (
                                    <div className="paid-lcd-game"><span className="paid-lcd-title">DIRECTION GAME</span><div className="paid-game-visual"><DemoSprite animationState={animationState} forceAnimation={gameReveal ? gameReveal.target === 'left' ? 'lookLeft' : 'lookRight' : null} reducedMotion={reducedMotion} sleeping={false} visualAction={gameReveal ? 'game' : null} /></div><strong>ROUND {(gameReveal ? gameReveal.round : state.gameSession.round) + 1} / 3</strong><span>{gameReveal ? `REVEAL ${(gameReveal.target || '?').toUpperCase()} · ${gameReveal.correct ? 'MATCH' : 'MISS'}` : 'A = LEFT · B = RIGHT'}</span><small>C CANCEL / PAUSE · NO PAYOUTS</small></div>
                                )}

                                {screen === 'game-result' && gameOutcome && (
                                    <div className="paid-lcd-game"><span className="paid-lcd-title">FINAL DIRECTION</span><div className="paid-game-visual"><DemoSprite animationState={animationState} forceAnimation={gameOutcome.target === 'left' ? 'lookLeft' : 'lookRight'} reducedMotion={reducedMotion} sleeping={false} visualAction="game" /></div><strong>ROUND 3 TARGET {(gameOutcome.target || '?').toUpperCase()}</strong><span>{gameOutcome.correct ? 'MATCH' : 'MISS'} · BENEFIT KEPT</span><small>B CONFIRM · C CANCEL · NO SECOND FEE</small></div>
                                )}
                                </div>
                                <IconRail position="bottom" selectedIcon={selectedIcon} onSelect={setSelectedIcon} onHover={setHoveredIcon} onFocusIcon={setFocusedIcon} disabled={!pet} />
                            </div>
                        </div>
                        <div className="paid-hardware" aria-label="YumPals hardware controls">
                            <button className="paid-hardware-button" disabled={Boolean((visualAction && screen === 'room') || gameInputLocked)} onClick={screen === 'game' ? () => gameChoice('left') : cycle} type="button" aria-label="A SELECT"><strong>A</strong><span>SELECT</span></button>
                            <button className="paid-hardware-button paid-hardware-select" disabled={Boolean((visualAction && screen === 'room') || gameInputLocked)} onClick={screen === 'game' ? () => gameChoice('right') : confirm} type="button" aria-label="B CONFIRM"><strong>B</strong><span>CONFIRM</span></button>
                            <button className="paid-hardware-button" disabled={Boolean(visualAction && screen === 'room')} onClick={cancel} type="button" aria-label="C CANCEL"><strong>C</strong><span>CANCEL</span></button>
                        </div>
                        <div className="paid-device-screw screw-left" />
                        <div className="paid-device-screw screw-right" />
                    </div>
                </div>

                {notice && <div className={`paid-demo-notice ${notice.type === 'error' ? 'is-error' : ''}`} role="status">{notice.message}</div>}

                <div className="paid-demo-meta" aria-label="Demo economy summary"><span>START 30</span><span>WALLET {state.balance}</span><span>SPENT {state.spentTotal}</span><span>CAP {state.dailySpend[state.dateKey] || 0}/{25}</span></div>
                <p className="paid-demo-hint" role="status">{helpIcon ? `${PAID_CARE_ICON_LABELS[helpIcon]} — ${PAID_CARE_ICON_HELP[helpIcon]}` : 'Press A SELECT to choose an icon.'}</p>
                {PAID_CARE_ICON_ORDER.map((id) => <span className="paid-help-accessible" id={`paid-icon-help-${id}`} key={id}>{PAID_CARE_ICON_HELP[id]}</span>)}
                <details className="paid-demo-inspector">
                    <summary>How to play</summary>
                    <p>A SELECT moves through icons or choices. B CONFIRM opens your choice. C CANCEL clears a selection or returns; in a game it pauses.</p>
                    <p>Choosing an icon costs nothing. Pretend donuts are charged only when you confirm the displayed price. Health and status and Attention are free to check.</p>
                    <dl className="paid-help-guide">{PAID_CARE_ICON_ORDER.map((id) => <div key={id}><dt><span className="paid-help-icon"><PaidCareIcon id={id} selected={false} /></span>{PAID_CARE_ICON_LABELS[id]}</dt><dd>{PAID_CARE_ICON_HELP[id]}</dd></div>)}</dl>
                    <p>Needs start full. To try care, open Demo controls below and choose Needs care. During the game, follow the left/right instructions inside the screen; C CANCEL pauses and you can resume without paying again.</p>
                </details>

                <button className="paid-demo-utility" onClick={() => setScreen('settings')} type="button">Preferences · reduced motion (uncharged)</button>

                <details className="paid-demo-inspector">
                    <summary>Demo controls · needs, school day and fake clock</summary>
                    <p>Testing controls stay outside the toy. They change local state only and are deliberately labelled; the normal handheld does not expose them.</p>
                    <label htmlFor="paid-demo-scenario">Scenario</label>
                    <select id="paid-demo-scenario" onChange={selectScenario} value={state.scenario}>
                        <option value="post-adoption">Post-adoption · full needs</option>
                        <option value="needs-care">Needs care · all meters 0</option>
                        <option value="recovery">Recovery · 14 / 16 donut check</option>
                        <option value="no-funds">No funds · partial hunger</option>
                        <option value="school-day">School day · full needs</option>
                        <option value="night">Night · auto sleep / wake</option>
                        <option value="new-adoption">New adoption · 30 → 25</option>
                    </select>
                    <div className="paid-inspector-actions"><button onClick={advanceClock} type="button">Advance fake clock 1h</button><button onClick={advanceDay} type="button">Advance local day</button><button onClick={() => setDemoState(resetPaidCareDemo(new Date(), 'post-adoption'))} type="button">Reset local demo</button></div>
                    <div className="paid-inspector-readout"><span>Fake clock {formatDemoClock(state.fakeClockMinutes)} · {isDemoNight(state) ? 'night' : 'school hours'}</span><span>Date {state.dateKey}</span><span>Recovery estimate {recovery.total} donuts ({recovery.care} care{recovery.reminder ? ` + ${recovery.reminder} reminder` : ''}{recovery.bedtime ? ` + ${recovery.bedtime} bedtime` : ''})</span></div>
                    {state.scenario === 'new-adoption' && <button className="paid-inspector-adopt" onClick={() => setScreen('adopt')} type="button">Open adoption screen</button>}
                </details>
            </section>
        </main>
    );
}
