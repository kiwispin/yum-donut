const { yumPalsRoot, yumPalsSettingsDoc } = require('./paths');
function paidSettingsRefs(db) {
  const settings = () => yumPalsRoot(db).collection('config').doc('paidSettings');
  return { settings, legacySettings: () => yumPalsSettingsDoc(db),
    receipt: (uid, id) => settings().collection('teachers').doc(uid).collection('operations').doc(id) };
}
module.exports = { paidSettingsRefs };
