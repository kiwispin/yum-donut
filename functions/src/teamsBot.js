const { parseTeamsDonutActivity } = require('./teamsParser');
const { giveDonutsFromTeams } = require('./donutService');
const { successReply, failureReply } = require('./replies');

async function handleTeamsTurn(context, deps) {
  const activity = context.activity;
  if (activity.type !== 'message') return;

  const parsed = parseTeamsDonutActivity(activity);
  if (parsed.errors.includes('BOT_NOT_MENTIONED')) return;

  const firstParseError = parsed.errors.find((error) => error !== 'BOT_NOT_MENTIONED');
  if (firstParseError) {
    await context.sendActivity(failureReply(firstParseError));
    return;
  }

  const result = await giveDonutsFromTeams({
    db: deps.db,
    FieldValue: deps.FieldValue,
    activityId: activity.id,
    senderTeamsUser: activity.from,
    recipientTeamsUsers: parsed.recipientTeamsUsers,
    donutCount: parsed.donutCount,
    message: parsed.message,
  });

  await context.sendActivity(result.ok ? successReply(result) : failureReply(result.code, result));
}

module.exports = {
  handleTeamsTurn,
};
