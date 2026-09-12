// Internal factory only. No default/live resolvers or deployed exports.
const { createPaidCareService } = require('./paidCareService');
const { requireValue } = require('./paidCareEngine');

const REASONS = ['ROLLOUT_NOT_READY', 'MIGRATION_REQUIRED', 'CORRUPT_STATE', 'CORRUPT_RECEIPT', 'CORRUPT_REFUSAL',
  'OPERATION_CONFLICT', 'CONFIG_MISSING', 'INVALID_CONFIG', 'INVALID_CALENDAR', 'INVALID_PAUSES', 'INVALID_DATE',
  'INVALID_CLOCK', 'CLOCK_REVERSED', 'CALENDAR_HISTORY_CHANGED', 'PAUSE_HISTORY_CHANGED',
  'TRUSTED_MAPPING_REQUIRED', 'INVALID_WALLET_MAPPING', 'WALLET_MIRROR_MISSING', 'WALLET_OWNER_CONFLICT',
  'INVALID_WALLET_BALANCE', 'WALLET_BALANCE_CONFLICT', 'CORRUPT_WALLET', 'INVALID_WALLET_DEBIT'];
const INVALID = ['INVALID_REQUEST', 'INVALID_OPERATION', 'INVALID_ACTION', 'INVALID_CONFIG_VERSION', 'INVALID_CONFIG_HASH', 'INVALID_ADOPTION'];
const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]));
function projectOutcome(result) {
  const source = result.receipt || result.refusal;
  const common = pick(source, ['schemaVersion', 'status', 'ownerUid', 'operationId', 'binding', 'committedAtMs']);
  const request = pick(source.request, ['operationId', 'action', 'expectedConfigVersion', 'expectedConfigHash']);
  request.adoption = source.request.adoption === null ? null : pick(source.request.adoption, ['name', 'species', 'casing', 'color']);
  if (result.refusal) return { outcome: { ...common, request, reason: source.reason }, duplicate: result.duplicate };
  const benefit = source.benefit.type === 'adoption' ? { type: 'adoption', needs: pick(source.benefit.needs, ['hunger', 'happiness', 'cleanliness', 'health']) }
    : source.benefit.type === 'sleep' ? pick(source.benefit, ['type', 'date'])
      : source.benefit.type === 'attention' ? pick(source.benefit, ['type', 'cleared']) : pick(source.benefit, ['type', 'amount']);
  return { outcome: { ...common, request, ...pick(source, ['action', 'amount', 'configVersion', 'configHash', 'walletBefore', 'walletAfter']), benefit }, duplicate: result.duplicate,
    ...(result.state ? { state: result.state } : {}) };
}
function createPaidCareCallables({ db, refs, walletAdapter, HttpsError, ready, now, elapsedCare = false }) {
  requireValue(typeof refs?.refusal === 'function', 'REFUSAL_RESOLVER_REQUIRED');
  const service = createPaidCareService({ db, refs, walletAdapter, now, elapsedCare });
  const wrap = (method, project = value => value) => async request => {
    try {
      const uid = request?.auth?.uid; const provider = request?.auth?.token?.firebase?.sign_in_provider;
      requireValue(typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !uid.includes('/')
        && typeof provider === 'string' && provider.length > 0 && provider !== 'anonymous', 'UNAUTHENTICATED');
      requireValue(typeof ready === 'function' && ready() === true, 'ROLLOUT_NOT_READY');
      return project(await service[method](request));
    } catch (error) {
      const known = typeof error?.code === 'string';
      const reason = known && (REASONS.includes(error.code) || INVALID.includes(error.code) || error.code === 'UNAUTHENTICATED') ? error.code : 'UNAVAILABLE';
      const code = reason === 'UNAUTHENTICATED' ? 'unauthenticated' : INVALID.includes(reason) ? 'invalid-argument' : reason === 'UNAVAILABLE' ? 'unavailable' : 'failed-precondition';
      const message = reason === 'UNAUTHENTICATED' ? 'Please sign in again to see your pal.'
        : reason === 'ROLLOUT_NOT_READY' ? 'Saved YumPals is not ready yet.'
          : reason === 'UNAVAILABLE' ? 'We could not confirm this request. Please try again.'
            : 'Your pal or account needs checking. Please ask your teacher.';
      throw new HttpsError(code, message, { reason });
    }
  };
  return { getState: wrap('getHandheldState'), purchase: wrap('purchase', projectOutcome) };
}
module.exports = { createPaidCareCallables };
