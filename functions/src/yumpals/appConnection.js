// Additive YumPals endpoints only. Separate deployment readiness defaults off.
const { createAppWalletAdapter } = require('./appWalletAdapter');
const { createPaidCareCallables } = require('./paidCareCallables');
const { createSavedGameCallables } = require('./savedGameCallables');
const { yumPalsRoot, yumPalsUserDoc } = require('./paths');
const { paidSettingsRefs } = require('./paidSettingsPaths');
const { APP_ID } = require('../config');
function createAppConnection({ db, authAdmin, HttpsError, ready, now, pocketReady }) {
  const refs = { config: paidSettingsRefs(db).settings, pet: uid => yumPalsUserDoc(db, uid),
    holidayGlobal: () => db.doc(`artifacts/${APP_ID}/public/data/config/global`),
    holidayHistory: () => yumPalsRoot(db).collection('config').doc('holidayClock'),
    receipt: (uid, id) => yumPalsUserDoc(db, uid).collection('purchases').doc(id),
    refusal: (uid, id) => yumPalsUserDoc(db, uid).collection('refusals').doc(id),
    migration: uid => yumPalsRoot(db).collection('migrations').doc(uid),
    game: (uid, id) => yumPalsUserDoc(db, uid).collection('games').doc(id),
    gameTurn: (uid, id) => yumPalsUserDoc(db, uid).collection('gameTurns').doc(id),
    // Giving cheer: the private profile the app and Teams bot write, and a per-day audit record.
    giving: uid => db.collection('artifacts').doc(APP_ID).collection('users').doc(uid).collection('profile').doc('data'),
    cheer: (uid, date) => yumPalsUserDoc(db, uid).collection('cheers').doc(date),
    // Daily visit gift / welcome back: one record per day.
    visit: (uid, date) => yumPalsUserDoc(db, uid).collection('visits').doc(date),
    // Donut pal: one record per action (idempotent retries), and the move of each existing pal.
    pocketAct: (uid, id) => yumPalsUserDoc(db, uid).collection('pocketActs').doc(id),
    pocketMove: uid => yumPalsRoot(db).collection('migrations').doc(`${uid}_pocket`) };
  const walletAdapter = createAppWalletAdapter({ authAdmin,
    publicProfiles: () => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('users'),
    privateProfile: uid => db.collection('artifacts').doc(APP_ID).collection('users').doc(uid).collection('profile').doc('data') });
  return { paid: createPaidCareCallables({ db, refs, walletAdapter, HttpsError, ready, now, elapsedCare: true, pocketReady }),
    game: createSavedGameCallables({ db, refs, HttpsError, ready, now }) };
}
module.exports = { createAppConnection };
