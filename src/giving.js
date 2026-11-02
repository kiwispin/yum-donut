// Giving donuts costs the giver: gifts come out of the wallet first, and any
// part the wallet can't cover comes out of the bank. The daily limit still caps
// how many a student can give each day. The teacher's gifts stay free.

// Balances after paying for a gift, or null when wallet and bank together can't cover it.
export const payForGift = ({ wallet, bank }, cost) => {
    if (wallet + bank < cost) return null;
    const fromWallet = Math.min(wallet, cost);
    return { wallet: wallet - fromWallet, bank: bank - (cost - fromWallet) };
};
