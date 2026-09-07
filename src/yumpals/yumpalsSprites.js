const GRID_SIZE = 16;

const BODY_ROWS = [
    [1, 5, 10],
    [2, 4, 11],
    [3, 3, 12],
    [4, 2, 13],
    [5, 1, 14],
    [6, 1, 14],
    [7, 1, 14],
    [8, 1, 14],
    [9, 2, 13],
    [10, 3, 12],
    [11, 4, 11],
    [12, 5, 10],
];

const PALETTES = {
    mossbit: { a: '#214f45', b: '#77c56b', c: '#173a36', d: '#dff0aa' },
    pufflet: { a: '#28527a', b: '#8bd5ec', c: '#1f3651', d: '#e5f7ff' },
    emberoo: { a: '#63334e', b: '#f29b4b', c: '#422637', d: '#ffe0a5' },
};

function setPixels(grid, row, columns, value) {
    for (const column of columns) grid[row][column] = value;
}

function makeBlobFrame({ eyes = 'open', mouth = 'closed', pose = 'idleA' } = {}) {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('.'));
    for (const [row, start, end] of BODY_ROWS) {
        grid[row][start] = 'a';
        grid[row][end] = 'a';
        for (let column = start + 1; column < end; column += 1) grid[row][column] = 'b';
    }

    const feet = pose === 'idleB'
        ? { top: [5, 6, 11, 12], bottom: [4, 5, 6, 11, 12, 13] }
        : { top: [4, 5, 10, 11], bottom: [3, 4, 5, 10, 11, 12] };
    setPixels(grid, 13, feet.top, 'a');
    setPixels(grid, 14, feet.bottom, 'a');
    grid[3][7] = 'd';

    if (eyes === 'closed') {
        setPixels(grid, 6, [5, 6, 9, 10], 'c');
    } else if (eyes === 'happy') {
        setPixels(grid, 6, [5, 10], 'c');
        setPixels(grid, 7, [6, 9], 'c');
    } else if (eyes === 'wide') {
        setPixels(grid, 6, [5, 6, 9, 10], 'c');
        setPixels(grid, 7, [5, 6, 9, 10], 'c');
    } else {
        setPixels(grid, 6, [5, 10], 'c');
    }

    if (mouth === 'open') {
        setPixels(grid, 8, [7, 8], 'c');
        setPixels(grid, 9, [7, 8], 'c');
    } else if (mouth === 'happy') {
        setPixels(grid, 8, [6, 9], 'c');
        setPixels(grid, 9, [7, 8], 'c');
    } else {
        setPixels(grid, 8, [7, 8], 'c');
    }

    return grid.map((row) => row.join(''));
}

const BLOB_FRAMES = {
    idleA: makeBlobFrame(),
    idleB: makeBlobFrame({ pose: 'idleB' }),
    blink: makeBlobFrame({ eyes: 'closed' }),
    feedClosed: makeBlobFrame(),
    feedOpen: makeBlobFrame({ mouth: 'open' }),
    happy: makeBlobFrame({ eyes: 'happy', mouth: 'happy' }),
    patHappy: makeBlobFrame({ eyes: 'happy', mouth: 'happy', pose: 'idleB' }),
    sleep: makeBlobFrame({ eyes: 'closed' }),
    wake: makeBlobFrame({ eyes: 'wide' }),
};

export const YUMPALS_HEART_PIXELS = [
    '.a.a.',
    'aaaaa',
    'aaaaa',
    '.aaa.',
    '..a..',
];

export const YUMPALS_FOOD_PIXELS = {
    3: [
        '..a.....',
        '.ab.....',
        'aabbbb..',
        'abbbbb..',
        'bbbbbb..',
        '.bbbb...',
        '..bb....',
        '...b....',
    ],
    2: [
        '..a.....',
        '.ab.....',
        'aabbb...',
        'abbbb...',
        'bbbbb...',
        '.bbb....',
        '..b.....',
        '........',
    ],
    1: [
        '..a.....',
        '.ab.....',
        'aab.....',
        'abbb....',
        'bbb.....',
        '.b......',
        '........',
        '........',
    ],
    0: Array.from({ length: 8 }, () => '........'),
};

export const YUMPALS_ANIMATION_SEQUENCES = {
    idle: [
        { key: 'idle-a', spriteFrame: 'idleA', duration: 900 },
        { key: 'idle-b', spriteFrame: 'idleB', duration: 900 },
        { key: 'blink', spriteFrame: 'blink', duration: 160 },
    ],
    feed: [
        { key: 'feed-open-1', spriteFrame: 'feedOpen', mouth: 'open', foodRemaining: 3, duration: 320 },
        { key: 'feed-close-1', spriteFrame: 'feedClosed', mouth: 'closed', foodRemaining: 2, duration: 350 },
        { key: 'feed-open-2', spriteFrame: 'feedOpen', mouth: 'open', foodRemaining: 2, duration: 320 },
        { key: 'feed-close-2', spriteFrame: 'feedClosed', mouth: 'closed', foodRemaining: 1, duration: 350 },
        { key: 'feed-open-3', spriteFrame: 'feedOpen', mouth: 'open', foodRemaining: 1, duration: 320 },
        { key: 'feed-close-3', spriteFrame: 'feedClosed', mouth: 'closed', foodRemaining: 0, duration: 350 },
        { key: 'feed-happy', spriteFrame: 'happy', mouth: 'closed', foodRemaining: 0, duration: 520 },
    ],
    pat: [
        { key: 'pat-happy', spriteFrame: 'patHappy', heart: true, duration: 700 },
    ],
    sleep: [
        { key: 'sleep-z', spriteFrame: 'sleep', eyes: 'closed', sleepMark: 'Z', duration: 1000 },
        { key: 'sleep-zz', spriteFrame: 'sleep', eyes: 'closed', sleepMark: 'Zz', duration: 1000 },
    ],
    wake: [
        { key: 'wake-open', spriteFrame: 'wake', duration: 240 },
        { key: 'wake-happy', spriteFrame: 'happy', duration: 620 },
    ],
};

const LOOPING_ANIMATIONS = new Set(['idle', 'sleep']);

export const YUMPALS_SPRITES = Object.fromEntries(
    Object.entries(PALETTES).map(([id, palette]) => [id, {
        name: id === 'mossbit' ? 'Mossbit' : id === 'pufflet' ? 'Pufflet' : 'Emberoo',
        palette,
        frames: BLOB_FRAMES,
        pixels: BLOB_FRAMES.idleA,
    }]),
);

export function getYumPalsSprite(speciesId) {
    return YUMPALS_SPRITES[speciesId] || YUMPALS_SPRITES.mossbit;
}

export function getYumPalsAnimationSequence(animation = 'idle', reducedMotion = false) {
    const sequence = YUMPALS_ANIMATION_SEQUENCES[animation] || YUMPALS_ANIMATION_SEQUENCES.idle;
    if (reducedMotion && animation !== 'idle') return [sequence[sequence.length - 1]];
    if (reducedMotion) return [sequence[0]];
    return sequence;
}

export function getYumPalsFrame(speciesId, animation = 'idle', frameIndex = 0, reducedMotion = false) {
    const sprite = getYumPalsSprite(speciesId);
    const sequence = getYumPalsAnimationSequence(animation, reducedMotion);
    const safeIndex = Math.max(0, Math.min(frameIndex, sequence.length - 1));
    const frame = sequence[safeIndex];
    return {
        ...sprite,
        ...frame,
        pixels: sprite.frames[frame.spriteFrame] || sprite.pixels,
    };
}

export function createYumPalsAnimationState(reducedMotion = false) {
    return { type: 'idle', index: 0, token: 0, reducedMotion };
}

export function startYumPalsAnimation(state, type, reducedMotion = false) {
    const nextType = YUMPALS_ANIMATION_SEQUENCES[type] ? type : 'idle';
    return {
        type: nextType,
        index: 0,
        token: (state?.token || 0) + 1,
        reducedMotion,
    };
}

export function advanceYumPalsAnimation(state) {
    const sequence = getYumPalsAnimationSequence(state.type, state.reducedMotion);
    const nextIndex = state.index + 1;
    if (nextIndex < sequence.length) return { ...state, index: nextIndex };
    if (LOOPING_ANIMATIONS.has(state.type)) return { ...state, index: 0 };
    return { ...state, type: 'idle', index: 0 };
}
