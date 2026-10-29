# YumPals Donut pal — Release 2 (app, teacher only) — 29 October 2026

Owner request: "Build Release 2: the donut handheld on the real server for my
teacher account only, with a new log, and show me before the deploy."

Baseline: `29e2ba7` (`main`, live: Release 1 server plus its log). Branch
`codex/yumpals-donut-pal-app`. Server unchanged in this release.

## What changes for whom

- **The teacher account** (the server's `yumpalsAdmin` claim, read from the
  sign-in) sees the Donut pal on the YumPals page in place of the current saved
  handheld. The page shows the pal's name, the donut handheld, one caption line and
  How to play.
- **Students** see no change: the current handheld and its code are untouched. The
  server would refuse their pocket requests anyway (`YUMPALS_POCKET_READY=false`).
- **Build switch:** `VITE_YUMPALS_POCKET=teacher` in `.env.production`.
  - `teacher`: only the teacher sees it.
  - `enabled`: everyone sees it (Release 3).
  - Anything else: no one.
  - Never in sandbox mode (`src/yumpals/donutRollout.js`).

## Design

- **One set of controls for the preview and the real handheld.**
  - `src/yumpals/donutUi.js` is a pure reducer for A/B/C on every screen, the
    5-round game flow and animations.
  - A care action or a game guess becomes one *intent* with its own operation ID,
    which the host carries out: the preview with the local rules, the real handheld
    on the server.
  - Refusals the rules can predict (full, asleep, no donuts, sick) are shown at
    once and send nothing.
  - `useDonutUi.js` runs it, performing each intent exactly once even though React
    strict mode runs effects twice in development.
  - `DonutDevice.jsx` is the case, screen, icons, buttons, keyboard, hold C + A for
    sound, and beeps.
  - `YumPalsDonutPreview.jsx` now uses these, with unchanged behaviour (preview
    playthrough 28/28).
- **The real handheld** (`YumPalsDonutSaved.jsx`).
  - It reads the pal on opening, every minute while visible, and on focus.
  - Between reads it runs the same rules on server time (the clock offset comes
    from each reply), so the pal moves, hatches and falls asleep on time.
  - Each press is a pocket request. The server's reply view replaces the local pal.
  - Hatching, growing up and gifts queue and play one after another.
  - Growth since the last visit is noticed by comparing the stage with the last
    stage seen on this device.
  - The visit is recorded for the gift-waiting dot.
  - Sound on or off is remembered per student on the device.
  - With no pal, a simple adoption form (name, kind, glaze, colour) costs 5 donuts.
  - A failed first load shows "Try again"; a dropped action shows "Your pal could not
    be reached".
- **Strict client** (`src/yumpals/pocketClient.js`).
  - Only `{ pocket: 1 }` requests are sent, on the same two endpoints.
  - Every reply is checked exactly before it is shown (view, pal state, game,
    gifts, outcomes, wallet arithmetic).
  - Server reasons such as `POCKET_NOT_READY` are passed through.
  - The current app's transports are not touched.

## Changes / disposition

- ACCEPTED — new `donutUi.js`, `useDonutUi.js`, `DonutDevice.jsx`,
  `YumPalsDonutSaved.jsx`, `pocketClient.js` and `donutRollout.js`.
  `YumPalsDonutPreview.jsx` is rebuilt on the shared parts. `donutPal.css` adds
  styles for loading, errors and adoption.
- ACCEPTED — `App.jsx`:
  - The pocket transport.
  - The teacher-claim read (`getIdTokenResult`, re-checked on user change).
  - The YumPals page renders `YumPalsDonutSaved` when `donutPalShown`, otherwise
    the unchanged `YumPalsSavedHandheld`.
- ACCEPTED — `.env.production`: `VITE_YUMPALS_POCKET=teacher`.
- ACCEPTED — tests and checks:
  - `src/yumpals/pocketEndToEnd.test.js` (4): the real server code behind a fake
    network, with the real app client in front.
  - `src/yumpals/donutUi.test.js` (6).
  - `verification/donut-saved.html`, `.jsx` and `-check.mjs`: the real handheld
    against an in-page stand-in server whose replies pass the same client checks.
- REFUSED (lint, fixed) — the first draft wrote refs during render, which the
  React 19 lint rules forbid, and exported constants from component files. The
  latest values now go into refs in layout effects, the time for drawing is passed
  in, and `GLAZES` and `EVENT_TEXT` moved to `donutUi.js`.
- REFUSED (UX, fixed) — the daily gift from a read could cut off the hatching
  animation. Moments now queue and play in turn.
- REFUSED (my error, fixed) — my edit scripts wrote Windows line endings into
  `App.jsx` and other files. A guard test (`releaseScope.test.js`, exact handler
  source) caught it. All touched files are back to LF, as `.gitattributes` requires.
- REFUSED (test-script errors, not code):
  - The first browser run happened at night in Auckland, so the pal was correctly
    asleep. The check now runs on a fixed school morning with Playwright's clock,
    for both the page and the stand-in server.
  - "06:01" means 6 minutes in Playwright, so it is now "06:01:00".
  - One check passed trivially and was tightened: feed until full, and the refused
    press must send 0 requests.
  - The dropped-connection check now uses a press that really sends.

## Measured results

- Frontend suite 195/195 (185 + 10 new). Lint exit 0. Server suite 179/179 and
  server lint unchanged. `git diff --check` clean.
- `pocketEndToEnd.test.js`:
  - The move to an egg, hatching, the visit gift, a free meal, a 1-donut treat
    (30 → 29), a 5-round game (3 wins) and 5-donut adoption (9 → 4) all pass the
    app's checks against the real server code.
  - A student without the teacher claim gets `POCKET_NOT_READY`.
  - Tampered replies (extra key, wrong owner, 7 hearts, two-heart daily gift) are
    rejected.
  - Only pocket requests were sent.
- `donut-saved-check.mjs` 14/14, on a school morning at 390px:
  - The moved pal loads as an egg named Niblet, hatches after 5 minutes with "Your
    egg hatched!", then the visit gift plays.
  - The free meal reaches the server with the wallet unchanged.
  - The treat takes 1 donut; feeding until full, the refused press sends 0
    requests.
  - A 5-round server game ends with a result and carries on.
  - A dropped connection is explained.
  - Phone layout: no sideways scroll, buttons 43px.
  - Adoption is disabled until named, then gives an egg and takes 5 donuts.
  - A failed first load offers Try again, which loads the pal.
  - Zero page errors.
- Preview playthrough (`donut-pal-check.mjs`) still 28/28 after the split.
- The full app loads on the dev server (signed out) with 0 page errors. I did not
  sign in on localhost, because the dev app uses the live database.
- Build exit 0, 1732 modules.
  - JS 975.43kB / 291.19kB gzip (was 933.89 / 276.87: the Donut pal is now part of
    the app).
  - CSS 101.49kB / 18.74kB gzip (was 96.07 / 17.45).
- The owner's live sign-in carries the teacher claim (`yumpalsAdmin: true`, read
  locally in the browser pane; only that yes/no was read).

## Release

- Owner approved the deploy (shown first).
- Rollback tag `codex/donut-pal-app-baseline-20261029` → `29e2ba7`.
- `main` fast-forwarded to `6eeaa2f`. On `main`: frontend 195/195, server 179/179,
  both lints exit 0.
- Atomic push of `main`, `codex/yumpals-only-release` and the tag. Remote IDs
  verified: both branches at `6eeaa2f`, and the tag at `29e2ba7` (`ls-remote`).
- PUBLISHED — `npm run deploy` gave `gh-pages` commit `90a959f`, live after ~40s.
  Live `index.html` (MD5 `5e4410a2d64ff4adde08dbb245df4510`), JS
  `index-DUJnJVjF.js` (MD5 `0ed4f6d049cd1fdd6020a7066b675ced`) and CSS
  `index-_syYZOv-.css` (MD5 `f843178879bc578ccba70674cdd48528`) are byte-identical
  to the build.
- LIVE CHECK FOUND A SERVER FAULT:
  - On a fresh load of the new script, the first Donut pal read returned 503
    because a contended Firestore retry reused its transaction object.
  - Fixed on the server; see `YUMPALS_DONUT_PAL_RETRY_FIX_LOG.md`.
  - The site itself needed no change.
  - The live check is repeated after that fix is deployed.
- RELEASE VERIFIED after the fix (`1b5ad94`, see the fix log):
  - The owner's pal shows on the donut handheld (Fizzgig, a baby, asleep at
    night), moved and hatched.
  - Reads and a free action (Lights) both work live.
  - Students still get the current handheld: the teacher-only build switch, and
    `YUMPALS_POCKET_READY=false` on the server.
- Still to check in daytime (from 7am): feeding, the game and, optionally, one
  1-donut treat.
- Plan:
  1. Tag `main` (`29e2ba7`) as the rollback point.
  2. Merge this branch into `main`.
  3. Run all tests.
  4. Atomic push of `main`, `codex/yumpals-only-release` and the tag.
  5. `npm run deploy -- -m "..."`.
  6. Check that the live files match the build.
- Live check: the owner opens YumPals and their pal moves to an egg. This is the
  first live use of the pocket path, and the move is one-way for the pocket data;
  the old `paidCare` data stays as the rollback. Then it hatches about 5 minutes
  later: feed, play, and optionally buy one treat (1 real donut).
- Rollback: rebuild and publish the baseline tag. The teacher goes back to the
  current handheld with the old data intact.
