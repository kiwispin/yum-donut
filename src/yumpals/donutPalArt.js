// Original pixel art and screen layouts for the Donut pal. The screen is a 32x16
// two-tone dot matrix: '#' is a lit dot, '.' is off. Everything here is drawn for
// YumPals (no borrowed characters or icons).
import { NEEDS_MAX, ageDays, isAsleep } from './donutPal.js';

export const SCREEN_W = 32;
export const SCREEN_H = 16;

function grid(w, h) {
    return Array.from({ length: h }, () => Array(w).fill('.'));
}

// Body outlines from [row, start, end] runs; steps wider than one dot are joined.
function outline(rows, size = 16) {
    const g = grid(size, size);
    rows.forEach(([row, start, end], index) => {
        g[row][start] = '#'; g[row][end] = '#';
        if (index === 0 || index === rows.length - 1) for (let x = start; x <= end; x++) g[row][x] = '#';
        const prev = rows[index - 1];
        if (!prev) return;
        const [, ps] = prev;
        if (start < ps - 1) for (let x = start; x < ps; x++) { g[row][x] = '#'; g[row][size - 1 - x] = '#'; }
        if (start > ps + 1) for (let x = ps + 1; x <= start; x++) { g[row][x] = '#'; g[row][size - 1 - x] = '#'; }
    });
    return g;
}

function plot(g, points) {
    for (const [x, y] of points) if (g[y] && x >= 0 && x < g[y].length) g[y][x] = '#';
    return g;
}

const mirror = points => points.map(([x, y]) => [15 - x, y]);

// eyes: [leftX, rightX, y], tall eyes for adults; mouth: [x, y] of its left dot.
const BODIES = {
    baby: {
        rows: [[6, 6, 9], [7, 4, 11], [8, 3, 12], [9, 3, 12], [10, 3, 12], [11, 3, 12], [12, 4, 11], [13, 5, 10]],
        extra: [[5, 14], [6, 14], [9, 14], [10, 14]],
        eyes: [6, 9, 9], mouth: [7, 11],
    },
    child: {
        rows: [[4, 6, 9], [5, 5, 10], [6, 4, 11], [7, 3, 12], [8, 3, 12], [9, 3, 12], [10, 3, 12], [11, 3, 12], [12, 4, 11], [13, 5, 10]],
        extra: [[7, 3], [7, 2], [8, 1], [9, 1], [8, 2], [2, 9], [13, 9], [1, 10], [14, 10], [5, 14], [6, 14], [9, 14], [10, 14]],
        eyes: [5, 10, 8], mouth: [7, 10],
    },
    teen: {
        rows: [[3, 5, 10], [4, 4, 11], [5, 3, 12], [6, 3, 12], [7, 2, 13], [8, 2, 13], [9, 2, 13], [10, 2, 13], [11, 2, 13], [12, 3, 12], [13, 4, 11]],
        extra: [[5, 2], [4, 1], [10, 2], [11, 1], [1, 9], [14, 9], [4, 14], [5, 14], [10, 14], [11, 14]],
        eyes: [5, 10, 7], mouth: [7, 10],
    },
    mossbit: {
        rows: [[2, 5, 10], [3, 4, 11], [4, 3, 12], [5, 2, 13], [6, 2, 13], [7, 1, 14], [8, 1, 14], [9, 1, 14], [10, 1, 14], [11, 1, 14], [12, 2, 13], [13, 3, 12]],
        extra: [...[[1, 0], [2, 0], [1, 1], [2, 1], [3, 1], [2, 2], [3, 2]], ...mirror([[1, 0], [2, 0], [1, 1], [2, 1], [3, 1], [2, 2], [3, 2]]),
            [4, 14], [5, 14], [10, 14], [11, 14]],
        eyes: [5, 10, 7], tall: true, mouth: [7, 10],
    },
    pufflet: {
        rows: [[3, 4, 11], [4, 2, 13], [5, 1, 14], [6, 1, 14], [7, 0, 15], [8, 0, 15], [9, 0, 15], [10, 0, 15], [11, 1, 14], [12, 2, 13]],
        extra: [[5, 2], [6, 2], [9, 2], [10, 2], [6, 14], [7, 14], [8, 14], [9, 14]],
        eyes: [5, 10, 6], tall: true, mouth: [7, 9],
    },
    emberoo: {
        rows: [[5, 4, 11], [6, 3, 12], [7, 2, 13], [8, 2, 13], [9, 2, 13], [10, 2, 13], [11, 2, 13], [12, 3, 12], [13, 4, 11]],
        extra: [[5, 0], [4, 1], [4, 2], [4, 3], [4, 4], [6, 1], [6, 2], [6, 3], [6, 4],
            [10, 0], [9, 1], [9, 2], [9, 3], [9, 4], [11, 1], [11, 2], [11, 3], [11, 4],
            [14, 9], [15, 10], [14, 11], [3, 14], [4, 14], [5, 14], [10, 14], [11, 14], [12, 14]],
        eyes: [5, 10, 8], tall: true, mouth: [7, 11],
    },
};

// Scruffy adults: the same species after a lot of care mistakes, with droopy or
// frazzled bits and a grumpy, half-lidded look.
const DROOPY_EAR = [[1, 2], [0, 3], [1, 3], [0, 4], [0, 5]];
Object.assign(BODIES, {
    mossbitScruffy: {
        ...BODIES.mossbit, grumpy: true,
        extra: [...DROOPY_EAR, ...mirror(DROOPY_EAR), [6, 1], [7, 0], [9, 1], [10, 0], [4, 14], [5, 14], [10, 14], [11, 14]],
    },
    puffletScruffy: {
        ...BODIES.pufflet, grumpy: true,
        extra: [[5, 2], [7, 1], [9, 2], [11, 1], [4, 14], [7, 14], [10, 14], [13, 14]],
    },
    emberooScruffy: {
        ...BODIES.emberoo, grumpy: true,
        extra: [[5, 0], [4, 1], [4, 2], [4, 3], [4, 4], [6, 1], [6, 2], [6, 3], [6, 4],
            [9, 4], [9, 3], [10, 2], [11, 2], [12, 3], [11, 4],
            [14, 9], [15, 8], [15, 10], [14, 11], [15, 12], [3, 14], [4, 14], [5, 14], [10, 14], [11, 14], [12, 14]],
    },
});

const EGG = (() => {
    const g = outline([[2, 6, 9], [3, 5, 10], [4, 4, 11], [5, 3, 12], [6, 3, 12], [7, 2, 13], [8, 2, 13], [9, 2, 13], [10, 2, 13], [11, 3, 12], [12, 3, 12], [13, 4, 11], [14, 5, 10]]);
    return plot(g, [[7, 5], [10, 7], [5, 8], [8, 10], [11, 11], [6, 12]]).map(row => row.join(''));
})();

const EGG_CRACKED = (() => {
    const g = EGG.map(row => row.split(''));
    plot(g, [[3, 8], [4, 9], [5, 8], [6, 9], [7, 8], [8, 9], [9, 8], [10, 9], [11, 8], [12, 9]]);
    return g.map(row => row.join(''));
})();

function eyes(kind, [lx, rx, y], tall) {
    const points = [];
    for (const [x, out] of [[lx, -1], [rx, 1]]) {
        if (kind === 'open') points.push([x, y], ...(tall ? [[x, y + 1]] : []));
        else if (kind === 'left' || kind === 'right') {
            const dx = kind === 'left' ? -1 : 1;
            points.push([x + dx, y], ...(tall ? [[x + dx, y + 1]] : []));
        } else if (kind === 'closed') points.push([x, y + 1], [x + out, y + 1]);
        else if (kind === 'happy') points.push([x, y], [x - 1, y + 1], [x + 1, y + 1]);
        else if (kind === 'low') points.push([x, y + 1]);
    }
    return points;
}

function mouth(kind, [x, y]) {
    switch (kind) {
        case 'open': return [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
        case 'smile': return [[x - 1, y], [x + 2, y], [x, y + 1], [x + 1, y + 1]];
        case 'frown': return [[x, y], [x + 1, y], [x - 1, y + 1], [x + 2, y + 1]];
        case 'wavy': return [[x - 1, y + 1], [x, y], [x + 1, y + 1], [x + 2, y]];
        default: return [[x, y], [x + 1, y]];
    }
}

export const FACES = {
    idle: ['open', 'closed'], blink: ['closed', 'closed'], eatOpen: ['open', 'open'], eatShut: ['open', 'closed'],
    happy: ['happy', 'smile'], sad: ['low', 'frown'], sick: ['closed', 'wavy'], sleep: ['closed', 'closed'],
    left: ['left', 'closed'], right: ['right', 'closed'], lookLeftHappy: ['left', 'smile'], lookRightHappy: ['right', 'smile'],
};

const spriteCache = new Map();
export function bodyFor(pal) {
    if (pal.stage === 'egg') return 'egg';
    if (pal.stage !== 'adult') return pal.stage;
    return pal.form === 'scruffy' ? `${pal.species}Scruffy` : pal.species;
}

export function palSprite(body, face = 'idle') {
    if (body === 'egg') return face === 'cracked' ? EGG_CRACKED : EGG;
    const key = `${body}:${face}`;
    if (!spriteCache.has(key)) {
        const spec = BODIES[body] || BODIES.baby;
        let [eyeKind, mouthKind] = FACES[face] || FACES.idle;
        if (spec.grumpy && eyeKind === 'open') eyeKind = 'low';
        const g = plot(outline(spec.rows), spec.extra);
        plot(g, eyes(eyeKind, spec.eyes, spec.tall));
        plot(g, mouth(mouthKind, spec.mouth));
        spriteCache.set(key, g.map(row => row.join('')));
    }
    return spriteCache.get(key);
}

export const BODY_NAMES = ['egg', 'baby', 'child', 'teen', 'mossbit', 'pufflet', 'emberoo', 'mossbitScruffy', 'puffletScruffy', 'emberooScruffy'];

export const PROPS = {
    mess: ['.#.#.', '#.#..', '..#..', '.###.', '#####'],
    messB: ['#.#..', '.#.#.', '..#..', '.###.', '#####'],
    meal: ['.#.#.#.', '#######', '#.#.#.#', '.#####.', '..###..'],
    mealHalf: ['.......', '##...##', '#.#.#.#', '.#####.', '..###..'],
    mealEmpty: ['.......', '#.....#', '#.....#', '.#####.', '..###..'],
    snack: ['..##..', '.####.', '######', '#.#.#.', '#.#.#.', '.####.'],
    snackHalf: ['......', '...##.', '..####', '#.#.#.', '#.#.#.', '.####.'],
    snackEmpty: ['......', '......', '......', '.....#', '#.#.#.', '.####.'],
    donut: ['.####.', '##..##', '#....#', '#....#', '##..##', '.####.'],
    heart: ['##.##', '#####', '.###.', '..#..'],
    heartEmpty: ['##.##', '#.#.#', '.#.#.', '..#..'],
    z: ['###', '.#.', '###'],
    cloud: ['.##.##.', '#######', '.#####.', '..#.#..', '.#.#...'],
    medicine: ['.###.', '#####', '##.##', '#...#', '##.##', '#####'],
    smile: ['.#####.', '#.....#', '#.#.#.#', '#.....#', '#.###.#', '.#####.'],
    arrowLeft: ['..#', '.##', '###', '.##', '..#'],
    arrowRight: ['#..', '##.', '###', '##.', '#..'],
    win: ['###', '###', '###'],
    lose: ['###', '#.#', '###'],
    pending: ['...', '.#.', '...'],
    weight: ['.###.', '.#.#.', '#####', '#####', '#####'],
};

const FONT = {
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
    3: ['###', '..#', '###', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
    6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '###'], A: ['.#.', '#.#', '###', '#.#', '#.#'], G: ['###', '#..', '#.#', '#.#', '###'],
    E: ['###', '#..', '##.', '#..', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], S: ['###', '#..', '###', '..#', '###'],
    P: ['##.', '#.#', '##.', '#..', '#..'], M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], ':': ['.', '#', '.', '#', '.'],
};

// The six care icons around the screen (8x8), in A-button order.
export const ICON_ORDER = ['food', 'play', 'clean', 'medicine', 'lights', 'status'];
export const ICON_LABELS = { food: 'Food', play: 'Play', clean: 'Clean', medicine: 'Medicine', lights: 'Lights', status: 'Status' };
export const ICONS = {
    food: ['..#..#..', '.#..#...', '..#..#..', '........', '########', '#......#', '.#....#.', '..####..'],
    play: ['..####..', '.#....#.', '#.#..#.#', '#..##..#', '#..##..#', '#.#..#.#', '.#....#.', '..####..'],
    clean: ['...##...', '...##...', '..####..', '.######.', '.#.####.', '.##.###.', '..####..', '........'],
    medicine: ['..####..', '..#..#..', '###..###', '#......#', '#......#', '###..###', '..#..#..', '..####..'],
    lights: ['..####..', '.#....#.', '#......#', '#......#', '.#....#.', '..#..#..', '..####..', '..####..'],
    status: ['........', '.##..##.', '########', '########', '.######.', '..####..', '...##...', '........'],
};

class Screen {
    constructor() { this.g = grid(SCREEN_W, SCREEN_H); }
    draw(sprite, x, y) {
        sprite.forEach((row, dy) => {
            for (let dx = 0; dx < row.length; dx++) {
                const gx = x + dx; const gy = y + dy;
                if (row[dx] === '#' && gy >= 0 && gy < SCREEN_H && gx >= 0 && gx < SCREEN_W) this.g[gy][gx] = '#';
            }
        });
        return this;
    }
    erase(sprite, x, y) {
        sprite.forEach((row, dy) => { for (let dx = 0; dx < row.length; dx++) if (row[dx] === '#' && this.g[y + dy]?.[x + dx]) this.g[y + dy][x + dx] = '.'; });
        return this;
    }
    fill() { this.g = this.g.map(row => row.map(() => '#')); return this; }
    clearFrom(x) { for (const row of this.g) for (let i = Math.max(0, x); i < SCREEN_W; i++) row[i] = '.'; return this; }
    text(value, x, y) {
        let cx = x;
        for (const ch of String(value)) { const glyph = FONT[ch]; if (glyph) { this.draw(glyph, cx, y); cx += glyph[0].length + 1; } else cx += 2; }
        return this;
    }
    invert() { this.g = this.g.map(row => row.map(cell => cell === '#' ? '.' : '#')); return this; }
    rows() { return this.g.map(row => row.join('')); }
}

const shiftDown = sprite => ['.'.repeat(sprite[0].length), ...sprite.slice(0, -1)];

// Lights out: a dark screen with one sleepy Z glowing.
function lightsOutScreen(tick) {
    return new Screen().fill().erase(PROPS.z, tick % 2 ? 14 : 16, tick % 2 ? 6 : 7).rows();
}

const MESS_SLOTS = [[27, 11], [27, 4], [21, 11]];
export function walkRange(pal) {
    return pal.mess >= 3 ? 4 : pal.mess > 0 ? 10 : 16;
}

function drawMess(screen, count, tick) {
    for (let i = 0; i < count; i++) screen.draw(tick % 2 ? PROPS.messB : PROPS.mess, ...MESS_SLOTS[i]);
}

// The resting screen: the pal wanders, blinks and shows how it feels.
export function drawRoom(pal, { x = 8, tick = 0, ms = pal.at, reducedMotion = false } = {}) {
    const screen = new Screen(); const body = bodyFor(pal);
    if (body === 'egg') {
        const wobble = reducedMotion ? 0 : [0, 1, 0, -1][tick % 4];
        return screen.draw(EGG, 8 + wobble, 0).rows();
    }
    const asleep = isAsleep(pal, ms);
    drawMess(screen, pal.mess, reducedMotion ? 0 : tick);
    if (asleep && pal.lightsOff) return lightsOutScreen(reducedMotion ? 0 : tick);
    if (asleep) {
        screen.draw(palSprite(body, 'sleep'), 6, 0);
        if (reducedMotion || tick % 2) screen.draw(PROPS.z, 22, 1); else screen.draw(PROPS.z, 24, 4);
        return screen.rows();
    }
    if (pal.sick) {
        screen.draw(palSprite(body, 'sick'), 4, 0).draw(PROPS.cloud, 18, 0);
        return screen.rows();
    }
    let face = 'idle';
    if (pal.sleepy) face = 'sleep';
    else if (pal.hunger === 0 || pal.happy === 0) face = tick % 6 < 3 ? 'sad' : 'idle';
    else if (pal.happy >= NEEDS_MAX && tick % 8 === 4) face = 'happy';
    else if (tick % 7 === 3) face = 'blink';
    let sprite = palSprite(body, face);
    if (!reducedMotion && !pal.sleepy && tick % 2) sprite = shiftDown(sprite);
    screen.draw(sprite, Math.max(0, Math.min(walkRange(pal), x)), 0);
    if (pal.sleepy && (reducedMotion || tick % 2)) screen.draw(PROPS.z, 22, 1);
    return screen.rows();
}

// Short animations after an action; each returns its frames.
export function animationFrames(pal, type, { reducedMotion = false } = {}) {
    const body = bodyFor(pal); const s = () => new Screen(); const at = (face, x = 2) => s().draw(palSprite(body, face), x, 0);
    switch (type) {
        case 'eat':
        case 'snack': {
            const [full, half, empty] = type === 'eat' ? ['meal', 'mealHalf', 'mealEmpty'] : ['snack', 'snackHalf', 'snackEmpty'];
            return [at('idle').draw(PROPS[full], 22, 10), at('eatOpen').draw(PROPS[full], 22, 10), at('eatShut').draw(PROPS[half], 22, 10),
                at('eatOpen').draw(PROPS[half], 22, 10), at('eatShut').draw(PROPS[empty], 22, 10), at('happy')].map(f => f.rows());
        }
        case 'no': return ['left', 'right', 'left', 'right'].map(face => at(face, 8).rows());
        case 'shrug': return [at('sad', 8), at('idle', 8), at('sad', 8)].map(f => f.rows());
        case 'happy':
        case 'napped': return [0, 1, 2, 3].map(i => at('happy', 4).draw(i % 2 ? PROPS.heart : PROPS.heartEmpty, 24, 2).rows());
        case 'clean': {
            const frames = [];
            for (let line = 31; line >= -1; line -= 4) {
                const f = new Screen(); drawMess(f, pal.mess, 0); f.draw(palSprite(body, 'idle'), 4, 0).clearFrom(line);
                for (let y = 0; y < SCREEN_H; y++) { const wx = line + (y % 2); if (wx >= 0 && wx < SCREEN_W) f.g[y][wx] = '#'; }
                frames.push(f.rows());
            }
            return [...frames, at('happy', 8).rows()];
        }
        case 'dose': return [at('sick', 4).draw(PROPS.medicine, 23, 9), at('sick', 4).draw(PROPS.cloud, 18, 0), at('sick', 4)].map(f => f.rows());
        case 'medicine': return [at('sick', 4).draw(PROPS.medicine, 23, 9), at('idle', 4).draw(PROPS.medicine, 23, 9), at('happy', 8)].map(f => f.rows());
        case 'lightsOff': return [s().draw(palSprite(body, 'sleep'), 6, 0).draw(PROPS.z, 22, 1).rows(), lightsOutScreen(0)];
        case 'lightsOn': return [at('blink', 6).rows(), at('idle', 6).rows()];
        case 'hatched': {
            const wobble = [0, 1, -1, 1, -1, 0].map(dx => s().draw(EGG, 8 + (reducedMotion ? 0 : dx), 0).rows());
            return [...wobble, s().draw(EGG_CRACKED, 8, 0).rows(), s().draw(palSprite('baby', 'happy'), 8, 0).rows()];
        }
        case 'grew': {
            const flash = [0, 1, 2, 3].map(i => {
                const f = s().draw(palSprite(body, 'idle'), 8, 0); return (i % 2 && !reducedMotion ? f.invert() : f).rows();
            });
            return [...flash, at('happy', 8).rows(), at('happy', 8).rows()];
        }
        default: return [at('idle', 8).rows()];
    }
}

// Food choice: A moves, B picks. The cupcake snack shows its price: 1 donut.
export function drawFoodMenu(cursor) {
    const screen = new Screen();
    screen.draw(PROPS.arrowRight, 1, cursor === 0 ? 1 : 10);
    screen.draw(PROPS.meal, 7, 1).draw(PROPS.snack, 8, 9).text(1, 17, 10).draw(PROPS.donut, 22, 9);
    return screen.rows();
}

// Status pages, as in the manual: age and weight, food, happy; then your donuts.
export const STATUS_PAGES = 4;
export function drawStatus(pal, page, { donuts = 0, ms = pal.at } = {}) {
    const screen = new Screen();
    const hearts = (count, y) => { for (let i = 0; i < NEEDS_MAX; i++) screen.draw(i < count ? PROPS.heart : PROPS.heartEmpty, 3 + i * 7, y); };
    if (page === 0) screen.text('AGE', 1, 2).text(Math.min(99, ageDays(pal, ms)), 20, 2).draw(PROPS.weight, 5, 9).text(Math.min(99, pal.weight || 0), 20, 9);
    else if (page === 1) { screen.draw(PROPS.meal, 1, 1); hearts(pal.hunger, 10); }
    else if (page === 2) { screen.draw(PROPS.smile, 1, 0); hearts(pal.happy, 10); }
    else screen.draw(PROPS.donut, 1, 1).text(Math.min(999, donuts), 1, 9);
    return screen.rows();
}

// Left or right? The pal turns; match its turn to win the round.
export function drawGame(pal, game, tick = 0) {
    const screen = new Screen(); const body = bodyFor(pal);
    game.results.forEach((won, i) => screen.draw(won ? PROPS.win : PROPS.lose, 0, i * 3 + 1));
    for (let i = game.results.length; i < 5; i++) screen.draw(PROPS.pending, 0, i * 3 + 1);
    if (game.reveal) {
        const won = game.reveal.guess === game.reveal.turn;
        const face = game.reveal.turn === 'left' ? (won ? 'lookLeftHappy' : 'left') : (won ? 'lookRightHappy' : 'right');
        screen.draw(palSprite(body, face), 8, 0).draw(game.reveal.turn === 'left' ? PROPS.arrowLeft : PROPS.arrowRight, game.reveal.turn === 'left' ? 4 : 26, 6);
    } else {
        screen.draw(palSprite(body, tick % 4 === 1 ? 'blink' : 'idle'), 8, 0);
        if (tick % 2 === 0) screen.draw(PROPS.arrowLeft, 4, 6).draw(PROPS.arrowRight, 26, 6);
    }
    return screen.rows();
}

// After 5 rounds: misses VS wins, with a heart over your wins.
export function drawGameScore(wins, rounds = 5) {
    return new Screen().draw(PROPS.lose, 8, 2).draw(PROPS.heart, 19, 1).text(`${rounds - wins}VS${wins}`, 8, 8).rows();
}

// B with no icon picked shows the clock (Auckland time).
export function drawClock(hour, minute) {
    const h12 = hour % 12 || 12; const time = `${h12}:${String(minute).padStart(2, '0')}`;
    const width = [...time].reduce((sum, ch) => sum + (FONT[ch]?.[0].length ?? 1) + 1, -1);
    return new Screen().text(time, Math.floor((SCREEN_W - width) / 2), 2).text(hour < 12 ? 'AM' : 'PM', 12, 9).rows();
}
