const { DONUT_EMOJI } = require('./config');

const DONUT_LITERAL_PATTERN = /\u{1F369}\uFE0F?/gu;
const DONUT_SHORTCODE_PATTERN = /:(?:donut|doughnut):/giu;
const DONUT_LABEL_PATTERN = '(?:\\u{1F369}\\uFE0F?|:(?:donut|doughnut):|donut|doughnut)';
const DONUT_ALT_TAG_PATTERN = new RegExp(
  `<(?:img|emoji)\\b[^>]*(?:alt|title|aria-label)=["']\\s*${DONUT_LABEL_PATTERN}\\s*["'][^>]*(?:>.*?<\\/emoji>|\\/?>)`,
  'giu'
);

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(text) {
  return decodeHtmlEntities(text)
    .replace(/<at>.*?<\/at>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeamsDonutEmoji(text) {
  return decodeHtmlEntities(text)
    .replace(DONUT_ALT_TAG_PATTERN, DONUT_EMOJI)
    .replace(DONUT_SHORTCODE_PATTERN, DONUT_EMOJI);
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
  const text = normalizeTeamsDonutEmoji(activity?.text || '');
  const mentions = (activity?.entities || []).filter((entity) => entity.type === 'mention');
  const botWasMentioned = mentions.some((mention) => isBotMention(mention, activity));
  const recipientTeamsUsers = mentions
    .filter((mention) => !isBotMention(mention, activity))
    .map((mention) => mention.mentioned)
    .filter(Boolean);

  const donutCount = [...text.matchAll(DONUT_LITERAL_PATTERN)].length;
  const message = stripHtml(text.replace(DONUT_LITERAL_PATTERN, ''));

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
  normalizeTeamsDonutEmoji,
  stripHtml,
};
