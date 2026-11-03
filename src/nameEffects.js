// Name effects a student buys in the Shop (neon, rainbow) or earns in typing
// training (flame), read from their public profile. One shows at a time, and
// bought effects beat earned ones, so a student who buys a new look sees it.
const NAME_EFFECT_CLASSES = {
    neon: 'neon-text',
    rainbow: 'animate-text-rainbow bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500',
    flame: 'flame-text',
};

export const nameEffect = (user) => {
    if (user?.neon_name) return 'neon';
    if (user?.rainbow_name) return 'rainbow';
    if (user?.flame_name) return 'flame';
    return null;
};

export const nameEffectClass = (user, plainClass = '') => NAME_EFFECT_CLASSES[nameEffect(user)] ?? plainClass;
