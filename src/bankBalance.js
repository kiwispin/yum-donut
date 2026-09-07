// Legacy profiles may never have opened a bank. Only an absent field is zero;
// explicitly invalid values must still be held for repair.
export const getBankBalance = (value) => {
    if (value === undefined) return 0;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
};

export const resolveBankBalance = (privateValue, publicValue) => {
    const privateBalance = getBankBalance(privateValue);
    const publicBalance = getBankBalance(publicValue);
    if (privateBalance === null || publicBalance === null) return null;
    if (privateValue === undefined) return publicBalance;
    if (publicValue === undefined) return privateBalance;
    return privateBalance === publicBalance ? privateBalance : null;
};
