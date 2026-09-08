// Internal factory only: deliberately absent from production endpoint exports.
const { createSavedGameService } = require('./savedGameService');
const PRECONDITIONS = new Set(['ROLLOUT_NOT_READY', 'GAME_PURCHASE_REQUIRED', 'NO_PET',
  'GAME_ENTITLEMENT_MISSING', 'CORRUPT_GAME', 'CORRUPT_GAME_TURN', 'CORRUPT_RECEIPT',
  'CORRUPT_STATE', 'CONFIG_MISSING', 'OPERATION_CONFLICT', 'DISABLED',
  'GAME_ROUND_CONFLICT', 'CLOCK_REVERSED']);

function createSavedGameCallables({ HttpsError, ...dependencies }) {
  const service = createSavedGameService(dependencies);
  const wrap = method => async request => {
    try {
      return await service[method](request);
    } catch (error) {
      const reason = error?.code === 'UNAUTHENTICATED' || error?.code === 'INVALID_REQUEST'
        || PRECONDITIONS.has(error?.code) ? error.code : 'UNAVAILABLE';
      const code = reason === 'UNAUTHENTICATED' ? 'unauthenticated'
        : reason === 'INVALID_REQUEST' ? 'invalid-argument'
          : reason === 'UNAVAILABLE' ? 'unavailable' : 'failed-precondition';
      const message = reason === 'UNAUTHENTICATED' ? 'Please sign in again to see your pal.'
        : reason === 'DISABLED' ? 'Your teacher has paused YumPals.'
          : reason === 'ROLLOUT_NOT_READY' ? 'Your pal’s game is not ready yet.'
            : 'We could not confirm your game. Please try again.';
      throw new HttpsError(code, message, { reason });
    }
  };
  return { getGame: wrap('getGame'), choose: wrap('choose') };
}
module.exports = { createSavedGameCallables };
