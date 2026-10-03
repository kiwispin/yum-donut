const { readDocuments } = require('./readDocuments');
function createHolidayMode({ db, globalRef, historyRef, receiptRef, HttpsError, now = Date.now }) {
  return async request => {
    if (!request.auth?.uid || request.auth.token?.yumpalsAdmin !== true || request.auth.token?.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', 'Please sign in as the teacher.');
    const data = request.data;
    if (!data || Object.keys(data).length !== 3 || typeof data.enabled !== 'boolean' || typeof data.expected !== 'boolean' || typeof data.operationId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(data.operationId)) throw new HttpsError('invalid-argument', 'Please refresh settings.');
    return db.runTransaction(async t => {
      const ref = receiptRef(request.auth.uid, data.operationId);
      const [global, history, receipt] = await Promise.all([globalRef, historyRef, ref].map(r => t.get(r)));
      if (receipt.exists) {
        const saved = receipt.data();
        if (saved.enabled !== data.enabled || saved.expected !== data.expected) throw new HttpsError('failed-precondition', 'Please refresh settings.');
        return { enabled: saved.enabled };
      }
      const current = global.exists ? global.data().holiday_mode === true : false;
      if (current !== data.expected) throw new HttpsError('failed-precondition', 'Holiday Mode changed. Please refresh settings.');
      const periods = history.exists ? history.data().periods.map(p => ({...p})) : current ? [{from:0,to:null}] : [];
      // A legacy client may have enabled the public switch without history.
      // Prefer a generous rest interval over charging pets for an unknown break.
      if (current && periods.at(-1)?.to !== null) periods.push({from:periods.at(-1)?.to || 0,to:null});
      const time = now();
      if (!current && periods.at(-1)?.to === null) periods[periods.length-1].to = time;
      if (data.enabled !== current) {
        if (data.enabled) periods.push({from:time,to:null});
        else if (periods.at(-1)?.to === null) periods[periods.length-1].to = time;
      }
      if (periods.length > 512) throw new HttpsError('failed-precondition', 'Please ask for a Holiday Mode history check.');
      t.set(globalRef, { ...(global.exists ? global.data() : {}), holiday_mode: data.enabled });
      t.set(historyRef, { periods, enabled: data.enabled });
      t.set(ref, { ...data, at:time });
      return { enabled:data.enabled };
    });
  };
}
function holidayRefs(refs) {
  return refs.holidayGlobal ? [refs.holidayGlobal(), refs.holidayHistory()] : [];
}
function applyHolidayMode(config, snapshots) {
  if (!snapshots.length) return config;
  const [global, history] = snapshots;
  const enabled = global.exists && global.data().holiday_mode === true;
  const data = history.exists ? history.data() : {enabled:false,periods:[]};
  // Fail closed if an old client changed the global switch outside the paired update.
  const matched = enabled === data.enabled;
  return { ...config, enabled:config.enabled && !enabled && matched, holidayPeriods:data.periods };
}
async function withHolidayMode(t, config, refs) {
  return applyHolidayMode(config, await readDocuments(t, holidayRefs(refs)));
}
module.exports = { createHolidayMode, withHolidayMode, holidayRefs, applyHolidayMode };
