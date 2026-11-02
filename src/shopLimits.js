// Shop limits beyond the per-person daily limit: a stock shared by everyone each
// Auckland day, and a per-person limit each Auckland week (Monday to Sunday).
// A limit of null means none; 0 means nobody can buy it, which switches an item off.

// "2026-11-04" (an Auckland date key) → the Monday that starts its week.
export const getWeekKey = (dateKey) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
};

// Food and drink are sold only during the school day, Monday to Friday, Auckland time.
export const FOOD_OPEN_HOUR = 7;
export const FOOD_CLOSE_HOUR = 17;

export const aucklandHour = (date = new Date()) => Number(new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland', hour: 'numeric', hourCycle: 'h23'
}).format(date));

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 0 = Sunday … 6 = Saturday.
export const aucklandWeekday = (date = new Date()) => WEEKDAYS.indexOf(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Auckland', weekday: 'short'
}).format(date));

export const isFoodOpen = (hour, weekday) => weekday >= 1 && weekday <= 5
    && hour >= FOOD_OPEN_HOUR && hour < FOOD_CLOSE_HOUR;

export const isFoodOpenAt = (date = new Date()) => isFoodOpen(aucklandHour(date), aucklandWeekday(date));

const hasLimit = (limit) => Number.isFinite(limit) && limit >= 0;

export const stockLeft = (dailyStock, soldToday) => (
    hasLimit(dailyStock) ? Math.max(0, dailyStock - soldToday) : null
);

// Why an item can't be bought right now, or null when it can.
export const shopLimitBlock = ({ dailyLimit, purchasedToday = 0, weeklyLimit, purchasedThisWeek = 0, dailyStock, soldToday = 0 }) => {
    if (dailyStock === 0) return 'off';
    if (hasLimit(dailyStock) && soldToday >= dailyStock) return 'sold_out';
    if (hasLimit(weeklyLimit) && purchasedThisWeek >= weeklyLimit) return 'weekly';
    if (hasLimit(dailyLimit) && purchasedToday >= dailyLimit) return 'daily';
    return null;
};
