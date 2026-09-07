import React, { useEffect, useMemo, useRef, useState } from 'react';
import { demoAdopt, demoCare, demoDateFromKey, demoUpdatePet, createDemoState, getAucklandDateParts, growthForCareDays, growthForDisplay, refreshDemoState, YUMPALS_CASES, YUMPALS_DEFAULT_SETTINGS, YUMPALS_SPECIES } from './yumpalsRules';
import { advanceYumPalsAnimation, createYumPalsAnimationState, getYumPalsAnimationSequence, getYumPalsFrame, startYumPalsAnimation, YUMPALS_FOOD_PIXELS, YUMPALS_HEART_PIXELS } from './yumpalsSprites';
import './yumpals.css';

const ACTIONS = [
    { id: 'feed', label: 'Feed', hint: 'Give a snack' },
    { id: 'pat', label: 'Pat', hint: 'Give encouragement' },
    { id: 'settings', label: 'Settings', hint: 'Open preferences' },
];

const CASE_COLORS = Object.fromEntries(YUMPALS_CASES.map((item) => [item.id, item.color]));

function readableError(error) {
    return error?.message || 'YumPals could not save that change. Please retry.';
}

function dateInputValue(dateKey) {
    return dateKey || getAucklandDateParts().dateKey;
}

function dateForDemo(dateKey) {
    return demoDateFromKey(dateKey) || demoDateFromKey(getAucklandDateParts().dateKey);
}

function PixelGrid({ pixels, palette, className = 'yumpals-pixel-grid' }) {
    return (
        <span className={className} aria-hidden="true" style={{ '--pixel-grid-columns': pixels[0]?.length || 1 }}>
            {pixels.flatMap((row, rowIndex) => [...row].map((cell, columnIndex) => (
                <span
                    className="yumpals-pixel-cell"
                    key={`${rowIndex}-${columnIndex}`}
                    style={{ backgroundColor: palette[cell] || 'transparent' }}
                />
            )))}
        </span>
    );
}

function YumPalsSprite({ species, reducedMotion = false, color, animation = 'idle', frameIndex = 0 }) {
    const frame = getYumPalsFrame(species, animation, frameIndex, reducedMotion);
    const frameDescription = frame.sleepMark
        ? `sleeping, ${frame.sleepMark}`
        : frame.heart
            ? 'happy'
            : frame.foodRemaining !== undefined
                ? `eating, ${frame.foodRemaining} bites left`
                : 'idle';
    return (
        <div
            className={`yumpals-sprite sprite-${animation}`}
            role="img"
            aria-label={`${frame.name} pixel blob, ${frameDescription}`}
            style={{ '--pet-accent': color || 'transparent' }}
        >
            <PixelGrid palette={frame.palette} pixels={frame.pixels} />
            {animation === 'feed' && frame.foodRemaining > 0 && <PixelGrid className="yumpals-food-grid" palette={{ a: '#784632', b: '#f0ad42' }} pixels={YUMPALS_FOOD_PIXELS[frame.foodRemaining]} />}
            {frame.heart && <PixelGrid className="yumpals-heart" palette={{ a: '#d94878' }} pixels={YUMPALS_HEART_PIXELS} />}
            {frame.sleepMark && <span className="yumpals-sleep-mark" aria-hidden="true">{frame.sleepMark}</span>}
        </div>
    );
}

function ActionButton({ action, active, disabled, onClick }) {
    return (
        <button
            aria-current={active ? 'true' : undefined}
            aria-label={`${action.label}: ${action.hint}`}
            className="yumpals-action"
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            {action.label}
        </button>
    );
}

export function YumPalsView({ demoMode = false, state: cloudState, loading = false, error = null, onRetry, onCall, onRefresh, onExit }) {
    const [demoState, setDemoState] = useState(() => createDemoState());
    const [demoDateKey, setDemoDateKey] = useState(() => getAucklandDateParts().dateKey);
    const [screen, setScreen] = useState('room');
    const settingsHeadingRef = useRef(null);
    const settingsOpenerRef = useRef(null);
    const [focusIndex, setFocusIndex] = useState(0);
    const [pending, setPending] = useState(null);
    const [notice, setNotice] = useState(null);
    const [napActive, setNapActive] = useState(false);
    const [spriteAnimation, setSpriteAnimation] = useState(() => createYumPalsAnimationState());
    const noticeTimerRef = useRef(null);
    const [adoption, setAdoption] = useState({ species: 'mossbit', name: '', color: '#d94878', casing: 'berry' });
    const [profileDraft, setProfileDraft] = useState(null);
    const [teacherDraft, setTeacherDraft] = useState(null);

    const state = demoMode ? demoState : cloudState;
    const settings = state?.settings || YUMPALS_DEFAULT_SETTINGS;
    const pet = state?.pet;
    const availableSpecies = useMemo(
        () => YUMPALS_SPECIES.filter((species) => settings.availableSpecies?.includes(species.id)),
        [settings.availableSpecies],
    );
    const today = state?.today;
    const selectedAction = ACTIONS[focusIndex] || ACTIONS[0];
    const animationBusy = !['idle', 'sleep'].includes(spriteAnimation.type);

    const openSettings = (event) => {
        settingsOpenerRef.current = event.currentTarget;
        setScreen('settings');
    };

    useEffect(() => {
        const target = screen === 'settings' ? settingsHeadingRef.current : settingsOpenerRef.current;
        if (!target?.isConnected) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: screen === 'settings' ? 'start' : 'nearest', behavior: 'instant' });
    }, [screen]);

    useEffect(() => {
        if (demoMode) {
            setDemoState((current) => refreshDemoState({ ...current, serverNowMs: dateForDemo(demoDateKey).getTime() }, dateForDemo(demoDateKey)));
        }
    }, [demoDateKey, demoMode]);

    useEffect(() => {
        if (!pet) return;
        setProfileDraft({
            name: pet.name,
            color: pet.color,
            casing: pet.casing,
            reducedMotion: pet.reducedMotion === true,
        });
    }, [pet?.name, pet?.color, pet?.casing, pet?.reducedMotion]);

    useEffect(() => {
        setNapActive(false);
        setSpriteAnimation((current) => startYumPalsAnimation(current, 'idle', pet?.reducedMotion === true));
    }, [pet?.species, pet?.reducedMotion]);

    useEffect(() => {
        const sequence = getYumPalsAnimationSequence(spriteAnimation.type, spriteAnimation.reducedMotion);
        if (spriteAnimation.reducedMotion && ['idle', 'sleep'].includes(spriteAnimation.type)) return undefined;
        const frame = sequence[Math.min(spriteAnimation.index, sequence.length - 1)];
        const timer = window.setTimeout(() => {
            setSpriteAnimation((current) => current.token === spriteAnimation.token ? advanceYumPalsAnimation(current) : current);
        }, frame.duration);
        return () => window.clearTimeout(timer);
    }, [spriteAnimation]);

    useEffect(() => () => {
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    }, []);

    useEffect(() => {
        setTeacherDraft({
            enabled: settings.enabled === true,
            holidayRest: settings.holidayRest !== false,
            growthSpeed: settings.growthSpeed || 'standard',
            holidayDates: (settings.holidayDates || []).join(', '),
        });
    }, [settings.enabled, settings.holidayRest, settings.growthSpeed, settings.holidayDates?.join(',')]);

    const showNotice = (message, type = 'success') => {
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
        setNotice({ message, type });
        noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500);
    };

    const performCloud = async (callableName, data) => {
        if (!onCall) throw new Error('YumPals cloud service is not configured.');
        const response = await onCall(callableName, data);
        if (!response?.ok) throw new Error('YumPals returned an incomplete save response.');
        let refreshed = response;
        if (onRefresh) {
            try {
                refreshed = await onRefresh();
            } catch (refreshError) {
                throw new Error(`Saved, but refreshing the pet failed: ${readableError(refreshError)}`);
            }
        }
        if (!refreshed) throw new Error('Saved, but refreshing the pet failed. Please retry.');
        return { response, refreshed };
    };

    const retry = () => {
        const attempt = onRetry?.();
        if (attempt?.catch) attempt.catch(() => {});
    };

    const performCare = async (action) => {
        if (pending || animationBusy || napActive || !pet || !today?.eligible || today[action]) return;
        setPending(action);
        try {
            if (demoMode) {
                const result = demoCare(demoState, action, dateForDemo(demoDateKey));
                if (result.code !== 'OK') {
                    throw new Error(result.code === 'DUPLICATE' ? 'That care action is already complete today.' : result.code === 'DISABLED' ? 'YumPals is paused by the teacher.' : 'This is a rest day.');
                }
                setDemoState(result.state);
            } else {
                const result = await performCloud('yumpalsCare', {
                    action,
                    operationId: `${today.dateKey}_${action}_${Date.now()}`,
                });
                if (result.response.blockedReason) {
                    showNotice(result.response.blockedReason === 'HOLIDAY' ? 'Holiday rest day — progress is safe.' : 'Weekend rest day — progress is safe.');
                    return;
                }
                if (result.response.duplicate) {
                    showNotice('That care action is already complete today.');
                    return;
                }
            }
            setNapActive(false);
            setSpriteAnimation((current) => startYumPalsAnimation(current, action, pet.reducedMotion === true));
            showNotice(action === 'feed' ? 'Snack delivered!' : 'Pat received!');
        } catch (actionError) {
            showNotice(readableError(actionError), 'error');
        } finally {
            setPending(null);
        }
    };

    const toggleNap = () => {
        if (pending || animationBusy) return;
        const nextNapActive = !napActive;
        setNapActive(nextNapActive);
        setSpriteAnimation((current) => startYumPalsAnimation(current, nextNapActive ? 'sleep' : 'wake', pet?.reducedMotion === true));
        showNotice(nextNapActive ? 'Cosmetic nap started; care progress is unchanged.' : 'Woke up; care progress is unchanged.');
    };

    const activateSelected = (event) => {
        if (selectedAction.id === 'settings') {
            openSettings(event);
        } else {
            performCare(selectedAction.id);
        }
    };

    useEffect(() => {
        const onKeyDown = (event) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
            if (!event.target?.closest?.('.yumpals-device')) return;
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                setFocusIndex((current) => (current + 1) % ACTIONS.length);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setFocusIndex((current) => (current + ACTIONS.length - 1) % ACTIONS.length);
            } else if (event.key === 'Escape') {
                if (screen === 'settings') setScreen('room');
                else if (onExit) onExit();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [focusIndex, onExit, pet, screen, selectedAction, today, pending, demoMode, demoState, demoDateKey]);

    const adopt = async () => {
        if (!adoption.name.trim() || pending) return;
        setPending('adopt');
        try {
            if (demoMode) {
                const result = demoAdopt(demoState, adoption, dateForDemo(demoDateKey));
                if (result.code === 'DUPLICATE') throw new Error('This account already has a pet.');
                if (result.code === 'DISABLED') throw new Error('YumPals is paused by the teacher.');
                setDemoState(result.state);
            } else {
                const result = await performCloud('yumpalsAdopt', adoption);
                if (result.response.duplicate) {
                    showNotice('This account already has a pet.');
                    return;
                }
            }
            showNotice(`${adoption.name.trim()} joined your room!`);
        } catch (adoptError) {
            showNotice(readableError(adoptError), 'error');
        } finally {
            setPending(null);
        }
    };

    const saveProfile = async () => {
        if (!profileDraft || pending) return;
        setPending('profile');
        try {
            if (demoMode) {
                const result = demoUpdatePet(demoState, profileDraft);
                setDemoState({ ...result.state, pet: { ...result.state.pet, growth: growthForDisplay(result.state.pet.careDays, result.state.settings.growthSpeed, result.state.pet.earnedMilestones) } });
            } else {
                await performCloud('yumpalsUpdatePet', profileDraft);
            }
            showNotice('Preferences saved.');
        } catch (saveError) {
            showNotice(readableError(saveError), 'error');
        } finally {
            setPending(null);
        }
    };

    const saveTeacherSettings = async () => {
        if (!teacherDraft || pending) return;
        const holidayDates = teacherDraft.holidayDates.split(',').map((date) => date.trim()).filter(Boolean);
        setPending('teacher');
        try {
            if (demoMode) {
                setDemoState((current) => {
                    const settings = { ...current.settings, ...teacherDraft, holidayDates };
                    const nextPet = current.pet ? {
                        ...current.pet,
                        growth: growthForDisplay(current.pet.careDays, settings.growthSpeed, current.pet.earnedMilestones),
                    } : null;
                    return refreshDemoState({ ...current, enabled: settings.enabled, settings, pet: nextPet }, dateForDemo(demoDateKey));
                });
            } else {
                await performCloud('yumpalsUpdateSettings', { ...teacherDraft, holidayDates });
            }
            showNotice('Teacher settings saved. Earned milestones remain intact.');
        } catch (saveError) {
            showNotice(readableError(saveError), 'error');
        } finally {
            setPending(null);
        }
    };

    if (loading && !state) {
        return <div className="yumpals-page"><div className="yumpals-card"><h3>Waking the YumPals room…</h3><p>Checking the feature switch and your pet.</p></div></div>;
    }

    if (error && !state && !demoMode) {
        return (
            <div className="yumpals-page">
                <div className="yumpals-card">
                    <h3>YumPals is unavailable</h3>
                    <p>{readableError(error)} Existing YumDonut features remain available.</p>
                    <div className="yumpals-button-row"><button className="yumpals-primary" onClick={retry} type="button">Retry</button></div>
                </div>
            </div>
        );
    }

    const showDisabled = !demoMode && !settings.enabled && !pet;
    if (showDisabled && !state?.isAdmin) {
        return <div className="yumpals-page"><div className="yumpals-card"><h3>YumPals is resting</h3><p>Your school has not enabled the pet room yet. Existing YumDonut features are unaffected.</p></div></div>;
    }

    const deviceColor = CASE_COLORS[pet?.casing] || adoption.color;
    const growth = pet?.growth || growthForCareDays(0, settings.growthSpeed, []);
    const nextMilestoneText = growth.next
        ? !pet ? `${growth.next.at} to ${growth.next.label}` : growth.next.at <= pet.careDays ? 'Ready on next care' : `${growth.next.at - pet.careDays} to ${growth.next.label}`
        : 'Fully grown!';
    const rewardTheme = growth.completed.includes('grown') ? 'grown' : growth.completed.includes('junior') ? 'junior' : growth.completed.includes('accessory') ? 'accessory' : 'starter';
    const actionLabel = spriteAnimation.type === 'feed'
        ? 'FEEDING'
        : spriteAnimation.type === 'pat'
            ? 'HAPPY'
            : spriteAnimation.type === 'sleep'
                ? 'NAP'
                : spriteAnimation.type === 'wake' ? 'WAKE' : null;

    return (
        <section className="yumpals-page" aria-label="YumPals virtual pet room">
            <div className="yumpals-heading">
                <div><h2>YumPals</h2><p>A tiny, safe care room for your pet.</p></div>
                <span className={`yumpals-badge ${demoMode ? 'demo' : ''}`}>{demoMode ? 'Local demo' : settings.enabled ? 'Cloud enabled' : 'Teacher preview'}</span>
            </div>
            {demoMode && <p className="yumpals-demo-note">Temporary local demo; refresh resets this room and no account saves are made.</p>}

            <div hidden={screen !== 'room'}>
            {!pet ? (
                <div className="yumpals-card">
                    <h3>Choose your first YumPal</h3>
                    <p>Pick one original creature, give it a name, and choose a case colour. Your pet will stay with your account.</p>
                    <div className="yumpals-species-grid">
                        {(availableSpecies.length ? availableSpecies : YUMPALS_SPECIES).map((species) => (
                            <button className={`yumpals-species-option ${adoption.species === species.id ? 'selected' : ''}`} key={species.id} onClick={() => setAdoption((current) => ({ ...current, species: species.id }))} type="button">
                                <YumPalsSprite species={species.id} reducedMotion />
                                <strong>{species.name}</strong>
                            </button>
                        ))}
                    </div>
                    <div className="yumpals-field"><label htmlFor="yumpals-adoption-name">Pet name</label><input id="yumpals-adoption-name" maxLength={16} onChange={(event) => setAdoption((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Niblet" value={adoption.name} /></div>
                    <div className="yumpals-field"><label htmlFor="yumpals-adoption-case">Case colour</label><select id="yumpals-adoption-case" onChange={(event) => setAdoption((current) => ({ ...current, casing: event.target.value, color: CASE_COLORS[event.target.value] }))} value={adoption.casing}>{YUMPALS_CASES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                    <div className="yumpals-button-row"><button className="yumpals-primary" disabled={!adoption.name.trim() || pending || !settings.enabled && !demoMode} onClick={adopt} type="button">{pending === 'adopt' ? 'Adopting…' : 'Adopt YumPal'}</button>{state?.isAdmin && <button className="yumpals-secondary" onClick={openSettings} type="button">Teacher settings</button>}</div>
                </div>
            ) : (
                <>
                    {!settings.enabled && <div className="yumpals-notice"><strong>Teacher preview: care is paused.</strong><p>Your pet and earned milestones are preserved while the feature is disabled.</p></div>}
                    <div className={`yumpals-device ${pet.reducedMotion ? 'reduced-motion' : ''}`} style={{ '--case-color': deviceColor }}>
                        <div className="yumpals-device-label"><span>YUMPALS</span></div>
                        <div className="yumpals-device-inner">
                            <div className="yumpals-screen-frame">
                                <div className={`yumpals-screen theme-${rewardTheme}`}>
                                <div className="yumpals-room">
                                    <div className="yumpals-room-top"><span>{pet.name} · {growth.stage}</span><div className="yumpals-room-icons"><span className={`yumpals-status-icon feed ${today?.feed ? 'done' : ''}`} title={today?.feed ? 'Fed today' : 'Feed still available'} aria-label={today?.feed ? 'Fed today' : 'Feed still available'} /><span className={`yumpals-status-icon pat ${today?.pat ? 'done' : ''}`} title={today?.pat ? 'Patted today' : 'Pat still available'} aria-label={today?.pat ? 'Patted today' : 'Pat still available'} /></div></div>
                                    <div className={`yumpals-pet-stage ${spriteAnimation.type ? `action-${spriteAnimation.type}` : ''}`}>
                                        {actionLabel && <div className="yumpals-mood" aria-live="polite">{actionLabel}</div>}
                                        <div className="yumpals-reward-badges" aria-label="Earned pet rewards">
                                            {growth.completed.includes('accessory') && <span className="badge-accessory" title="Accessory unlocked">A</span>}
                                            {growth.completed.includes('junior') && <span className="badge-junior" title="Toy unlocked">T</span>}
                                            {growth.completed.includes('grown') && <span className="badge-grown" title="Room theme unlocked">G</span>}
                                        </div>
                                        <YumPalsSprite animation={spriteAnimation.type} color={pet.color} frameIndex={spriteAnimation.index} reducedMotion={pet.reducedMotion} species={pet.species} />
                                    </div>
                                    <div className="yumpals-room-bottom"><span>{pet.careDays} care day{pet.careDays === 1 ? '' : 's'}</span><span>{nextMilestoneText}</span></div>
                                </div>
                                </div>
                            </div>
                            <div className="yumpals-action-grid">
                                {ACTIONS.map((action, index) => <ActionButton action={action} active={index === focusIndex} disabled={action.id !== 'settings' && (!settings.enabled || pending || animationBusy || napActive || !today?.eligible || today[action.id])} key={action.id} onClick={(event) => { setFocusIndex(index); action.id === 'settings' ? openSettings(event) : performCare(action.id); }} />)}
                            </div>
                            <div className="yumpals-cosmetic-row"><button aria-pressed={napActive} className="yumpals-cosmetic-button" disabled={pending || animationBusy} onClick={toggleNap} type="button"><span aria-hidden="true" className="yumpals-cosmetic-mark" />{napActive ? 'Wake' : 'Nap'} <small>cosmetic rest</small></button></div>
                            {!today?.eligible && <div className="yumpals-rest">{today.reason === 'HOLIDAY' ? 'Holiday rest day — no catch-up debt.' : 'Weekend rest day — your progress is safe.'}</div>}
                            <div className="yumpals-hardware" aria-label="YumPals hardware controls">
                                <button aria-label="Cycle selection left" className="yumpals-hardware-button" onClick={() => setFocusIndex((current) => (current + ACTIONS.length - 1) % ACTIONS.length)} type="button"><span aria-hidden="true" className="yumpals-hardware-mark cycle" /><span>Cycle</span></button>
                                <button aria-label="Select highlighted action" className="yumpals-hardware-button select" onClick={activateSelected} type="button"><span aria-hidden="true" className="yumpals-hardware-mark select" /><span>Select</span></button>
                                <button aria-label="Go back" className="yumpals-hardware-button" onClick={() => { if (screen === 'settings') setScreen('room'); else if (onExit) onExit(); }} type="button"><span aria-hidden="true" className="yumpals-hardware-mark back" /><span>Back</span></button>
                            </div>
                        </div>
                    </div>

                    <div className="yumpals-card">
                        <h3>Growth path</h3>
                        <p>Care is cumulative on eligible school days. Missing a day never removes progress or creates catch-up work.</p>
                        <div className="yumpals-progress" aria-label={`${Math.round(growth.progressToNext * 100)} percent to next milestone`}><span style={{ width: `${Math.round(growth.progressToNext * 100)}%` }} /></div>
                        <div className="yumpals-milestones">{growth.milestones.map((milestone) => <div className={`yumpals-milestone ${growth.completed.includes(milestone.key) ? 'done' : ''}`} key={milestone.key}><strong>{milestone.at}</strong><br />{milestone.label}</div>)}</div>
                    </div>
                </>
            )}
            </div>

            {screen === 'settings' && (
                <section className="yumpals-card" aria-labelledby="yumpals-settings-heading" onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); setScreen('room'); } }}>
                    <h3 id="yumpals-settings-heading" ref={settingsHeadingRef} tabIndex={-1}>Room settings</h3>
                    <button className="yumpals-secondary" onClick={() => setScreen('room')} type="button">Back to room</button>
                    <p>Student preferences are separate from teacher rollout controls. Saving never changes care days or earned milestones.</p>
                    {profileDraft && <><div className="yumpals-field"><label htmlFor="yumpals-profile-name">Pet name</label><input id="yumpals-profile-name" maxLength={16} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} value={profileDraft.name} /></div><div className="yumpals-field"><label htmlFor="yumpals-profile-case">Case colour</label><select id="yumpals-profile-case" onChange={(event) => setProfileDraft((current) => ({ ...current, casing: event.target.value, color: CASE_COLORS[event.target.value] }))} value={profileDraft.casing}>{YUMPALS_CASES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="yumpals-check-row"><input checked={profileDraft.reducedMotion} id="yumpals-reduced-motion" onChange={(event) => setProfileDraft((current) => ({ ...current, reducedMotion: event.target.checked }))} type="checkbox" /><label htmlFor="yumpals-reduced-motion">Reduce pet animation</label></div><div className="yumpals-button-row"><button className="yumpals-primary" disabled={pending === 'profile'} onClick={saveProfile} type="button">{pending === 'profile' ? 'Saving…' : 'Save preferences'}</button></div></>}
                    {state?.isAdmin && teacherDraft && <><hr /><h3>Teacher rollout controls</h3><p>Server checks the <code>yumpalsAdmin</code> claim. The existing display-name admin path is not used here.</p><div className="yumpals-check-row"><input checked={teacherDraft.enabled} id="yumpals-enabled" onChange={(event) => setTeacherDraft((current) => ({ ...current, enabled: event.target.checked }))} type="checkbox" /><label htmlFor="yumpals-enabled">Enable YumPals for eligible accounts</label></div><div className="yumpals-check-row"><input checked={teacherDraft.holidayRest} id="yumpals-holiday-rest" onChange={(event) => setTeacherDraft((current) => ({ ...current, holidayRest: event.target.checked }))} type="checkbox" /><label htmlFor="yumpals-holiday-rest">Rest on configured holidays</label></div><div className="yumpals-field"><label htmlFor="yumpals-growth-speed">Growth speed preset</label><select id="yumpals-growth-speed" onChange={(event) => setTeacherDraft((current) => ({ ...current, growthSpeed: event.target.value }))} value={teacherDraft.growthSpeed}><option value="gentle">Gentle</option><option value="standard">Standard</option><option value="quick">Quick</option></select></div><div className="yumpals-field"><label htmlFor="yumpals-holidays">Holiday dates (YYYY-MM-DD, comma separated)</label><input id="yumpals-holidays" onChange={(event) => setTeacherDraft((current) => ({ ...current, holidayDates: event.target.value }))} value={teacherDraft.holidayDates} /></div><div className="yumpals-button-row"><button className="yumpals-primary" disabled={pending === 'teacher'} onClick={saveTeacherSettings} type="button">{pending === 'teacher' ? 'Saving…' : 'Save teacher settings'}</button></div></>}
                    {demoMode && <div className="yumpals-field"><label htmlFor="yumpals-demo-date">Demo date (Auckland)</label><input id="yumpals-demo-date" onChange={(event) => { if (demoDateFromKey(event.target.value, null)) setDemoDateKey(event.target.value); }} type="date" value={dateInputValue(demoDateKey)} /></div>}
                    <div className="yumpals-button-row"><button className="yumpals-secondary" onClick={() => setScreen('room')} type="button">Back to room</button></div>
                </section>
            )}

            {notice && <div className={`yumpals-alert ${notice.type === 'error' ? '' : 'success'}`} role="status">{notice.message}</div>}
            {error && state && <div className="yumpals-alert" role="alert">{readableError(error)} <button className="yumpals-text-button" onClick={retry} type="button">Retry</button></div>}
        </section>
    );
}

export default YumPalsView;
