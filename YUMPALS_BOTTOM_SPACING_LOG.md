# YumPals spacing below the handheld — 29 October 2026

Owner feedback: too much space between sections at the bottom of YumPals ("a yellow
box, a huge gap, donuts/care today, huge gap, refresh pal"), asking whether the
UI/UX had really been checked.

Honest review: the tidy-up (`YUMPALS_TIDY_UP_LOG.md`) measured page totals, stray
scrollbars and no-jump, but not the spacing between sections. Its own "after"
screenshot showed large uneven gaps, which I explained away as reserved space
instead of fixing. The owner's description (yellow hint box, gap, counters, gap,
Refresh pal button) matches the layout from before the tidy-up, so their view was
probably not reloaded since then. The live page measured today had no yellow box
below the handheld, but its gaps were still uneven and too large.

Baseline: `63cd646` (`main`, live). Branch `codex/yumpals-bottom-spacing`.

## Cause (measured live, 805px wide, and on the app-like test page)

- The hint line reserved the height of the longest help text so that hovering icons
  never shifts the page. The hint shows "Label — full help", and the longest ("Food —
  Give a meal or snack to fill your pal’s tummy. Food hearts show how well fed your
  pal is.") wraps to two lines on desktop and three on phones. So a single line,
  "Press A SELECT to choose an icon.", sat in a 45–67px block.
- Then the counters' 24px top margin, Refresh pal's 12px margins plus its 44px touch
  height, How to play's 12px margins, and the page's 40px bottom padding.

## Changes / disposition

- ACCEPTED — `savedHandheldPresentation.js` `SAVED_HINTS` and
  `YumPalsSavedHandheld.jsx` `hintFor`: the hint line (and its hidden sizing text)
  uses one-line cues, at most 36 characters with the label:
  - Food — a meal or snack
  - Lights — lights out for bedtime
  - Game — guess left or right (or "not ready; try a pat")
  - Medicine — help your pal feel better
  - Clean — clean up the mess
  - Health and status — free to check
  - Gentle discipline — a calm reminder
  - Attention — does your pal need you?

  The full `helpFor` text is unchanged in How to play, tooltips and screen-reader
  descriptions. The reserved block is now one line, so there is still no jump.
- ACCEPTED — `appSurround.css`, saved page only: hint margin `10px auto 0`, padding
  `0 8px`; counters `margin-top: 8px`; utilities `margin: 4px auto 0`; How to play
  `margin: 4px auto 0`; page bottom padding 40 → 24px. Refresh pal keeps its 44px
  touch height. The guarded `savedHandheld.css` and device markup are unchanged.
- ACCEPTED — `verification/bottom-spacing-measure.mjs`: measures visible gaps (text
  to text, box to box) and checks for jumps while hovering icons.
- REFUSED (first pass, not enough) — margins alone left 35px and 34px gaps around
  the hint on phones, because of the three-line reservation. The short hints fixed
  the cause.

## Measured results (app-like test page; visible gaps in px)

| | handheld→hint | hint→counters | counters→Refresh | Refresh→How to play | →page end | below handheld total |
|---|---|---|---|---|---|---|
| Before, 390px | 43 | 54 | 26 | 27 | 46 | 324 |
| Before, 1280px | 32 | 43 | 26 | 27 | 54 | 310 |
| After, 320 / 390 / 1280px | 13 | 11 | 18 | 19 | 26 | 215 |

- Hovering all 8 icons moved nothing at any size. `tidy-up-stability.mjs`:
  messages and icons never moved the device at 320, 390 and 1024px.
  `autoscroll-check.mjs`: unchanged, PASS. The 390px screenshot was inspected:
  compact and even.
- Frontend suite 167/167, lint exit 0, `git diff --check` clean, build exit 0. CSS
  95.56kB / 17.41kB gzip; JS 933.89kB / 276.87kB gzip.

## Release

- Owner approved. `main` fast-forwarded to `c8ab9fc` (also on
  `codex/yumpals-only-release`). Rollback tag
  `codex/yumpals-bottom-spacing-baseline-20261029` → `63cd646`. Atomic push, and the
  remote IDs were verified.
- RELEASE VERIFIED — published with `npm run deploy` as `gh-pages` commit `8e01d05`,
  live after ~60s. Live `index.html` is byte-identical to the build; JS
  `index-DTBnI_tO.js` (MD5 `a07309f2d657562f71b5385948a39fb7`) and CSS
  `index-XvdZ1VS3.css` (MD5 `9ffc851b2ceb3aa1d4cfd036299e596b`) match locally.
- Live, signed in as the owner:
  - 390×844: visible gaps 13 / 11 / 18 / 19 / 26px; 215px below the handheld (was
    324px), matching the test page exactly.
  - Real mouse hovers on Clean, Health and status, Gentle discipline and Attention
    showed their one-line cues and moved nothing.
  - 1280×900: the same gaps and 215px; no failed requests. Screenshots at both
    sizes inspected.
  - An earlier scripted-focus hover check was inconclusive, because the pane was
    not the focused window so the hint did not change. It was replaced by the real
    hovers above.
- Rollback: rebuild and publish `codex/yumpals-bottom-spacing-baseline-20261029`.
