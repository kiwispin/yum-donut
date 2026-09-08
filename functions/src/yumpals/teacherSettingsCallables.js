const { createTeacherSettingsService } = require('./teacherSettingsService');

const ERRORS = {
  UNAUTHENTICATED: ['unauthenticated', 'Please sign in again to manage YumPals.'],
  PERMISSION_DENIED: ['permission-denied', 'This account cannot change YumPals settings. Please ask your school administrator.'],
  ROLLOUT_NOT_READY: ['failed-precondition', 'YumPals is not ready for release yet.'],
  SETTINGS_CONFLICT: ['aborted', 'Someone changed these settings. Review the latest settings and choose again.'],
  OPERATION_CONFLICT: ['failed-precondition', 'This save could not be confirmed. Please ask your school administrator.'],
  INVALID_SETTINGS: ['invalid-argument', 'These settings could not be checked. Please refresh and try again.'],
  INVALID_CONFIG: ['failed-precondition', 'These settings need to be checked by your school administrator.'],
  INVALID_CALENDAR: ['failed-precondition', 'The school dates need to be checked by your school administrator.'],
  INVALID_PAUSES: ['failed-precondition', 'The pet rest dates need to be checked by your school administrator.'],
  INVALID_DATE: ['failed-precondition', 'The school dates need to be checked by your school administrator.'],
  INVALID_CLOCK: ['failed-precondition', 'The school time could not be checked. Please try again later.'],
  CLOCK_REVERSED: ['failed-precondition', 'The school time needs to be checked. Please try again later.'],
  GLOBAL_ABSENCES_FORBIDDEN: ['failed-precondition', 'These school settings need to be checked by your administrator.'],
  CUTOVER_REVIEW_REQUIRED: ['failed-precondition', 'YumPals needs a release check by your school administrator.'],
  CORRUPT_SETTINGS_RECEIPT: ['failed-precondition', 'This save could not be confirmed. Please ask your school administrator.'],
};

function createTeacherSettingsCallables({ db, refs, HttpsError, ready, now }) {
  const service = createTeacherSettingsService({ db, refs, now });
  const wrap = method => async request => {
    try {
      const uid = request?.auth?.uid; const provider = request?.auth?.token?.firebase?.sign_in_provider;
      if (typeof uid !== 'string' || !uid.length || uid.length > 128 || uid.includes('/') || typeof provider !== 'string' || !provider || provider === 'anonymous') throw { code: 'UNAUTHENTICATED' };
      if (request.auth.token.yumpalsAdmin !== true) throw { code: 'PERMISSION_DENIED' };
      // One-time deployment readiness, NOT a care-pause or enabled switch.
      if (typeof ready !== 'function' || ready() !== true) throw { code: 'ROLLOUT_NOT_READY' };
      return await service[method](request);
    } catch (error) {
      const reason = Object.hasOwn(ERRORS, error?.code) ? error.code : 'UNAVAILABLE';
      const [code, message] = ERRORS[reason] || ['unavailable', 'YumPals could not confirm this request. Please try again.'];
      throw new HttpsError(code, message, { reason });
    }
  };
  return { getSettings: wrap('getSettings'), updateSettings: wrap('updateSettings') };
}
module.exports = { createTeacherSettingsCallables };
