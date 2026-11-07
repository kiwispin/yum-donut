const { parseTeamsDonutActivity } = require('./teamsParser');
const { giveDonutsFromTeams } = require('./donutService');
const { successReply, failureReply } = require('./replies');
const { recordPendingTeamsUsers } = require('./pendingMappings');
const { rememberTeam } = require('./teamsRoster');

function redactMentionText(text) {
  return String(text || '').replace(/<at>.*?<\/at>/gi, '<at>@</at>');
}

function diagnosticCodePoints(text) {
  return Array.from(String(text || '').slice(0, 200)).map((char) => char.codePointAt(0).toString(16));
}

const PICTOGRAPH = /\p{Extended_Pictographic}/u;
const PLAIN_TAGS = new Set(['p', 'div', 'br', 'span', 'b', 'i', 'strong', 'em', 'u', 's', 'at']);
const SHOWN_ATTRIBUTES = new Set(['itemtype', 'itemid', 'alt', 'title', 'class', 'id', 'aria-label', 'type', 'data-tid', 'data-emoji-id']);

function attributeValue(name, value) {
  if (name !== 'src') return SHOWN_ATTRIBUTES.has(name) || name.startsWith('data-emoji') ? value.slice(0, 120) : '…';
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname}`.slice(0, 160);
  } catch {
    return '…';
  }
}

// When no donut is found: the shape of the tags in the formatted copy of the message (tag and
// attribute names, emoji-related values) and any emoji characters in it. Mentions and the words
// of the message are never logged.
function htmlEmojiDiagnostics(attachments = []) {
  return attachments
    .filter((attachment) => String(attachment.contentType || '').toLowerCase() === 'text/html')
    .slice(0, 3)
    .map((attachment) => {
      const html = typeof attachment.content === 'string' ? attachment.content : JSON.stringify(attachment.content || '');
      const tags = [...html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)]
        .filter(([, name, attributes]) => !/mention/i.test(attributes) && (attributes.trim() || !PLAIN_TAGS.has(name.toLowerCase())))
        .slice(0, 20)
        .map(([, name, attributes]) => ({
          tag: name.toLowerCase(),
          attributes: Object.fromEntries([...attributes.matchAll(/([a-z][\w:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gi)]
            .map(([, attribute, double, single, bare]) => [attribute.toLowerCase(), attributeValue(attribute.toLowerCase(), double ?? single ?? bare ?? '')])),
        }));
      const emojiCodePoints = Array.from(html).filter((char) => PICTOGRAPH.test(char)).slice(0, 20)
        .map((char) => char.codePointAt(0).toString(16));
      return { length: html.length, tags, emojiCodePoints };
    });
}

async function handleTeamsTurn(context, deps) {
  const activity = context.activity;
  // Lets the teacher's Teams screen read who is in the team. Never blocks a gift.
  try {
    await rememberTeam({ db: deps.db, FieldValue: deps.FieldValue, activity });
  } catch (error) {
    console.warn('Could not remember the Teams team:', error?.message);
  }
  if (activity.type !== 'message') return;

  const parsed = parseTeamsDonutActivity(activity);
  if (parsed.errors.includes('BOT_NOT_MENTIONED')) return;

  const firstParseError = parsed.errors.find((error) => error !== 'BOT_NOT_MENTIONED');
  if (firstParseError) {
    console.warn('Teams donut parse miss:', {
      error: firstParseError,
      text: redactMentionText(activity.text).slice(0, 500),
      textCodePoints: diagnosticCodePoints(activity.text),
      attachmentContentTypes: (activity.attachments || []).map((attachment) => attachment.contentType),
      entityTypes: (activity.entities || []).map((entity) => entity.type),
      html: htmlEmojiDiagnostics(activity.attachments || []),
    });
    await recordPendingTeamsUsers({
      db: deps.db,
      FieldValue: deps.FieldValue,
      teamsUsers: [activity.from, ...parsed.recipientTeamsUsers],
      source: 'parse_error',
    });
    await context.sendActivity(failureReply(firstParseError));
    return;
  }

  await recordPendingTeamsUsers({
    db: deps.db,
    FieldValue: deps.FieldValue,
    teamsUsers: [activity.from, ...parsed.recipientTeamsUsers],
    source: 'donut_message',
  });

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
