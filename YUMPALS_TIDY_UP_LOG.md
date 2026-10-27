# YumPals page tidy-up — 28 October 2026

Request: the owner asked whether the saved YumPals page had too much text and too
many instructions below the device, and whether a full UI/UX pass had been done (it
had not). A measured review followed, then the owner approved: a compact header on
phones; the "saved between visits" notice moved into How to play; waiting-care and
sync messages sharing one reserved line; the hint as a slim line; the stray
scrollbar fixed; Refresh pal as a link. To be shown on the test page before release.

Baseline: `d8986ab` (`main`, live). Branch `codex/yumpals-tidy-up`.

Constraints kept: the device markup and `paidCareDemo.css` are untouched (the design
guards in `surround.test.js` pass unchanged), and so is the magazine look. The
September decision that messages must never move the page
(`YUMPALS_EMPTY_STATUS_LOG.md`: removing the reserved boxes was refused because
the controls moved) is kept by a different means: one reserved line instead of
three. The refused approach of collapsing reserved space was not repeated.

## Changes / disposition

- ACCEPTED — `YumPalsSavedHandheld.jsx`:
  - Waiting-care and sync messages now show in the existing reserved status line
    above the device (`localMessage || pendingMessage || cheerNote || …`):
    "Saving care… N donuts after.", "Reconnecting… your care is kept safe.", or
    "<care> needs checking. Tap Reconnect." The pink queue box and yellow sync box
    below the device are removed. Reconnect still appears when needed.
  - The notice "Your pal is saved between visits. Donuts are spent only when you
    confirm the price." moved from above the device to the first line of How to play.
  - Refresh pal gets the class `saved-refresh-link`.
- ACCEPTED — `appSurround.css`, saved page only:
  - The hint is plain text with no yellow box, keeping its hidden sizing text so
    hovering icons never shifts the page.
  - Refresh pal is an underlined text link, still 44px tall for touch.
  - Phones (≤480px) get a compact header: no "The Pocket Pal Handbook" kicker, a
    34px title and tighter spacing.
  - The unused `.saved-sync` rule was removed.
- ACCEPTED — `savedHandheld.css`: removed the four rules for the removed boxes. The
  design guard strips exactly these rules before comparing, so it passes unchanged.
- ACCEPTED — narrow phones (≤360px) reserve two lines for the status line. The first
  stability run showed three messages wrapping at 320px and moving the device +22px;
  with two lines reserved, nothing moves.
- ACCEPTED — `emptyStatus.test.js` rewritten. The September guard asserted the
  separate queue and sync boxes existed. It now guards the same rule: messages
  never move the page. Pending messages use the reserved status line, the old boxes
  are gone, the line keeps `height/min-height: 2.8em` (4.4em at ≤360px), and the hint
  keeps its hidden sizing text with no height or display override.
- ACCEPTED — `verification/care-speed-check.mjs` and `device-response-check.mjs`
  now read waiting care from the status line. The after-care check expects the
  outcome message (for example "Purchase confirmed.") rather than a blank box. The
  first edit missed a text-based reference ("2 care actions waiting to finish"),
  found on the first run and fixed.
- ACCEPTED — new `verification/tidy-up-measure.mjs` (layout measurements and
  full-page screenshots) and `verification/tidy-up-stability.mjs` (hover every icon
  and show every status message; nothing below may move).
- Not changed: the device, the counters, How to play's other content, the YumPals
  preview, prices and care behaviour.

## Measured results

Test page `verification/saved-surround.html` (no account; no app top bar or menu):

| | Phone 390×844 before → after | Desktop 1024×900 before → after |
|---|---|---|
| Above the device | 351 → 192px | 390 → 307px |
| Below the device | 523 → 324px | 508 → 310px |
| Whole page | 1388 → 1031px (−26%) | 1421 → 1140px (−20%) |
| Whole device on first screen | no → yes | no → yes |
| Stray scrollbars | 1 → 0 | 1 → 0 |

On the live site the app's top bar and menu add about 245px above this, so on a
390×844 phone the device moves up by the same ~159px, but its bottom may still sit
just below the first screen there. To be measured live after release.

- `tidy-up-stability.mjs` at 320, 390 and 1024px: hovering all 8 icons never moved
  the device, counters, utilities or How to play. Five messages (saving,
  reconnecting, needs checking, cheer, purchase confirmed) were never clipped and
  never moved the device (after the ≤360px two-line reserve).
- `device-response-check.mjs` (real components, fake server): every scenario
  passed, including waiting care shown in the status line, cleared after the save,
  and a refusal restoring the real needs.
- `care-speed-check.mjs` (real components, fake server, 10s payment delay) passed
  at 390 and 1440px. Two queued care actions with nothing moving before, during or
  after; eating started in 89/76ms; second confirmation 48/53ms; final balance 27,
  no duplicate charge; the status line showed the waiting message during care.
- Frontend suite: 150/150 passed in 9.66s, including both handheld design guards
  unchanged. Lint exit 0. `git diff --check` clean.
- Production build exit 0, 1720 modules. JS 928.01kB / 274.90kB gzip; CSS 94.73kB /
  17.33kB gzip.
- Before and after full-page screenshots at 390px were inspected.

## Release

- Owner approved. Merged to `main` (fast-forward) and `codex/yumpals-only-release`
  at `911e33a`. Rollback tag `codex/yumpals-tidy-up-baseline-20261028` → `d8986ab`.
  Atomic push, and the remote IDs were verified.
- RELEASE VERIFIED — published with `npm run deploy` as `gh-pages` commit `c4bb5d0`,
  live after ~60s. Live `index.html` is byte-identical to the build; JS
  `index-BTUUwHM-.js` (MD5 `8433e555ca691767d008b4413fadca84`) and CSS
  `index-DIiztJ8z.css` (MD5 `be123254c15f02ab9596406fb2c384fe`) match locally.
- Live, signed in as the owner: the saved pal (Fizzgig, 26 donuts) loads on the new
  bundle. The notice now opens How to play, the queue and sync boxes are gone,
  Refresh pal is a link, there are no stray scrollbars and no sideways scroll, and
  no requests failed after load.
- Live phone layout, 390×844 including the app's top bar, menu and 73px bottom icon
  bar: device top 611 → 453px (−158px); YumPals page bottom 1646 → 1290px (−356px).
  Hovering all icons moved nothing. The whole device still does not fit the first
  screen in the real app: the visible area ends at 771px, and the device ends at
  966px. The pal's screen (524–832px) is mostly visible, including name, donuts and
  the pal down to 790px; its bottom icon row and the A/B/C buttons need a short
  scroll. Before, only about the top 90px of the screen was visible.
- Rollback: rebuild and publish `codex/yumpals-tidy-up-baseline-20261028`.
