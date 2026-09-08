// Existing numeric wallets, not a currency conversion or rounding policy.
function walletNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function debitAfter(before, amount) {
  if (!walletNumber(before) || !Number.isSafeInteger(amount) || amount <= 0 || amount > before) return null;
  const after = before - amount;
  // Require bounded subtraction and exact conservation in both directions.
  // Never repair a floating-point discrepancy with epsilon or rounding.
  return walletNumber(after) && after < before && before - after === amount && after + amount === before ? after : null;
}

module.exports = { walletNumber, debitAfter };
