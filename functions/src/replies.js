function formatNames(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function successReply(result) {
  const recipientText = formatNames(result.recipients);
  const donutWord = result.amountEach === 1 ? 'donut' : 'donuts';
  if (result.recipients.length === 1) {
    return `🍩 Sent ${result.amountEach} ${donutWord} to ${recipientText}. Nice recognition!`;
  }
  return `🍩 Sent ${result.amountEach} ${donutWord} each to ${recipientText}. Nice recognition!`;
}

function failureReply(code, details = {}) {
  switch (code) {
    case 'BOT_NOT_MENTIONED':
      return null;
    case 'NO_RECIPIENTS':
      return 'Mention at least one student to give a donut.';
    case 'NO_DONUTS':
      return 'Add at least one 🍩 emoji to give donuts.';
    case 'SENDER_UNMAPPED':
      return 'I do not know which Yum Donut user you are yet. Ask Mr Rayner to map your Teams account.';
    case 'RECIPIENT_UNMAPPED':
      return `I could not match ${details.displayName || 'one of those people'} to the Yum Donut roster.`;
    case 'RECIPIENT_NOT_ACTIVE':
      return `${details.yumName || 'That person'} is not currently active in the Yum Donut roster.`;
    case 'SELF_GIVE':
      return 'Nice try, but you cannot give donuts to yourself.';
    case 'DAILY_LIMIT':
      return `You have ${details.remaining} donut${details.remaining === 1 ? '' : 's'} left today, but this would send ${details.requested}.`;
    case 'DUPLICATE':
      return 'That donut was already counted.';
    default:
      return 'Yum Donut could not process that message.';
  }
}

module.exports = {
  successReply,
  failureReply,
};
