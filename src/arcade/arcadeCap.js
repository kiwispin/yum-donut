// One daily allowance shared by every Arcade game. Wins past it still count for
// the cooldown and the fun, but pay nothing. The count lives on the private
// profile beside the per-game cooldowns and resets on the next Auckland date.
export const ARCADE_DAILY_CAP = 3;

export const arcadeEarnedOn = (profile, dateKey) => {
    const earned = profile?.arcade_earned_today;
    if (profile?.arcade_earned_date !== dateKey || !Number.isSafeInteger(earned) || earned < 0) return 0;
    return earned;
};

export const capArcadePrize = (prize, earned, cap = ARCADE_DAILY_CAP) => (
    Math.max(0, Math.min(prize, cap - earned))
);
