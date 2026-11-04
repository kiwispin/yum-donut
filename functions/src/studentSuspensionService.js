'use strict';

// Suspend or restore a student who is having a break from the Team. Nothing is
// deleted: donuts, bank, trophies, looks and their pal all stay as they are.
// Suspending takes them off the roster (so they leave the sign-in list, Give,
// the Leaderboard and the Teams bot), switches off their sign-in account, and
// starts a break on their pal's clock so it doesn't fall ill while they're away.
// Restoring reverses all three; their password is unchanged.
const APP_ID = 'yum-donut-school';
const MAX_BREAKS = 512;
const normalize = value => String(value || '').normalize('NFKC').trim();

function validPeriods(periods) {
  return Array.isArray(periods) && periods.length <= MAX_BREAKS && periods.every((period, index) =>
    Number.isSafeInteger(period?.from) && period.from >= 0
    && (period.to === null ? index === periods.length - 1 : Number.isSafeInteger(period.to) && period.to >= period.from)
    && (index === 0 || (periods[index - 1].to !== null && period.from >= periods[index - 1].to)));
}

// Open a break now unless one is already open.
function startBreak(periods, nowMs) {
  return periods.at(-1)?.to === null ? periods : [...periods, { from: nowMs, to: null }];
}

// Close the open break now, if there is one.
function endBreak(periods, nowMs) {
  if (periods.at(-1)?.to !== null || !periods.length) return periods;
  return [...periods.slice(0, -1), { ...periods.at(-1), to: Math.max(nowMs, periods.at(-1).from) }];
}

function createStudentSuspensionService({ authAdmin, db, HttpsError, arrayUnion, arrayRemove, now = Date.now }) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const missingAuthUser = error => error?.code === 'auth/user-not-found';
  const roster = db.doc(`artifacts/${APP_ID}/public/data/config/roster`);
  const publicUser = name => db.doc(`artifacts/${APP_ID}/public/data/users/${name}`);
  const breaks = uid => db.doc(`artifacts/${APP_ID}/yumpals/main/breaks/${uid}`);

  async function setSignIn(uid, disabled) {
    try {
      await authAdmin.updateUser(uid, { disabled });
      // Signed-in devices lose their session within the hour, not just new sign-ins.
      if (disabled) await authAdmin.revokeRefreshTokens(uid);
      return true;
    } catch (error) {
      if (missingAuthUser(error)) return false;
      throw error;
    }
  }

  async function updateBreaks(uid, change) {
    const ref = breaks(uid);
    const snap = await ref.get();
    const periods = snap.exists ? snap.data().periods : [];
    if (!validPeriods(periods)) fail('failed-precondition', 'This student’s pal break history needs checking. Ask the administrator to review it.');
    const next = change(periods, now());
    if (next.length > MAX_BREAKS) fail('failed-precondition', 'This student has had too many breaks recorded. Ask the administrator to review it.');
    if (next !== periods) await ref.set({ periods: next });
  }

  return async request => {
    const caller = request.auth;
    if (!caller?.uid || caller.token?.yumpalsAdmin !== true
      || caller.token?.firebase?.sign_in_provider === 'anonymous') {
      fail('permission-denied', 'Only the signed-in teacher can suspend or restore students.');
    }
    const data = request.data;
    if (!data || Object.keys(data).length !== 2 || !['suspend', 'restore'].includes(data.action)
      || typeof data.name !== 'string' || !data.name || data.name.length > 80 || normalize(data.name) !== data.name
      || /[/\\]/u.test(data.name) || [...data.name].some(character => character.codePointAt(0) < 32)) {
      fail('invalid-argument', 'Choose a student to suspend or restore.');
    }
    const name = data.name;
    const [rosterSnap, publicSnap] = await Promise.all([roster.get(), publicUser(name).get()]);
    const rosterData = rosterSnap.exists ? rosterSnap.data() : {};
    const names = Array.isArray(rosterData.names) ? rosterData.names : [];
    const removed = Array.isArray(rosterData.removed_names) ? rosterData.removed_names : [];
    if (!names.includes(name) && !removed.includes(name)) fail('not-found', 'That student is not on the roster.');
    const uid = publicSnap.exists && typeof publicSnap.data().uid === 'string' ? publicSnap.data().uid : null;
    if (uid === caller.uid) fail('failed-precondition', 'You can’t suspend your own teacher account.');

    // Each step is safe to repeat, so a retry after a failure finishes the job.
    if (data.action === 'suspend') {
      const signInOff = uid ? await setSignIn(uid, true) : false;
      if (uid) await updateBreaks(uid, startBreak);
      await roster.set({ names: arrayRemove(name), removed_names: arrayUnion(name), suspended_names: arrayUnion(name) }, { merge: true });
      return { name, suspended: true, signInOff };
    }
    if (uid) await updateBreaks(uid, endBreak);
    const signInOn = uid ? await setSignIn(uid, false) : false;
    await roster.set({ names: arrayUnion(name), removed_names: arrayRemove(name), suspended_names: arrayRemove(name) }, { merge: true });
    return { name, suspended: false, signInOn };
  };
}

module.exports = { createStudentSuspensionService, validPeriods, startBreak, endBreak };
