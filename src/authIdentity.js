const AUTH_DOMAIN = '@yumdonut.school';

const normalizedName = (name) => String(name || '').trim().normalize('NFKC');

const legacyAccountEmailForName = (name) => (
    `${normalizedName(name).replace(/\s+/g, '').toLowerCase()}${AUTH_DOMAIN}`
);

const accountIdentityKeyForName = (name) => {
    const value = normalizedName(name);
    let hash = 2166136261;

    for (const character of value) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619) >>> 0;
    }

    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'user';

    return `${slug}-${hash.toString(36)}`;
};

const accountEmailForName = (name) => (
    `${accountIdentityKeyForName(name)}${AUTH_DOMAIN}`
);

const accountEmailCandidatesForName = (name) => (
    [...new Set([accountEmailForName(name), legacyAccountEmailForName(name)])]
);

export {
    accountEmailCandidatesForName,
    accountEmailForName,
    accountIdentityKeyForName,
    legacyAccountEmailForName,
};
