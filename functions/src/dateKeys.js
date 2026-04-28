const { DEFAULT_TIME_ZONE } = require('./config');

function localDateKey(date = new Date(), timeZone = process.env.YUM_DONUT_TIME_ZONE || DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localDateLabel(date = new Date(), timeZone = process.env.YUM_DONUT_TIME_ZONE || DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.weekday} ${values.month} ${values.day} ${values.year}`;
}

module.exports = {
  localDateKey,
  localDateLabel,
};
