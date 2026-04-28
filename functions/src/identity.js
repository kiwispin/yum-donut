function stableTeamsId(teamsUser) {
  if (!teamsUser) return '';
  return teamsUser.aadObjectId || teamsUser.id || teamsUser.userPrincipalName || teamsUser.email || '';
}

function mappingKeyForTeamsUser(teamsUser) {
  const stableId = stableTeamsId(teamsUser);
  if (!stableId) return '';
  return Buffer.from(stableId, 'utf8').toString('base64url');
}

function displayNameForTeamsUser(teamsUser) {
  return teamsUser?.name || teamsUser?.givenName || teamsUser?.userPrincipalName || 'Unknown user';
}

module.exports = {
  stableTeamsId,
  mappingKeyForTeamsUser,
  displayNameForTeamsUser,
};
