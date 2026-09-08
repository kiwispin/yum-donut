// Additive YumPals endpoints only. Separate deployment readiness defaults off.
const { createAppWalletAdapter } = require('./appWalletAdapter');
const { createPaidCareCallables } = require('./paidCareCallables');
const { createSavedGameCallables } = require('./savedGameCallables');
const { yumPalsRoot, yumPalsUserDoc } = require('./paths');
const { paidSettingsRefs } = require('./paidSettingsPaths');
const { APP_ID } = require('../config');
function createAppConnection({ db, authAdmin, HttpsError, ready, now }) {
  const refs = { config: paidSettingsRefs(db).settings, pet: uid => yumPalsUserDoc(db, uid),
    receipt: (uid, id) => yumPalsUserDoc(db, uid).collection('purchases').doc(id),
    refusal: (uid, id) => yumPalsUserDoc(db, uid).collection('refusals').doc(id),
    migration: uid => yumPalsRoot(db).collection('migrations').doc(uid),
    game: (uid, id) => yumPalsUserDoc(db, uid).collection('games').doc(id),
    gameTurn: (uid, id) => yumPalsUserDoc(db, uid).collection('gameTurns').doc(id) };
  const walletAdapter = createAppWalletAdapter({ authAdmin,
    publicProfiles: () => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('users'),
    privateProfile: uid => db.collection('artifacts').doc(APP_ID).collection('users').doc(uid).collection('profile').doc('data') });
  return { paid: createPaidCareCallables({ db, refs, walletAdapter, HttpsError, ready, now, elapsedCare: true }),
    game: createSavedGameCallables({ db, refs, HttpsError, ready, now }) };
}
module.exports = { createAppConnection };
