const { DONUT_EMOJI } = require('./config');

function stripHtml(text) {
  return String(text || '')
    .replace(/<at>.*?<\/at>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBotMention(mention, activity) {
  const mentioned = mention?.mentioned || {};
  const recipient = activity?.recipient || {};
  return Boolean(
    mentioned.id && recipient.id && mentioned.id === recipient.id
  ) || Boolean(
    mentioned.name && recipient.name && mentioned.name === recipient.name
  );
}

function parseTeamsDonutActivity(activity) {
  const text = activity?.text || '';
  const mentions = (activity?.entities || []).filter((entity) => entity.type === 'mention');
  const botWasMentioned = mentions.some((mention) => isBotMention(mention, activity));
  const recipientTeamsUsers = mentions
    .filter((mention) => !isBotMention(mention, activity))
    .map((mention) => mention.mentioned)
    .filter(Boolean);

  const donutCount = [...text.matchAll(new RegExp(DONUT_EMOJI, 'gu'))].length;
  const message = stripHtml(text.replace(new RegExp(DONUT_EMOJI, 'gu'), ''));

  const errors = [];
  if (!botWasMentioned) errors.push('BOT_NOT_MENTIONED');
  if (recipientTeamsUsers.length === 0) errors.push('NO_RECIPIENTS');
  if (donutCount === 0) errors.push('NO_DONUTS');

  return {
    botWasMentioned,
    recipientTeamsUsers,
    donutCount,
    message,
    errors,
  };
}

module.exports = {
  parseTeamsDonutActivity,
  stripHtml,
};
