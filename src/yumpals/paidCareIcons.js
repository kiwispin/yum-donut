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
