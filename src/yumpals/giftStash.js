// The YumPals tab's background visibility check reads the same saved-pal state as
// the handheld, so it can be the read that grants today's visit gift or giving
// cheer. Keep any gift it receives for today, so the handheld can still show it
// (once) when the student opens YumPals later.
import { validateHandheldView } from './paidCareClient.js';

export const GIFT_STASHED_EVENT = 'yumpals-gift-stashed';
const key = uid => `yumpals_pending_gifts_${uid}`;
const bit = value => value === 0 || value === 1;
const NEEDS = ['hunger', 'happiness', 'cleanliness', 'health'];
const validVisit = (visit, date) => Boolean(visit) && visit.date === date && typeof visit.welcomeBack === 'boolean'
    && Boolean(visit.gains) && Object.keys(visit.gains).length === NEEDS.length && NEEDS.every(need => bit(visit.gains[need]));
const validCheer = (cheer, date) => Boolean(cheer) && cheer.date === date && bit(cheer.gain);

export function stashGifts(uid, reply, storage = globalThis.localStorage, target = globalThis) {
    if (!reply?.visit && !reply?.cheer) return false;
    let view;
    try { view = validateHandheldView(reply, uid); } catch { return false; }
    try {
        const raw = storage?.getItem(key(uid));
        const previous = raw ? JSON.parse(raw) : null;
        const base = previous?.date === view.aucklandDate ? previous : { date: view.aucklandDate };
        storage?.setItem(key(uid), JSON.stringify({ ...base, ...(view.visit ? { visit: view.visit } : {}), ...(view.cheer ? { cheer: view.cheer } : {}) }));
    } catch {
        return false;
    }
    target?.dispatchEvent?.(new Event(GIFT_STASHED_EVENT));
    return true;
}

export function readStashedGifts(uid, dateKey, storage = globalThis.localStorage) {
    try {
        const raw = storage?.getItem(key(uid));
        if (!raw) return null;
        const saved = JSON.parse(raw);
        if (saved?.date !== dateKey) return null;
        return { visit: validVisit(saved.visit, dateKey) ? saved.visit : null, cheer: validCheer(saved.cheer, dateKey) ? saved.cheer : null };
    } catch {
        return null;
    }
}
