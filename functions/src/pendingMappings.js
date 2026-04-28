const { teamsIntegrationDoc } = require('./firestorePaths');
const { mappingKeyForTeamsUser, stableTeamsId, displayNameForTeamsUser } = require('./identity');

function pendingMappingsCollection(db) {
  return teamsIntegrationDoc(db).collection('pendingMappings');
}

async function recordPendingTeamsUsers({ db, FieldValue, teamsUsers = [], source = 'message' }) {
  const batch = db.batch();
  let count = 0;

  for (const teamsUser of teamsUsers) {
    const key = mappingKeyForTeamsUser(teamsUser);
    if (!key) continue;

    batch.set(pendingMappingsCollection(db).doc(key), {
      mappingKey: key,
      teamsUserId: stableTeamsId(teamsUser),
      displayName: displayNameForTeamsUser(teamsUser),
      aadObjectId: teamsUser.aadObjectId || null,
      userPrincipalName: teamsUser.userPrincipalName || null,
      source,
      lastSeenAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    count += 1;
  }

  if (count > 0) {
    await batch.commit();
  }
}

module.exports = {
  recordPendingTeamsUsers,
};
