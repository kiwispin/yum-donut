// Donut trophies: students turn donuts into permanent pieces for a trophy
// cabinet shown beside their name. Paid from the wallet or the bank, by the
// student's choice; trophies are never sold back. Counts live on the public
// profile as trophies: { medal, trophy, diamond, crown }.
export const TROPHIES = [
    { id: 'medal', name: 'Medal', icon: '🏅', cost: 25 },
    { id: 'trophy', name: 'Trophy', icon: '🏆', cost: 75 },
    { id: 'diamond', name: 'Diamond Donut', icon: '💎', cost: 200 },
    { id: 'crown', name: 'Crown', icon: '👑', cost: 500 },
];

export const trophyCounts = (value) => Object.fromEntries(TROPHIES.map(({ id }) => {
    const count = value?.[id];
    return [id, Number.isSafeInteger(count) && count > 0 ? count : 0];
}));

export const cabinetValue = (value) => {
    const counts = trophyCounts(value);
    return TROPHIES.reduce((sum, { id, cost }) => sum + counts[id] * cost, 0);
};

// Balances after paying from 'wallet' or 'bank', or null when that source can't cover it.
export const payForTrophy = ({ wallet, bank }, source, cost) => {
    if (source === 'wallet' && wallet >= cost) return { wallet: wallet - cost, bank };
    if (source === 'bank' && bank >= cost) return { wallet, bank: bank - cost };
    return null;
};
