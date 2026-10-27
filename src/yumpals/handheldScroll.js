// Phone-only: when YumPals opens, bring the whole handheld into view between the
// app's pinned header and its bottom icon bar. Pure target maths plus one DOM
// measurement, so the layout of the app around YumPals stays unchanged.

export const PHONE_QUERY = '(max-width: 767px)';
const GAP = 8;

// Returns the scroll position that shows the device, or null if it is already
// fully visible. Centres it in the free space when it fits; on phones too short
// for that it sits right under the header so its screen and buttons show first.
export function handheldScrollTarget({ deviceTop, deviceHeight, scrollY, viewportHeight, topInset = 0, bottomInset = 0, gap = GAP }) {
    const top = topInset + gap;
    const bottom = viewportHeight - bottomInset - gap;
    if (deviceTop >= top && deviceTop + deviceHeight <= bottom) return null;
    const room = bottom - top;
    const offset = deviceHeight <= room ? top + (room - deviceHeight) / 2 : topInset;
    return Math.max(0, Math.round(scrollY + deviceTop - offset));
}

// Full-width pinned bars: sticky/fixed at the top, fixed at the bottom.
export function measureScreenInsets(root = document.body, view = window) {
    let topInset = 0;
    let bottomInset = 0;
    for (const el of root.querySelectorAll('*')) {
        const style = view.getComputedStyle(el);
        if (style.position !== 'sticky' && style.position !== 'fixed') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < view.innerWidth * 0.9 || rect.height === 0 || rect.height > view.innerHeight / 3) continue;
        if (style.position === 'sticky') topInset = Math.max(topInset, (parseFloat(style.top) || 0) + rect.height);
        else if (rect.top <= 1) topInset = Math.max(topInset, rect.bottom);
        else if (rect.bottom >= view.innerHeight - 1) bottomInset = Math.max(bottomInset, view.innerHeight - rect.top);
    }
    return { topInset, bottomInset };
}
