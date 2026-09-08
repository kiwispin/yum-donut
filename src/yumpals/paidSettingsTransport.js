// Documented callable HTTP envelope, pinned to a captured Firebase Auth user.
// No legacy transport changes, credential discovery, token storage or logging.
const NAMES = new Set(['yumpalsGetPaidSettings', 'yumpalsUpdatePaidSettings']);
const STATUS = {
  UNAUTHENTICATED: 'UNAUTHENTICATED', PERMISSION_DENIED: 'PERMISSION_DENIED',
  ROLLOUT_NOT_READY: 'FAILED_PRECONDITION', SETTINGS_CONFLICT: 'ABORTED',
  INVALID_SETTINGS: 'INVALID_ARGUMENT', OPERATION_CONFLICT: 'FAILED_PRECONDITION',
  INVALID_CONFIG: 'FAILED_PRECONDITION', INVALID_CALENDAR: 'FAILED_PRECONDITION', INVALID_PAUSES: 'FAILED_PRECONDITION',
  INVALID_DATE: 'FAILED_PRECONDITION', INVALID_CLOCK: 'FAILED_PRECONDITION', CLOCK_REVERSED: 'FAILED_PRECONDITION',
  GLOBAL_ABSENCES_FORBIDDEN: 'FAILED_PRECONDITION', CUTOVER_REVIEW_REQUIRED: 'FAILED_PRECONDITION', CORRUPT_SETTINGS_RECEIPT: 'FAILED_PRECONDITION',
  UNAVAILABLE: 'UNAVAILABLE',
};
const HTTP = { UNAUTHENTICATED: 401, PERMISSION_DENIED: 403, FAILED_PRECONDITION: 400, ABORTED: 409, INVALID_ARGUMENT: 400, UNAVAILABLE: 503 };
const error = (reason = 'UNAVAILABLE') => Object.assign(new Error('YumPals request could not be confirmed.'), { details: { reason } });
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

export function createPaidSettingsTransport({ projectId, enabled, getCurrentUser, fetchImpl = (...args) => fetch(...args), timeoutMs = 15000 }) {
  return async (name, data, context) => {
    if (enabled !== true) throw error('ROLLOUT_NOT_READY');
    if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(projectId) || !NAMES.has(name)
      || !plain(data) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw error();
    const keys = Object.keys(data);
    if (name === 'yumpalsGetPaidSettings' ? keys.length !== 0 : keys.length !== 4 || !['operationId', 'expectedVersion', 'expectedSettingsHash', 'enabled'].every(key => Object.hasOwn(data, key))) throw error('INVALID_SETTINGS');
    const captured = getCurrentUser();
    const stillCurrent = () => context && typeof context.ownerUid === 'string' && context.ownerUid.length > 0
      && typeof context.isActive === 'function' && context.isActive() === true && getCurrentUser() === captured
      && captured?.uid === context.ownerUid && captured.isAnonymous === false;
    if (!stillCurrent()) throw error('UNAUTHENTICATED');
    const abort = new AbortController(); let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(error()); }, timeoutMs); });
    try {
      // getIdToken belongs to this exact user object; never reselect auth.currentUser.
      const token = await Promise.race([captured.getIdToken(true), timeout]);
      if (!stillCurrent() || abort.signal.aborted) throw error('UNAUTHENTICATED');
      if (typeof token !== 'string' || !token || /[\r\n]/u.test(token)) throw error();
      const url = `https://us-central1-${projectId}.cloudfunctions.net/${name}`;
      const response = await Promise.race([fetchImpl(url, { method: 'POST', redirect: 'error', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data }) }), timeout]);
      const body = await Promise.race([response.json(), timeout]);
      if (!plain(body)) throw error();
      if (Object.hasOwn(body, 'error')) {
        // Only an unambiguous protocol error may prove a definite CAS refusal.
        if (Object.keys(body).length !== 1 || response.ok || !plain(body.error) || !Object.hasOwn(body.error, 'status')) throw error();
        const status = body.error.status;
        if (typeof status !== 'string' || !Object.hasOwn(HTTP, status) || response.status !== HTTP[status]) throw error();
        const details = body.error.details;
        const reason = plain(details) && Object.hasOwn(details, 'reason') ? details.reason : undefined;
        if (typeof reason === 'string' && Object.hasOwn(STATUS, reason) && STATUS[reason] === status) throw error(reason);
        // Firebase may reject authentication before our wrapper supplies details.
        if (reason === undefined && ['UNAUTHENTICATED', 'PERMISSION_DENIED'].includes(status)) throw error(status);
        throw error();
      }
      if (!response.ok || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'result')) throw error();
      return body.result;
    } catch (caught) {
      const reason = caught?.details?.reason;
      throw error(typeof reason === 'string' && Object.hasOwn(STATUS, reason) ? reason : 'UNAVAILABLE');
    } finally { clearTimeout(timer); }
  };
}
