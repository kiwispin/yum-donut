// Gift-waiting dot for the Pals / YumPals buttons. Remembers, per student on this
// device, the Auckland date of their last YumPals visit and whether they have a
// pal. The dot shows until today's visit, never for a student known to have no pal.

export const PAL_VISITED_EVENT = 'yumpals-visited';
const key = uid => `yumpals_last_visit_${uid}`;

export function markPalVisited(uid, dateKey, hasPal, storage = globalThis.localStorage, target = globalThis) {
    try { storage?.setItem(key(uid), JSON.stringify({ date: dateKey, hasPal })); } catch { /* the dot just stays */ }
    target?.dispatchEvent?.(new Event(PAL_VISITED_EVENT));
}

export function palGiftWaiting(uid, todayKey, storage = globalThis.localStorage) {
    if (!uid) return false;
    try {
        const raw = storage?.getItem(key(uid));
        if (!raw) return true;
        const seen = JSON.parse(raw);
        return seen?.hasPal !== false && seen?.date !== todayKey;
    } catch {
        return false;
    }
}
