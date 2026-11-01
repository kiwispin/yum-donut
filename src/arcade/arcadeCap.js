// One daily allowance shared by every Arcade game. Wins past it still count for
// the cooldown and the fun, but pay nothing. The count lives on the private
// profile beside the per-game cooldowns and resets on the next Auckland date.
export const ARCADE_DAILY_CAP = 3;

// A full donut jar: while a student holds this many (wallet plus bank) the Arcade
// pays nothing. Nothing they hold is taken, and spending below it turns prizes back
// on. Gifts, bounties and Training are never limited by it.
export const ARCADE_HOLDING_CAP = 150;

export const arcadeEarnedOn = (profile, dateKey) => {
    const earned = profile?.arcade_earned_today;
    if (profile?.arcade_earned_date !== dateKey || !Number.isSafeInteger(earned) || earned < 0) return 0;
    return earned;
};

const donuts = value => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

export const donutsHeld = (profile) => donuts(profile?.balance) + donuts(profile?.bank_balance);

export const isJarFull = (held) => held >= ARCADE_HOLDING_CAP;

export const capArcadePrize = (prize, earned, held = 0, cap = ARCADE_DAILY_CAP) => (
    isJarFull(held) ? 0 : Math.max(0, Math.min(prize, cap - earned))
);
