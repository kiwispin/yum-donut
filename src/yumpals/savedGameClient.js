import { validSavedGameChoice, validSavedGameView, validSavedGameOutcome, advanceSavedGameView } from './savedGameProtocol.js';

export function createSavedGameController({ ownerUid, projectId, enabled, getIdentity, transport, storage,
  operationId = () => crypto.randomUUID(), onChange = () => {}, onReveal = () => {}, onSettled = () => {} }) {
  const key = `yumpals-saved-guess-v1:${encodeURIComponent(projectId)}:${encodeURIComponent(ownerUid)}`;
  let disposed = false; let pending = null; let raw = null;
  const state = { game: null, pending: false, pendingChoice: null, busy: false, storageBlocked: false, message: '' };
  const active = () => {
    const identity = getIdentity();
    return !disposed && enabled === true && typeof ownerUid === 'string' && ownerUid.length > 0
      && typeof projectId === 'string' && projectId.length > 0 && identity?.uid === ownerUid
      && identity.isAnonymous === false && identity.sandbox !== true;
  };
  const context = { ownerUid, isActive: active };
  const snapshot = () => structuredClone(state);
  const emit = () => { if (active()) onChange(snapshot()); };
  const safely = callback => { try { callback(); } catch { /* UI callbacks cannot change committed results. */ } };
  function load() {
    try {
      raw = storage.getItem(key);
      if (raw === null) return;
      const value = JSON.parse(raw);
      if (!value || Object.keys(value).length !== 4 || value.schemaVersion !== 1
        || value.ownerUid !== ownerUid || value.projectId !== projectId || !validSavedGameChoice(value.request)) throw new Error();
      pending = value.request; state.pending = true; state.pendingChoice = pending.choice;
    } catch { state.storageBlocked = true; state.message = 'Your saved guess needs checking. Please ask your teacher.'; }
  }
  function unchanged() {
    try { if (storage.getItem(key) === raw) return true; } catch { /* Preserve unknown storage. */ }
    state.storageBlocked = true; state.message = 'Your saved guess changed. Please reopen your pal.'; return false;
  }
  function clear() {
    if (!active() || !unchanged()) return false;
    try {
      storage.removeItem(key);
      if (storage.getItem(key) !== null) throw new Error();
      raw = null; pending = null; state.pending = false; state.pendingChoice = null; return true;
    } catch { state.storageBlocked = true; state.message = 'We could not save your progress on this device.'; return false; }
  }
  async function read(gameId) {
    const view = await transport('yumpalsGetSavedGame', { gameId }, context);
    if (!active()) return null;
    if (!validSavedGameView(view, ownerUid, gameId)) throw new Error();
    state.game = structuredClone(view); return view;
  }
  async function open(gameId, fresh = false) {
    if (!active() || state.busy || state.storageBlocked) return;
    if (!fresh && !pending && state.game?.gameId === gameId) { state.message = ''; emit(); return; }
    state.busy = true; emit();
    try { await read(pending?.gameId || gameId); }
    catch { if (active()) state.message = 'We could not load your game. Please try again.'; }
    finally { state.busy = false; emit(); }
  }
  async function send(retry) {
    if (!active() || state.busy || state.storageBlocked || !pending || !unchanged()) { emit(); return; }
    state.busy = true; state.message = ''; emit();
    const request = structuredClone(pending);
    try {
      const result = await transport('yumpalsChooseSavedGame', request, context);
      if (!active() || !await validSavedGameOutcome(result, ownerUid, request) || !active()) throw new Error();
      if (!clear()) return;
      if (!retry && result.duplicate === false) safely(() => onReveal(structuredClone(result.outcome)));
      const next = !retry && !result.duplicate ? advanceSavedGameView(state.game, result.outcome) : null;
      if (next) state.game = next;
      else await read(request.gameId);
      if (state.game?.complete) safely(onSettled);
    } catch {
      if (!active()) return;
      state.message = pending ? 'Your guess is saved on this device. Retry to check what happened.'
        : 'Your guess was saved. Refresh to see your game.';
      // Explicit retry may reconcile an immutable completed round. Reads alone
      // never clear a journal or automatically submit a guess.
      if (retry && pending && !state.storageBlocked) {
        try {
          const view = await read(request.gameId); const turn = view?.turns[request.round];
          if (active() && turn && (turn.operationId !== request.operationId || turn.choice === request.choice) && clear()) {
            state.message = 'This round is already saved. You can continue your game.'; safely(onSettled);
          }
        } catch { /* Retain the exact request until server proof is available. */ }
      }
    } finally { state.busy = false; emit(); }
  }
  async function choose(choice) {
    if (!active() || state.busy || state.pending || state.storageBlocked || !state.game?.enabled || state.game.complete || !unchanged()) { emit(); return; }
    const request = { gameId: state.game.gameId, operationId: operationId(), round: state.game.round, choice };
    if (!validSavedGameChoice(request)) return;
    try {
      const next = JSON.stringify({ schemaVersion: 1, ownerUid, projectId, request });
      storage.setItem(key, next); raw = next;
      if (!unchanged()) { emit(); return; }
      pending = request; state.pending = true; state.pendingChoice = request.choice;
    } catch { state.storageBlocked = true; state.message = 'We could not save your guess. Nothing was sent.'; emit(); return; }
    await send(false);
  }
  return {
    getState: snapshot, open, choose, retry: () => send(true),
    // Called only with the paid-care controller's validated fresh receipt.
    // A newly purchased game has no turns yet, so avoid a redundant initial read.
    openPurchased(receipt) {
      if (!active() || state.busy || pending || state.storageBlocked || receipt?.schemaVersion !== 1
        || receipt.status !== 'COMMITTED' || receipt.ownerUid !== ownerUid || receipt.action !== 'game'
        || receipt.benefit?.type !== 'happiness' || !Number.isInteger(receipt.benefit.amount)
        || receipt.benefit.amount < 1 || receipt.benefit.amount > 4) return false;
      const game = { schemaVersion: 1, ownerUid, gameId: receipt.operationId, enabled: true, round: 0, complete: false, score: 0, turns: [] };
      if (!validSavedGameView(game, ownerUid, receipt.operationId)) return false;
      if (state.game?.gameId === receipt.operationId) return true; // Never reset an already-started round.
      state.game = game; state.message = ''; emit(); return true;
    },
    async start() { if (!active()) return; load(); emit(); if (pending && !state.storageBlocked) await open(pending.gameId); },
    refresh: () => open(pending?.gameId || state.game?.gameId, true),
    dispose() { disposed = true; },
  };
}
