import { validPaidCareRequest, validateHandheldView } from './paidCareClient.js';
const NAMES = ['yumpalsGetPaidCareState', 'yumpalsPurchaseCare'];
const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const failure = (reason = 'UNAVAILABLE') => Object.assign(new Error('Your request could not be confirmed.'), { details: { reason } });
// HTTP failures never provide terminal purchase proof. Only normal validated
// receipt/refusal outcomes can release a purchase journal.
export function createPaidCareTransport({ projectId, enabled, getCurrentUser, fetchImpl = (...args) => fetch(...args), timeoutMs = 15000 }) {
  let warm = null; let cacheVersion = 0; let readSerial = 0;
  let sharedRead = null;
  const send = async (name, data, context) => {
    if (enabled !== true) throw failure('ROLLOUT_NOT_READY');
    if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(projectId) || !NAMES.includes(name)
      || !plain(data) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw failure();
    if (name === 'yumpalsGetPaidCareState' ? Object.keys(data).length !== 0 : !validPaidCareRequest(data)) throw failure();
    const captured = getCurrentUser();
    const current = () => typeof context?.ownerUid === 'string' && context.ownerUid.length > 0
      && typeof context.isActive === 'function' && context.isActive() === true
      && getCurrentUser() === captured && captured?.uid === context.ownerUid && captured.isAnonymous === false;
    if (!current()) throw failure('UNAUTHENTICATED');
    if (name === 'yumpalsPurchaseCare') { warm = null; cacheVersion++; }
    const version = cacheVersion;
    const serial = name === 'yumpalsGetPaidCareState' ? ++readSerial : null;
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
      if (current() && name === 'yumpalsGetPaidCareState' && version === cacheVersion && serial === readSerial) warm = { user: captured, at: Date.now(), value: structuredClone(body.result) };
      return body.result;
    } catch (error) {
      const reason = error?.details?.reason;
      throw failure(typeof reason === 'string' && ['UNAUTHENTICATED', 'PERMISSION_DENIED', 'ROLLOUT_NOT_READY', 'MIGRATION_REQUIRED'].includes(reason) ? reason : 'UNAVAILABLE');
    } finally { clearTimeout(timer); }
  };
  const transport = async (name, data, context) => {
    const user = getCurrentUser();
    const active = () => enabled === true && user && user === getCurrentUser() && user.isAnonymous === false
      && context?.ownerUid === user.uid && typeof context.isActive === 'function' && context.isActive() === true;
    if (name !== 'yumpalsGetPaidCareState' || !plain(data) || Object.keys(data).length || !active()) return send(name, data, context);
    // Each consumer retains its own cancellation/identity check. Writes never join.
    if (!sharedRead || sharedRead.user !== user || sharedRead.version !== cacheVersion) {
      const entry = { user, version: cacheVersion, subscribers: [active], promise: null };
      sharedRead = entry;
      entry.promise = send(name, data, { ownerUid: user.uid, isActive: () => entry.subscribers.some(check => check()) })
        .finally(() => { if (sharedRead === entry) sharedRead = null; });
    } else sharedRead.subscribers.push(active);
    return sharedRead.promise.then(value => {
      if (!active()) throw failure('UNAUTHENTICATED');
      return structuredClone(value);
    });
  };
  const peek = (ownerUid, age) => warm && enabled === true && getCurrentUser() === warm.user && warm.user?.uid === ownerUid
    && !warm.user.isAnonymous && Date.now() - warm.at < age ? structuredClone(warm.value) : null;
  transport.peek = ownerUid => peek(ownerUid, 10000);
  // Older in-memory state is only for immediate display while start refreshes.
  transport.peekRecent = ownerUid => peek(ownerUid, 60000);
  transport.remember = value => {
    const user = getCurrentUser();
    if (enabled !== true || !user || user.isAnonymous !== false || user.uid !== value?.ownerUid) return;
    const checked = validateHandheldView(value, user.uid);
    cacheVersion++;
    warm = { user, at: Date.now(), value: checked };
  };
  return transport;
}
