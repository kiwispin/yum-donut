'use strict';

const { teamsIntegrationDoc } = require('./firestorePaths');

// The saved reference sits in publicly writable data, so it is checked on every use:
// the bot's token is only ever sent to a Microsoft Teams service in the school's tenant.
const TEAMS_SERVICE_HOSTS = new Set(['smba.trafficmanager.net', 'smba.infra.gcc.teams.microsoft.com']);
const PAGE_SIZE = 200;

function trustedServiceUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && TEAMS_SERVICE_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function teamReferenceFromActivity(activity) {
  const teamId = activity?.channelData?.team?.id;
  const tenantId = activity?.channelData?.tenant?.id || activity?.conversation?.tenantId;
  if (activity?.channelId !== 'msteams' || typeof teamId !== 'string' || !teamId
    || typeof tenantId !== 'string' || !tenantId || !trustedServiceUrl(activity.serviceUrl)) return null;
  return {
    serviceUrl: activity.serviceUrl,
    teamId,
    tenantId,
    teamName: activity.channelData.team.name || null,
    conversationId: activity.conversation?.id || teamId,
  };
}

async function rememberTeam({ db, FieldValue, activity }) {
  const reference = teamReferenceFromActivity(activity);
  if (!reference) return false;
  await teamsIntegrationDoc(db).set({
    teamReference: { ...reference, updatedAt: FieldValue.serverTimestamp() },
  }, { merge: true });
  return true;
}

function createTeamsRoster({ db, createAdapter, appId, tenantId, teamsInfo }) {
  async function reference() {
    const snap = await teamsIntegrationDoc(db).get();
    const saved = snap.exists ? snap.data().teamReference : null;
    if (!saved) return null;
    if (!trustedServiceUrl(saved.serviceUrl) || saved.tenantId !== tenantId() || typeof saved.teamId !== 'string' || !saved.teamId) {
      throw new Error('The saved Teams team details are not trusted.');
    }
    return saved;
  }

  async function withTeam(saved, logic) {
    let result;
    const conversation = {
      channelId: 'msteams',
      serviceUrl: saved.serviceUrl,
      conversation: { id: saved.conversationId || saved.teamId, tenantId: saved.tenantId, isGroup: true, conversationType: 'channel' },
    };
    let failure = null;
    // Errors are caught here, not by the adapter's onTurnError, which would post an apology in the team channel.
    await createAdapter().continueConversationAsync(appId(), conversation, async (context) => {
      try {
        result = await logic(context);
      } catch (error) {
        failure = error;
      }
    });
    if (failure) throw failure;
    return result;
  }

  return {
    reference,
    async members(saved) {
      return withTeam(saved, async (context) => {
        const members = [];
        let continuationToken;
        do {
          const page = await teamsInfo().getPagedTeamMembers(context, saved.teamId, PAGE_SIZE, continuationToken);
          members.push(...(page.members || []));
          continuationToken = page.continuationToken;
        } while (continuationToken);
        return members;
      });
    },
    async member(saved, userId) {
      return withTeam(saved, async (context) => {
        try {
          return await teamsInfo().getTeamMember(context, saved.teamId, userId);
        } catch (error) {
          if (error?.statusCode === 404 || error?.code === 'MemberNotFoundInConversation') return null;
          throw error;
        }
      });
    },
  };
}

module.exports = { createTeamsRoster, rememberTeam, teamReferenceFromActivity, trustedServiceUrl };
