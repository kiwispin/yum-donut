const { APP_ID } = require('./config');

function dataRoot(db) {
  return db.collection('artifacts').doc(APP_ID).collection('public').doc('data');
}

function usersCollection(db) {
  return dataRoot(db).collection('users');
}

function transactionsCollection(db) {
  return dataRoot(db).collection('transactions');
}

function rosterDoc(db) {
  return dataRoot(db).collection('config').doc('roster');
}

function teamsIntegrationDoc(db) {
  return dataRoot(db).collection('integrations').doc('teams');
}

function teamsMappingsCollection(db) {
  return teamsIntegrationDoc(db).collection('mappings');
}

function teamsDailyCollection(db) {
  return teamsIntegrationDoc(db).collection('daily');
}

function teamsProcessedCollection(db) {
  return teamsIntegrationDoc(db).collection('processedActivities');
}

function privateProfileDoc(db, uid) {
  return db.collection('artifacts').doc(APP_ID)
    .collection('users').doc(uid)
    .collection('profile').doc('data');
}

module.exports = {
  usersCollection,
  transactionsCollection,
  rosterDoc,
  teamsMappingsCollection,
  teamsDailyCollection,
  teamsProcessedCollection,
  privateProfileDoc,
};
