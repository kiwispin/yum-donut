const { APP_ID } = require('../config');

function yumPalsRoot(db) {
  return db.collection('artifacts').doc(APP_ID).collection('yumpals').doc('main');
}

function yumPalsSettingsDoc(db) {
  return yumPalsRoot(db).collection('config').doc('settings');
}

function yumPalsSettingsAuditDoc(db, eventId) {
  return yumPalsRoot(db).collection('config').doc('settings').collection('audit').doc(eventId);
}

function yumPalsUserDoc(db, uid) {
  return yumPalsRoot(db).collection('users').doc(uid);
}

function yumPalsDayDoc(db, uid, dateKey) {
  return yumPalsUserDoc(db, uid).collection('days').doc(dateKey);
}

function yumPalsAuditDoc(db, uid, eventId) {
  return yumPalsUserDoc(db, uid).collection('audit').doc(eventId);
}

module.exports = {
  yumPalsAuditDoc,
  yumPalsDayDoc,
  yumPalsRoot,
  yumPalsSettingsAuditDoc,
  yumPalsSettingsDoc,
  yumPalsUserDoc,
};
