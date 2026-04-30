const { DONUT_EMOJI } = require('./config');

const DONUT_LITERAL_PATTERN = /\u{1F369}\uFE0F?/gu;
const DONUT_SHORTCODE_PATTERN = /:(?:donut|doughnut):/giu;
const DONUT_LABEL_PATTERN = '(?:\\u{1F369}\\uFE0F?|1f369|u1f369|:(?:donut|doughnut):|donut|doughnut)';
const DONUT_ALT_TAG_PATTERN = new RegExp(
  `<[^>]*(?:alt|title|aria-label|itemid|data-tid|data-emoji-id)=["']\\s*${DONUT_LABEL_PATTERN}\\s*["'][^>]*(?:>\\s*<\\/[^>]+>|\\/?>|>)`,
  'giu'
);
const DONUT_EMOJI_TAG_PATTERN = new RegExp(
  `<[^>]*(?:emoji|emoticon)[^>]*(?:donut|doughnut|1f369)[^>]*(?:>\\s*<\\/[^>]+>|\\/?>|>)`,
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

function formatMentionForMessage(mention, activity, preserveRecipientMention = false) {
  if (isBotMention(mention, activity) || !preserveRecipientMention) return ' ';
  return ` ${mention?.mentioned?.name || mention?.mentioned?.givenName || mention?.mentioned?.userPrincipalName || ''} `;
}

function replaceMentionTagsForMessage(text, mentions, activity) {
  let mentionIndex = 0;
  let lastMentionEnd = 0;
  let hasMessageTextBeforeMention = false;
  return String(text || '').replace(/<at>.*?<\/at>/gi, (tag, offset) => {
    const textSinceLastMention = String(text || '').slice(lastMentionEnd, offset);
    if (textSinceLastMention.trim()) hasMessageTextBeforeMention = true;
    const replacement = formatMentionForMessage(mentions[mentionIndex], activity, hasMessageTextBeforeMention);
    mentionIndex += 1;
    lastMentionEnd = offset + tag.length;
    return replacement;
  });
}

function normalizeTeamsDonutEmoji(text) {
  return decodeHtmlEntities(text)
    .replace(DONUT_SHORTCODE_PATTERN, DONUT_EMOJI)
    .replace(DONUT_ALT_TAG_PATTERN, DONUT_EMOJI)
    .replace(DONUT_EMOJI_TAG_PATTERN, DONUT_EMOJI);
}

function attachmentSearchText(attachments = []) {
  return attachments.map((attachment) => {
    const content = typeof attachment.content === 'string'
      ? attachment.content
      : JSON.stringify(attachment.content || '');
    return [
      attachment.name,
      attachment.contentType,
      attachment.contentUrl,
      attachment.thumbnailUrl,
      content,
    ].filter(Boolean).join(' ');
  }).join(' ');
}

function teamsEmojiImageFallbackCount(attachments = []) {
  const contentTypes = attachments.map((attachment) => String(attachment.contentType || '').toLowerCase());
  const hasHtmlAttachment = contentTypes.includes('text/html');
  if (!hasHtmlAttachment) return 0;

  return contentTypes.filter((contentType) => contentType === 'image/*').length;
}

function countDonutLiterals(text) {
  return [...String(text || '').matchAll(DONUT_LITERAL_PATTERN)].length;
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
  const attachmentText = normalizeTeamsDonutEmoji(attachmentSearchText(activity?.attachments || []));
  const mentions = (activity?.entities || []).filter((entity) => entity.type === 'mention');
  const botWasMentioned = mentions.some((mention) => isBotMention(mention, activity));
  const recipientTeamsUsers = mentions
    .filter((mention) => !isBotMention(mention, activity))
    .map((mention) => mention.mentioned)
    .filter(Boolean);

  const textDonutCount = countDonutLiterals(text);
  const attachmentImageDonutCount = teamsEmojiImageFallbackCount(activity?.attachments || []);
  const attachmentMetadataDonutCount = countDonutLiterals(attachmentText);
  const donutCount = textDonutCount || attachmentImageDonutCount || attachmentMetadataDonutCount;
  const messageText = replaceMentionTagsForMessage(text, mentions, activity);
  const message = stripHtml(messageText.replace(DONUT_LITERAL_PATTERN, ''));

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
  attachmentSearchText,
  countDonutLiterals,
  parseTeamsDonutActivity,
  normalizeTeamsDonutEmoji,
  replaceMentionTagsForMessage,
  stripHtml,
  teamsEmojiImageFallbackCount,
};
