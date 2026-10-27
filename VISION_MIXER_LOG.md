# Vision Mixer arcade game — 27 October 2026

Request: add a simple, individual filming/production Arcade game. Vision Mixer: an
on-screen director calls "Ready Cam n…" then "TAKE n!" in the talkback box (text
only, no audio or real calls), and the player cuts to that camera before the take
window closes. Same daily reward model as the other Arcade games.

Baseline: `90714f0` (current `main`). No earlier Vision Mixer attempt exists in the
repository, logs or history, so nothing here repeats an attempted change.

## Changes / disposition

- ACCEPTED — `src/arcade/visionMixer.js`: pure rules and state machine. Four cameras
  (Presenter, Guest, Wide, Close-up). "Ready" lasts 600–1100ms base (±25% random so
  the take can't be timed by rhythm), shrinking with the streak. The take window
  starts at 2000ms and shrinks 80ms per clean take to a 900ms floor. A call never
  repeats the camera already on air. Early press, wrong camera or a missed take
  costs one of 3 lives. 15 clean takes win: 2 donuts with no mistakes, otherwise 1.
  Each timer carries its round, so a late timer from an earlier call is ignored.
- ACCEPTED — `src/arcade/VisionMixerModal.jsx`: game pop-up in the existing Arcade
  style (dark panel, red accent): programme monitor with ON AIR tally, talkback box
  (`role="status"`), draining take bar, 2×2 camera buttons with labels, keys 1–4 as
  a shortcut, Try again after a lost show, and the daily lock (profile field plus
  localStorage, wrapped in try/catch). No sound, as agreed.
- ACCEPTED — `src/App.jsx`: Arcade row "Vision Mixer" (🎛️) with the NEW badge,
  moved from Memory Match so one game is NEW at a time (as in `4343279`). The
  reward uses the existing `handleWinBonus` with its own daily field
  `last_vision_mixer_win` and the feed message "Won a … playing Vision Mixer!". No
  `handle*` handler changed.
- ACCEPTED — camera buttons have no colour transition. The first screenshot caught
  the 150ms `transition-colors` fade mid-way (old camera still red while the
  programme monitor showed the new one). A cut is instant, so the tally is too.
  State was verified correct before the change: the programme and tally matched
  on three consecutive cuts.
- ACCEPTED — `verification/vision-mixer.html` / `.jsx` (synthetic preview, no
  account or donuts) and `verification/vision-mixer-check.mjs` (plays real games
  in Chromium; `PLAYWRIGHT_MODULE` selects a local Playwright).
- ACCEPTED — `src/arcade/visionMixer.test.js`: 9 tests covering timing bounds,
  camera choice, judging, prizes, a full win, a full loss and stale timers, plus
  the Arcade's reward-field wiring.
- REFUSED — Tailwind classes on the preview page's win record. The first overflow
  failure at 390px came from that `<pre>` line (page 390px → 621px once the win was
  written), not the game. Tailwind only scans `src/`, so the classes were never
  generated. Widening the Tailwind scan was refused because it would change the
  production CSS. An inline style is used instead; the overflow assertion was not
  weakened.
- Not done: no What's New entry and no sound.

## Measured results

- Frontend suite (`src/*.test.js src/yumpals/*.test.js src/arcade/*.test.js`):
  133/133 passed in 9.09s. Lint exit 0 (existing stale `baseline-browser-mapping`
  warning only). `git diff --check` clean.
- `vision-mixer-check.mjs`: PASS. Perfect show at 390px: 15/15, `onWin` called once
  with 2 donuts, then DAILY LIMIT REACHED on reopening; tap-to-cut 34–63ms.
  Keyboard show at 1280px with one early press: 1 donut. 320×640: three missed
  takes end the show with no reward, all four cameras visible, Try again resets to
  0/15. No horizontal overflow, zero page errors, 62.3s.
- Screenshots inspected: mid-show at 390px (tally matches programme), win and
  OFF AIR screens.
- Production build exit 0, 1719 modules, 2.03s, with the `.env.production` YumPals
  flags. JS 923.66kB (+9.66kB) / 273.11kB gzip; CSS 94.13kB / 17.26kB gzip.

## Release

- Owner played the synthetic preview (one 1-donut preview win, recorded only on the
  `localhost` page, with no account, wallet or live daily-lock effect) and approved.
- Merged to `main` (fast-forward) and `codex/yumpals-only-release` at `7069e03`.
  Rollback tag `codex/vision-mixer-baseline-20261027` → `90714f0`. Atomic push, and
  the remote IDs were verified.
- RELEASE VERIFIED — published with `npm run deploy` as `gh-pages` commit `f82ec15`,
  live after ~45s. Live `index.html` is byte-identical to the build; JS
  `index-CGs9oN6D.js` (MD5 `9ff1829fc5f0ee47c4add6e34d0f40eb`) and CSS
  `index-DDcNWjYy.css` (MD5 `d6d015c47c13bf9f059a399ac8a1577f`) match locally.
- Real win, signed in as the owner on the live site with the owner's approval: the
  Arcade lists Vision Mixer second with NEW. A perfect show (15/15, 25s) gave
  "You won 2 Donuts! Added to wallet." with no failed requests during play. The feed
  shows "Won a Vision Mixer Perfect Show playing Vision Mixer!".
- Resolved the open risk: after removing the browser's local lock and reloading, the
  game still showed DAILY LIMIT REACHED, so the live rules accepted the new
  `last_vision_mixer_win` profile field.
- Rollback: rebuild and publish `codex/vision-mixer-baseline-20261027`.
