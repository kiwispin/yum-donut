// Name effects a student buys in the Shop (neon, rainbow) or earns in typing
// training (flame), read from their public profile. One shows at a time, and
// bought effects beat earned ones, so a student who buys a new look sees it.
const NAME_EFFECT_CLASSES = {
    neon: 'neon-text',
    rainbow: 'rainbow-text',
    flame: 'flame-text',
};

export const nameEffect = (user) => {
    if (user?.neon_name) return 'neon';
    if (user?.rainbow_name) return 'rainbow';
    if (user?.flame_name) return 'flame';
    return null;
};

export const nameEffectClass = (user, plainClass = '') => NAME_EFFECT_CLASSES[nameEffect(user)] ?? plainClass;

// Gold (bought, or 70 WPM) beats silver (50 WPM).
export const avatarBorderClass = (user) => {
    if (user?.gold_border) return 'gold-border';
    if (user?.silver_border) return 'silver-border';
    return '';
};

// A Leaderboard row takes on the look of the student's name effect, or a gold
// wash for a gold border when they have no name effect.
export const rowThemeClass = (user) => {
    const effect = nameEffect(user);
    if (effect) return `row-${effect}`;
    return user?.gold_border ? 'row-gold' : '';
};

// Shop items that change how a student looks, previewed on the Shop card.
const PREVIEW_ITEM_IDS = ['neon_name', 'rainbow_name', 'gold_border', 'verified_badge'];

// The student's own look with this item added, or null for items with no preview.
export const shopPreview = (itemId) => (PREVIEW_ITEM_IDS.includes(itemId) ? { [itemId]: true } : null);
