import React, { useEffect, useId, useRef, useState } from 'react';
import { ignoreHandheldKey } from './handheldKeyboard.js';
import { createPaidCareController } from './paidCareClient.js';
import { createSavedGameController } from './savedGameClient.js';
import { PAID_CARE_ICON_ORDER, PAID_CARE_ICON_LABELS, PAID_CARE_ICON_PIXELS } from './paidCareIcons.js';
import { getYumPalsFrame, getYumPalsAnimationSequence, YUMPALS_FOOD_PIXELS, YUMPALS_HEART_PIXELS } from './yumpalsSprites.js';
import { SAVED_HELP, SAVED_CHOICES, CARE_NAMES, savedSleep, savedEffect, savedChargeLocked, savedNoEffect, savedContextMatches, savedCaseColor } from './savedHandheldPresentation.js';
import './paidCareDemo.css';
import './savedHandheld.css';

const storageDefault = { getItem: k => window.localStorage.getItem(k), setItem: (k, v) => window.localStorage.setItem(k, v), removeItem: k => window.localStorage.removeItem(k) };
const operationDefault = () => crypto.randomUUID();
const EMPTY = { quote: null, confirmation: null, pending: false, busy: false, storageBlocked: false, message: '' };
function Pixels({ pixels, palette, className = '' }) {
  return <span aria-hidden="true" className={`saved-pixels ${className}`} style={{ gridTemplateColumns: `repeat(${pixels[0].length}, 1fr)` }}>
    {pixels.flatMap((row, y) => [...row].map((cell, x) => <span key={`${x}-${y}`} style={{ background: palette[cell] || 'transparent' }} />))}
  </span>;
}
function Blob({ pet, animation, blink, sleeping, reduced, sleepIndex }) {
  const type = animation?.type || (sleeping ? 'sleep' : blink ? 'blink' : 'idle');
  const frame = getYumPalsFrame(pet.species, type, animation?.index || (sleeping && !animation ? sleepIndex : 0), reduced);
  return <div className="saved-blob" role="img" data-frame-key={frame.key} data-food-remaining={frame.foodRemaining ?? 0} aria-label={`${pet.name}, ${type === 'idle' || type === 'blink' ? 'resting' : type}`}>
    <Pixels pixels={frame.pixels} palette={{ ...frame.palette, b: pet.color }} />
    {type === 'feed' && frame.foodRemaining > 0 && <Pixels className="saved-food" pixels={YUMPALS_FOOD_PIXELS[frame.foodRemaining]} palette={{ a: '#784632', b: '#f0ad42' }} />}
    {frame.heart && <Pixels className="saved-heart" pixels={YUMPALS_HEART_PIXELS} palette={{ a: '#a52f5a' }} />}
    {frame.sleepMark && <span className="saved-sleep">{frame.sleepMark}</span>}
  </div>;
}
export default function YumPalsSavedHandheld({ ownerUid, projectId, enabled = false, gameEnabled = false, gameTransport, getIdentity, transport, storage = storageDefault, operationId = operationDefault }) {
  const gameInstance = useRef(null); const [gameState, setGameState] = useState(null);
  const gameReady = enabled && gameEnabled === true && typeof gameTransport === 'function';
  const helpFor = name => name === 'game' && gameReady ? 'Guess left or right for three rounds. Resume a paid game without paying again.' : SAVED_HELP[name];
  const id = useId(); const instance = useRef(null); const [lastPet, setLastPet] = useState(null); const [sleepIndex, setSleepIndex] = useState(0);
  const [state, setState] = useState(EMPTY); const [selected, setSelected] = useState(null); const [help, setHelp] = useState(null);
  const [screen, setScreen] = useState('room'); const [choice, setChoice] = useState(0);
  const [animation, setAnimation] = useState(null); const [blink, setBlink] = useState(false); const [osReduced, setOsReduced] = useState(false);
  const [adoption, setAdoption] = useState({ name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878' });
  const [localMessage, setLocalMessage] = useState('');
  useEffect(() => {
    let alive = true; setLastPet(null); setState(EMPTY); setAnimation(null); setScreen('room');
    const controller = createPaidCareController({ ownerUid, projectId, enabled, getIdentity, transport, storage, operationId,
      onChange: next => { if (alive) { if (next.quote?.pet) setLastPet(next.quote.pet); setState({ ...next, ownerUid, projectId }); } },
      onConfirmed: receipt => { if (alive) { setScreen('room'); if (receipt.action === 'game') { setScreen('game'); void gameInstance.current?.open(receipt.operationId); return; } if (receipt.action === 'bedtime') { setLocalMessage('Bedtime lights are set for tonight.'); return; } setAnimation({ type: ['meal', 'snack'].includes(receipt.action) ? 'feed' : receipt.action === 'adoption' ? 'wake' : receipt.action, index: 0 }); } },
    });
    instance.current = controller; void controller.start();
    const refresh = () => { if (!document.hidden) void controller.refresh(); };
    const timer = window.setInterval(() => {
      const current = controller.getState();
      if (!document.hidden && !current.busy && !current.pending && !current.confirmation) void controller.refresh();
    }, 60000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; window.clearInterval(timer); controller.dispose(); instance.current = null; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [ownerUid, projectId, enabled, getIdentity, transport, storage, operationId]);
  useEffect(() => {
    setGameState(null);
    if (!gameReady) return undefined;
    const controller = createSavedGameController({ ownerUid, projectId, enabled: gameReady, getIdentity, transport: gameTransport, storage, operationId,
      onChange: next => setGameState({ ...next, ownerUid, projectId }),
      onReveal: outcome => setAnimation({ type: outcome.target === 'left' ? 'lookLeft' : 'lookRight', index: 0 }),
      onSettled: () => { void instance.current?.refresh(); },
    });
    gameInstance.current = controller; void controller.start();
    return () => { controller.dispose(); gameInstance.current = null; };
  }, [ownerUid, projectId, gameReady, getIdentity, gameTransport, storage, operationId]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setOsReduced(query.matches);
    update(); query.addEventListener('change', update); return () => query.removeEventListener('change', update);
  }, []);
  const identity = getIdentity();
  const sameOwner = savedContextMatches({ enabled, ownerUid, projectId, identity, state });
  const quote = sameOwner ? state.quote : null;
  const reduced = osReduced || (sameOwner && (quote?.pet || lastPet)?.reducedMotion === true);
  useEffect(() => {
    if (!animation) return undefined;
    const sequence = getYumPalsAnimationSequence(animation.type, reduced);
    const timer = window.setTimeout(() => setAnimation(value => value && (value.index + 1 < sequence.length ? { ...value, index: value.index + 1 } : null)), sequence[animation.index]?.duration || 700);
    return () => window.clearTimeout(timer);
  }, [animation, reduced]);
  useEffect(() => {
    if (reduced) { setBlink(false); return undefined; }
    const timer = window.setTimeout(() => setBlink(!blink), blink ? 160 : 4800); return () => window.clearTimeout(timer);
  }, [blink, reduced]);
  const pet = sameOwner ? quote?.pet || (animation ? lastPet : null) : null;
  const currentGame = sameOwner && gameState?.ownerUid === ownerUid && gameState?.projectId === projectId ? gameState : null;
  const locked = savedChargeLocked(state) || !sameOwner || Boolean(animation) || Boolean(currentGame?.pending || currentGame?.busy || currentGame?.storageBlocked);
  const guess = direction => { if (sameOwner && quote?.enabled && currentGame?.game?.enabled && !state.pending && !animation) void gameInstance.current?.choose(direction); };
  const icon = PAID_CARE_ICON_ORDER[selected]; const choices = SAVED_CHOICES[icon] || [];
  const sleep = savedSleep(quote); const confirmation = sameOwner ? state.confirmation : null;
  useEffect(() => {
    if (!sleep.sleeping || reduced) { setSleepIndex(0); return undefined; }
    const timer = window.setInterval(() => setSleepIndex(n => 1 - n), 1000); return () => window.clearInterval(timer);
  }, [sleep.sleeping, reduced]);
  const chooseIcon = index => { setSelected(index); setScreen('room'); setChoice(0); instance.current?.cancel(); setLocalMessage(''); };
  const cancel = () => { instance.current?.cancel(); setLocalMessage(''); if (screen === 'room') setSelected(null); else setScreen('room'); };
  const cycle = () => { if (screen === 'game') guess('left'); else if (screen === 'choices') setChoice(n => (n + 1) % choices.length); else if (screen === 'room') chooseIcon(selected === null ? 0 : (selected + 1) % 8); };
  const confirm = () => {
    if (screen === 'game') { guess('right'); return; }
    if (screen === 'room') {
      if (!pet) { if (!locked) setScreen('adopt'); return; }
      if (icon === 'status' || icon === 'attention') setScreen('status');
      else if (choices.length) { setChoice(0); setScreen('choices'); }
    } else if (screen === 'choices') {
      const action = choices[choice];
      if (action === 'game') {
        if (!gameReady) { setLocalMessage('Game is not ready yet. Pat is available.'); return; }
        if (pet?.game || currentGame?.pending) { setScreen('game'); void gameInstance.current?.open(pet?.game?.id); return; }
      }
      const noEffect = savedNoEffect(quote, action);
      if (noEffect) { setLocalMessage(noEffect); return; }
      if (!locked) { instance.current?.prepare(action); setScreen('confirm'); }
    } else if (screen === 'adopt' && !locked) { instance.current?.prepare('adoption', adoption); setScreen('confirm'); }
    else if (screen === 'confirm' && !locked && confirmation) void instance.current?.confirm();
  };
  useEffect(() => {
    const key = event => {
      if (ignoreHandheldKey(event) || animation || state.busy || state.pending || currentGame?.busy || currentGame?.pending) return;
      const value = event.key.toLowerCase();
      if (['a', 'arrowright'].includes(value)) { event.preventDefault(); cycle(); }
      if (['b', 'enter'].includes(value)) { event.preventDefault(); confirm(); }
      if (['c', 'escape', 'arrowleft'].includes(value)) { event.preventDefault(); cancel(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const rail = start => <nav className="paid-icon-strip" aria-label={`${start ? 'Bottom' : 'Top'} care icons`}>
    {PAID_CARE_ICON_ORDER.slice(start, start + 4).map((name, n) => <button key={name} type="button" className={`paid-icon-button ${selected === start + n ? 'selected' : ''}`}
      aria-label={PAID_CARE_ICON_LABELS[name]} aria-pressed={selected === start + n} aria-describedby={`${id}-${name}`} title={`${PAID_CARE_ICON_LABELS[name]} — ${helpFor(name)}`}
      onClick={() => chooseIcon(start + n)} onMouseEnter={() => setHelp(name)} onMouseLeave={() => setHelp(null)} onFocus={() => setHelp(name)} onBlur={() => setHelp(null)}>
      <Pixels className="saved-icon" pixels={PAID_CARE_ICON_PIXELS[name]} palette={{ a: selected === start + n ? '#f5efac' : '#304837' }} />
    </button>)}
  </nav>;
  return <section className="paid-demo-shell saved-handheld" aria-label="Saved YumPals handheld">
    <header className="paid-demo-header"><div><h1>YumPals</h1><p>A little pal to care for each day.</p></div></header>
    <p className="paid-demo-warning">Your pal is saved between visits. Donuts are spent only when you confirm the price.</p>
    <p role="status">{!sameOwner ? 'Please sign in to see your saved pal.' : localMessage || state.message || (state.busy ? 'Checking your pal…' : !quote ? 'Your pal has not been checked yet.' : !quote.enabled ? 'YumPals is resting. Your teacher has paused care.' : !quote.wallet.available ? 'Your donuts could not be checked. Please ask your teacher.' : '')}</p>
    <div className="paid-demo-device" style={{ '--saved-case': savedCaseColor(pet) }}>
      <div className="paid-demo-brand">YUMPALS</div><div className="paid-demo-screen-frame">
        <div className={`paid-demo-lcd ${sleep.sleeping ? 'is-sleeping' : ''} ${sleep.dim ? 'is-bedtime-set' : ''}`}>
          {rail(0)}<div className="saved-centre">
            {screen === 'game' && <div className="saved-status">
              {currentGame?.game ? <><strong>{currentGame.game.complete ? `Finished! ${currentGame.game.score} of 3` : `Round ${currentGame.game.round + 1} of 3`}</strong>
                {pet && <Blob pet={pet} animation={animation} blink={false} sleeping={false} reduced={reduced} sleepIndex={0} />}
                <small>{currentGame.game.complete ? 'C to return' : '← A LEFT · B RIGHT → · C PAUSE'}</small></> : <p>Checking your game…</p>}
              <small role="status">{currentGame?.message || (currentGame?.busy ? 'Saving…' : currentGame?.game?.complete ? 'All done! C to return to your pal.' : !quote?.enabled ? 'Your teacher has paused YumPals.' : 'Guess which way your pal will look.')}</small>
            </div>}
            {screen === 'room' && <>
              <div className="saved-top"><span>{pet?.name || 'YUMPALS'}</span><span>{quote?.wallet.available ? `${quote.wallet.balance} DONUTS` : 'DONUTS —'}</span></div>
              {pet ? <Blob pet={pet} animation={animation} blink={blink} sleeping={sleep.sleeping} reduced={reduced} sleepIndex={sleepIndex} /> : <p>{state.busy && sameOwner ? 'Checking…' : quote && !quote.pet ? 'No pal yet. B to adopt.' : 'Please refresh.'}</p>}
              <small>{animation && !quote ? 'Updating saved care…' : pet?.game ? 'Your paid game is waiting' : quote && !quote.enabled ? 'RESTING' : 'A SELECT · B CONFIRM · C CANCEL'}</small>
            </>}
            {screen === 'choices' && <div className="saved-choices">{choices.map((action, n) => <button type="button" key={action} aria-current={n === choice ? 'true' : undefined} onClick={() => setChoice(n)}>
              {n === choice ? '▶ ' : ''}{CARE_NAMES[action]} {action === 'game' && !gameReady ? '— not ready' : action === 'game' && pet?.game ? '· Resume' : quote ? `· ${quote.prices[action]}` : ''}</button>)}<small>{icon === 'game' && pet?.game ? 'Your paid game is kept safely. Resume without paying again.' : 'B opens price confirmation'}</small></div>}
            {screen === 'status' && <div className="saved-status">{pet ? <>{[['hunger', 'Food'], ['happiness', 'Happy'], ['cleanliness', 'Clean'], ['health', 'Health']].map(([key, label]) => <div key={key}><span>{label}</span><span aria-label={`${pet.needs[key]} of 4 hearts`} className="saved-hearts">{[0, 1, 2, 3].map(n => <Pixels key={n} className="saved-meter" pixels={YUMPALS_HEART_PIXELS} palette={{ a: n < pet.needs[key] ? '#304636' : '#81936c' }} />)}</span></div>)}<small>{pet.attention ? 'Needs a gentle reminder' : 'Feeling settled'} · {pet.careDays} care days</small></> : 'Please refresh to check your pal.'}</div>}
            {screen === 'adopt' && sameOwner && <div className="saved-adopt"><label>Name<input maxLength={16} value={adoption.name} onChange={e => setAdoption(v => ({ ...v, name: e.target.value }))} /></label><label>Case<select value={adoption.casing} onChange={e => setAdoption(v => ({ ...v, casing: e.target.value }))}>{['berry', 'mint', 'sky', 'sun'].map(c => <option key={c}>{c}</option>)}</select></label><label>Colour<input type="color" value={adoption.color} onChange={e => setAdoption(v => ({ ...v, color: e.target.value }))} /></label><small>B to review adoption price</small></div>}
            {screen === 'confirm' && <div className="saved-confirm">{confirmation ? <><strong>{CARE_NAMES[confirmation.action]}?</strong><span>Cost {confirmation.quotedCost} donut{confirmation.quotedCost === 1 ? '' : 's'}</span><span>{savedEffect(quote, confirmation.action)}</span><span>{quote?.wallet.available && quote.wallet.balance >= confirmation.quotedCost ? `Donuts left: ${quote.wallet.balance - confirmation.quotedCost}` : 'Not enough donuts for this care'}</span><small>B CONFIRM PAYMENT · C CANCEL</small></> : <span>{sameOwner && state.pending ? 'Purchase needs checking below.' : 'Review your choices. C CANCEL to return.'}</span>}</div>}
          </div>{rail(4)}
        </div></div>
      <div className="paid-hardware" aria-label="Handheld buttons"><button className="paid-hardware-button" type="button" aria-label="A SELECT" onClick={cycle}><strong>A</strong><span>SELECT</span></button><button className="paid-hardware-button" type="button" aria-label="B CONFIRM" onClick={confirm} disabled={Boolean(animation) || (['confirm', 'adopt'].includes(screen) && locked)}><strong>B</strong><span>CONFIRM</span></button><button className="paid-hardware-button" type="button" aria-label="C CANCEL" onClick={cancel}><strong>C</strong><span>CANCEL</span></button></div>
    </div>
    <p className="saved-help paid-demo-hint">{help || icon ? `${PAID_CARE_ICON_LABELS[help || icon]} — ${helpFor(help || icon)}` : 'Press A SELECT to choose an icon.'}</p>
    {sameOwner && quote && <div className="paid-demo-meta" aria-label="Your donuts and care spending">
      <span>Donuts: {quote.wallet.available ? quote.wallet.balance : 'Not available'}</span>
      <span>Care today: {quote.pet?.daily.spent ?? 0} / {quote.careCap}</span>
    </div>}
    {PAID_CARE_ICON_ORDER.map(name => <span className="paid-help-accessible" id={`${id}-${name}`} key={name}>{helpFor(name)}</span>)}
    <div className="saved-utilities">{state.pending && sameOwner && <button type="button" disabled={state.busy || state.storageBlocked} onClick={() => void instance.current?.retry()}>Retry purchase</button>}<button type="button" disabled={state.busy || state.storageBlocked || !sameOwner} onClick={() => void instance.current?.refresh()}>Refresh pal</button></div>
    {currentGame?.pending && <button type="button" disabled={currentGame.busy || currentGame.storageBlocked} onClick={() => void gameInstance.current?.retry()}>Retry guess</button>}
    {screen === 'game' && <button type="button" disabled={!sameOwner || currentGame?.busy} onClick={() => void gameInstance.current?.refresh()}>Refresh game</button>}
    <details className="paid-demo-inspector"><summary>How to play</summary>
      <p>A SELECT moves through icons or choices. B CONFIRM opens your choice. C CANCEL clears a selection or returns; in a game it pauses.</p>
      <p>Choosing an icon costs nothing. Donuts are spent only when you confirm the displayed price. Health and status and Attention are free to check.</p>
      <dl className="paid-help-guide saved-help-guide">{PAID_CARE_ICON_ORDER.map(name => <div key={name}>
        <dt><Pixels className="saved-guide-icon" pixels={PAID_CARE_ICON_PIXELS[name]} palette={{ a: '#304837' }} />{PAID_CARE_ICON_LABELS[name]}</dt>
        <dd>{helpFor(name)}</dd>
      </div>)}</dl>
      <p>Your pal starts fed, happy, clean and healthy. Its needs change while you’re away, so come back to see what it needs. Holiday Mode pauses care without a catch-up penalty.</p>
      <p>{gameReady ? 'During a game, A guesses left and B guesses right. C pauses; resume without paying again. There are three rounds and no donut prizes.' : 'Game is not ready; choose Pat for happy hearts.'}</p>
      <p>Care today shows how many donuts you’ve spent caring for your pal today, out of the daily limit. Refresh pal checks your latest saved progress without spending donuts.</p>
    </details>
  </section>;
}
