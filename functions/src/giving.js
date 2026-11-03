// Server copies of the web app's giving rules (src/giving.js and src/bankBalance.js),
// so a gift from Teams costs the giver exactly what the same gift costs in the app.
// Gifts come out of the wallet first, and any part the wallet can't cover comes out
// of the bank. The teacher's gifts stay free.

// Legacy profiles may never have opened a bank. Only an absent field is zero;
// explicitly invalid values must still be held for repair.
function getBankBalance(value) {
  if (value === undefined) return 0;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function resolveBankBalance(privateValue, publicValue) {
  const privateBalance = getBankBalance(privateValue);
  const publicBalance = getBankBalance(publicValue);
  if (privateBalance === null || publicBalance === null) return null;
  if (privateValue === undefined) return publicBalance;
  if (publicValue === undefined) return privateBalance;
  return privateBalance === publicBalance ? privateBalance : null;
}

// Balances after paying for a gift, or null when wallet and bank together can't cover it.
function payForGift({ wallet, bank }, cost) {
  if (wallet + bank < cost) return null;
  const fromWallet = Math.min(wallet, cost);
  return { wallet: wallet - fromWallet, bank: bank - (cost - fromWallet) };
}

module.exports = {
  getBankBalance,
  resolveBankBalance,
  payForGift,
};
