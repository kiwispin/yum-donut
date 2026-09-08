import { validSavedGameRead, validSavedGameChoice } from './savedGameProtocol.js';
const validators = { yumpalsGetSavedGame: validSavedGameRead, yumpalsChooseSavedGame: validSavedGameChoice };
const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const failure = (reason = 'UNAVAILABLE') => Object.assign(new Error('We could not confirm your game. Please try again.'), { details: { reason } });
// No HTTP error is proof that a guess did not commit. Preserve its journal.
export function createSavedGameTransport({ projectId, enabled, getCurrentUser, fetchImpl = (...args) => fetch(...args), timeoutMs = 15000 }) {
  return async (name, data, context) => {
    if (enabled !== true) throw failure('ROLLOUT_NOT_READY');
    if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(projectId)
      || !Object.hasOwn(validators, name) || !validators[name](data)
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw failure();
    const captured = getCurrentUser();
    const current = () => typeof context?.ownerUid === 'string' && context.ownerUid.length > 0
      && typeof context.isActive === 'function' && context.isActive() === true
      && getCurrentUser() === captured && captured?.uid === context.ownerUid && captured.isAnonymous === false;
    if (!current()) throw failure('UNAUTHENTICATED');
    // Copy before awaiting a token: callers cannot change an in-flight guess.
    const bodyText = JSON.stringify({ data });
    const abort = new AbortController(); let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(failure()); }, timeoutMs); });
    try {
      const token = await Promise.race([captured.getIdToken(), timeout]);
      if (!current()) throw failure('UNAUTHENTICATED');
      if (abort.signal.aborted || typeof token !== 'string' || !token || /[\r\n]/u.test(token)) throw failure();
      const response = await Promise.race([fetchImpl(`https://us-central1-${projectId}.cloudfunctions.net/${name}`, {
        method: 'POST', redirect: 'error', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: bodyText,
      }), timeout]);
      const body = await Promise.race([response.json(), timeout]);
      if (!current()) throw failure('UNAUTHENTICATED');
      if (!response.ok || !plain(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'result')) throw failure();
      return body.result;
    } catch (error) {
      throw failure(error?.details?.reason === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'UNAVAILABLE');
    } finally { clearTimeout(timer); }
  };
}
