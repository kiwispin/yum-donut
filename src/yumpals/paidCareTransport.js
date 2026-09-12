import { validPaidCareRequest } from './paidCareClient.js';
const NAMES = ['yumpalsGetPaidCareState', 'yumpalsPurchaseCare'];
const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const failure = (reason = 'UNAVAILABLE') => Object.assign(new Error('Your request could not be confirmed.'), { details: { reason } });
// HTTP failures never provide terminal purchase proof. Only normal validated
// receipt/refusal outcomes can release a purchase journal.
export function createPaidCareTransport({ projectId, enabled, getCurrentUser, fetchImpl = (...args) => fetch(...args), timeoutMs = 15000 }) {
  let warm = null;
  const transport = async (name, data, context) => {
    if (enabled !== true) throw failure('ROLLOUT_NOT_READY');
    if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(projectId) || !NAMES.includes(name)
      || !plain(data) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw failure();
    if (name === 'yumpalsGetPaidCareState' ? Object.keys(data).length !== 0 : !validPaidCareRequest(data)) throw failure();
    const captured = getCurrentUser();
    const current = () => typeof context?.ownerUid === 'string' && context.ownerUid.length > 0
      && typeof context.isActive === 'function' && context.isActive() === true
      && getCurrentUser() === captured && captured?.uid === context.ownerUid && captured.isAnonymous === false;
    if (!current()) throw failure('UNAUTHENTICATED');
    if (name === 'yumpalsPurchaseCare') warm = null;
    const abort = new AbortController(); let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(failure()); }, timeoutMs); });
    try {
      const token = await Promise.race([captured.getIdToken(), timeout]);
      if (!current() || abort.signal.aborted) throw failure('UNAUTHENTICATED');
      if (typeof token !== 'string' || !token || /[\r\n]/u.test(token)) throw failure();
      const response = await Promise.race([fetchImpl(`https://us-central1-${projectId}.cloudfunctions.net/${name}`, {
        method: 'POST', redirect: 'error', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: name === 'yumpalsPurchaseCare' ? { ...data, includeState: true } : data }),
      }), timeout]);
      const body = await Promise.race([response.json(), timeout]);
      if (!plain(body) || Object.keys(body).length !== 1) throw failure();
      if (Object.hasOwn(body, 'error')) {
        if (response.ok || !plain(body.error)) throw failure();
        const { status, details } = body.error;
        if (status === 'UNAUTHENTICATED' && response.status === 401) throw failure('UNAUTHENTICATED');
        if (status === 'PERMISSION_DENIED' && response.status === 403) throw failure('PERMISSION_DENIED');
        if (status === 'FAILED_PRECONDITION' && response.status === 400 && plain(details)
          && Object.hasOwn(details, 'reason') && ['ROLLOUT_NOT_READY', 'MIGRATION_REQUIRED'].includes(details.reason)) throw failure(details.reason);
        throw failure();
      }
      if (!response.ok || !Object.hasOwn(body, 'result')) throw failure();
      if (current() && name === 'yumpalsGetPaidCareState') warm = { user: captured, at: Date.now(), value: structuredClone(body.result) };
      return body.result;
    } catch (error) {
      const reason = error?.details?.reason;
      throw failure(typeof reason === 'string' && ['UNAUTHENTICATED', 'PERMISSION_DENIED', 'ROLLOUT_NOT_READY', 'MIGRATION_REQUIRED'].includes(reason) ? reason : 'UNAVAILABLE');
    } finally { clearTimeout(timer); }
  };
  transport.peek = ownerUid => warm && enabled === true && getCurrentUser() === warm.user && warm.user?.uid === ownerUid
    && !warm.user.isAnonymous && Date.now() - warm.at < 10000 ? structuredClone(warm.value) : null;
  return transport;
}
