export const PAID_CARE_ICON_ORDER = Object.freeze([
    'food',
    'lights',
    'game',
    'medicine',
    'clean',
    'status',
    'discipline',
    'attention',
]);

export const PAID_CARE_ICON_LABELS = Object.freeze({
    food: 'Food',
    lights: 'Lights',
    game: 'Game',
    medicine: 'Medicine',
    clean: 'Clean',
    status: 'Health and status',
    discipline: 'Gentle discipline',
    attention: 'Attention',
});

export const PAID_CARE_ICON_MENU_IDS = Object.freeze({
    food: 'food',
    lights: 'lights',
    game: 'play',
    medicine: 'medicine',
    clean: 'clean',
    discipline: 'reminder',
});

export const PAID_CARE_ICON_HELP = Object.freeze({
    food: 'Give a meal or snack to fill hunger hearts.',
    lights: 'Set bedtime lights for the fake night; lights return at 7 am.',
    game: 'Play three direction guesses or give a pat for happiness hearts.',
    medicine: 'Give medicine to restore health hearts.',
    clean: 'Clean up to restore cleanliness hearts.',
    status: 'Check four heart meters and recent receipts. No charge.',
    discipline: 'Give a gentle reminder to clear the attention flag.',
    attention: 'Check whether your pal needs attention. No charge.',
});

export function paidCareHelpIcon(selected, hovered, focused) {
    return PAID_CARE_ICON_ORDER[hovered ?? focused ?? selected] || null;
}

export const PAID_CARE_ICON_PIXELS = Object.freeze({
    food: ['a..a..a.', 'a..a..a.', 'a..a..a.', 'aaa...a.', '..a..a..', '..a..a..', '..a..a..', '..a..a..'],
    lights: ['...aa...', '..aaaa..', '.aaaaaa.', '.aaaaaa.', '..aaaa..', '...aa...', '...aa...', '..aaaa..'],
    game: ['..aaaa..', '.aaaa...', 'aaaa....', '...aa...', '....a...', '.....a..', '......a.', '.......a'],
    medicine: ['.....a..', '....aa..', '...aaaa.', '....aa..', '....aa..', '....aa..', '..aaaa..', '..a..a..'],
    clean: ['........', '..aa....', '.aaaaa..', 'aaaaaaa.', '.aaaaaa.', '..aaaa..', '...a.a..', '..aaaa..'],
    status: ['aaaaaaaa', 'a......a', 'a.aa...a', 'a.a.a..a', 'a...aa.a', 'a......a', 'aaaaaaaa', '........'],
    discipline: ['..aaaa..', '.a....a.', 'a.a..a.a', 'a......a', 'a..aa..a', '.a....a.', '..aaaa..', '........'],
    attention: ['..aa....', '.a..a...', '.aaaa...', '........', '....aa..', '...a..a.', '...aaaa.', '........'],
});

export function paidCareIconPixelsAreRectangular() {
    return PAID_CARE_ICON_ORDER.every((id) => {
        const pixels = PAID_CARE_ICON_PIXELS[id];
        return pixels.length === 8 && pixels.every((row) => [...row].length === 8);
    });
}
