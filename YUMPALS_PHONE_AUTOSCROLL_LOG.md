# YumPals phone auto-scroll — 28 October 2026

Request: after the tidy-up, the live handheld still started below the first phone
screen. Measured live at 390×844 (read-only):

- studio bar 96px (scrolls away)
- pinned YumDonut header 80px (sticky)
- padding 16px
- menu 49px + 20px
- YumPals border/padding ~26px
- title 91px + 12px
- reserved message line 39px + 12px

The handheld (513px) started at 453px. The visible area ends at 771px above the
73px bottom icon bar, so it had to start by 258px: 195px too low. Scrolled, it fits
under the pinned header with 169px to spare. The owner chose option 1: a phone-only
auto-scroll when YumPals opens, with no layout or design change, as a preview first.

Baseline: `a2c1014` (`main`, live). Branch `codex/yumpals-phone-autoscroll`.

## Changes / disposition

- ACCEPTED — `src/yumpals/handheldScroll.js`:
  - `handheldScrollTarget` centres the handheld between the pinned top inset and
    the bottom inset (8px gaps). It returns null when the handheld is already fully
    visible, and aligns the top right under the header when the phone is too short.
  - `measureScreenInsets` finds full-width sticky or fixed bars at the top and
    fixed bars at the bottom, so it doesn't depend on the app's class names.
  - `PHONE_QUERY` is `(max-width: 767px)`, the same breakpoint as the bottom icon
    bar (`md:hidden`).
- ACCEPTED — `YumPalsSavedHandheld.jsx`: once the pal has loaded (`quote !== null`),
  scroll once, on phones only, unless the student has already scrolled (wheel,
  touchmove, or PageUp/PageDown/Home/End/Space). The scroll is smooth, or instant
  with reduced motion. The flag is set inside the animation frame, so React's
  development double-run still scrolls once. The ref is on the outer `<section>`;
  the guarded device markup is unchanged and both design guards pass.
- ACCEPTED (corrected) — the first version aligned short phones 8px below the
  header. At 375×667 the free space is 514px against a 515px handheld, so the casing
  went 9px under the bottom bar. Short phones now align right under the header:
  screen and A/B/C buttons fully visible, only 1px of casing edge under the bar.
- ACCEPTED — `verification/saved-in-app.html/.jsx`: the saved handheld inside
  stand-ins for the app's chrome at the live-measured sizes. It uses no account;
  `?delay=ms` slows the pal's load.
- ACCEPTED — `verification/autoscroll-check.mjs` and `handheldScroll.test.js`
  (5 tests).
- REFUSED (test error, code unchanged) — the "only once" check first used a
  Playwright trial click, which itself scrolls the Refresh link into view (544px).
  The trial click was removed; the assertion was unchanged.
- Not changed: the app's header, menu, studio bar, the handheld's size and design,
  the YumPals preview, and desktop or tablet behaviour.

## Measured results

`autoscroll-check.mjs` on the app-like test page: PASS, zero page errors.

| Phone | Scrolled to | Handheld on screen | Visible area (header → bottom bar) |
|---|---|---|---|
| 390×844 | 285px | 168–683px, whole, centred | 80–771px |
| 414×896 | 259px | 194–709px, whole | 80–823px |
| 360×740 | 360px | 116–630px, whole | 80–667px |
| 375×667 | 373px | 80–595px: screen and A/B/C buttons whole, casing edge 1px under the bar | 80–594px |

- 768×900 and 1280×800: no auto-scroll.
- A student who scrolled during a 1.5s load stayed at their 120px position.
- Reduced motion landed at 285px in one step.
- After scrolling back to the top, pressing Refresh pal did not scroll again.
- The 390×844 screenshot was inspected: the whole handheld sits between the header
  and the bottom icon bar.
- Frontend suite: 155/155 passed in 9.94s, including both handheld design guards.
  Lint exit 0. `git diff --check` clean.
- Production build exit 0, 1721 modules. JS 929.72kB / 275.53kB gzip; CSS
  unchanged (`index-DIiztJ8z.css`).
