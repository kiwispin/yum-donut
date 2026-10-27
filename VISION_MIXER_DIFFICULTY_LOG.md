# Vision Mixer difficulty — 27 October 2026

Request: the released Vision Mixer was too easy for this class ("I don't just want
to give donuts away"). Make it keep getting faster, and have the director sometimes
change their mind so players can't settle into a routine.

Baseline: `ffe3ac5` (live release, see `VISION_MIXER_LOG.md`). Earlier refusals are
not repeated: no colour transition on camera buttons, no widening of the Tailwind
scan, no sound.

## Changes / disposition

- ACCEPTED — faster ramp (`visionMixer.js`). Take window 2000→900ms (−80ms per
  take) became 1500→500ms (−55ms per take, floor reached at take 19). Ready base
  1100→600ms became 1000→400ms (still ±25% random). Gap between calls 650→550ms.
- ACCEPTED — show length 15 → 20 clean takes. Prize unchanged: 1 donut, or 2 with
  no lives lost.
- ACCEPTED — stages (shown as "Stage n" during play). Stage 1, takes 0–4: numbered
  "TAKE n!" as a warm-up. Stage 2, takes 5–9: TAKE has no number, and 40% of calls
  are a change of mind ("Ready Cam 3…" then "No, Ready Cam 1!"). The decoy is never
  the real camera or the one on air, so cutting to it is a wrong cut. Stage 3,
  takes 10+: also 25% of calls end in "HOLD!" (blue, with a blue timer bar lasting
  at least as long as a take). Not cutting gives "Good hold." and is not a take;
  cutting gives "You cut on a hold!", costs a life and goes to air. TAKE losing its
  number is required for the change of mind to matter; otherwise players could
  ignore Ready and just read the TAKE.
- ACCEPTED — the owner's mid-task suggestion (the director changing their mind to
  break routines) was already part of this plan and is implemented as above.
  Stage 1 stays without changes of mind as a warm-up.
- ACCEPTED — start-screen rules rewritten to explain the stages. They fit at
  320×640 (Start button bottom 551px).
- ACCEPTED — header padding (`px-8`). At 320px the title ran under the close
  button; afterwards the title's right edge is at 244px against the button at 252px.
  It wraps to two lines at 320px and stays on one line at 390px.
- ACCEPTED — unit tests rewritten for the new rules: 13 tests, adding stages,
  change of mind, holds and the 20-take win.
- REFUSED (test errors, game code unchanged) — two first-run test expectations were
  wrong: `readyMs(0, 0.999)` rounds to 1250, not 1249, and a fake random sequence
  fed 1.0, which `Math.random` never returns. The tests were corrected.
- ACCEPTED — `verification/vision-mixer-check.mjs` now plays like a listening
  player: it remembers the last Ready camera, follows changes of mind, cuts on
  numbered or unnumbered TAKE, and does nothing on HOLD. It records the take-window
  durations and adds a decoy-cut case.

## Measured results

- Frontend suite (`src/*.test.js src/yumpals/*.test.js src/arcade/*.test.js`):
  137/137 passed in 9.69s. Lint exit 0 (existing stale `baseline-browser-mapping`
  warning only). `git diff --check` clean.
- `vision-mixer-check.mjs` (final code): PASS. Perfect show at 390px: 20/20 in 42s,
  15 unnumbered TAKEs, 4 changes of mind, 7 holds held, take window 1500→500ms,
  `onWin` once with 2 donuts, then the daily lock. Keyboard show with one early
  press: 1 donut (4 changes of mind, 5 holds). Cutting to the decoy after a change
  of mind gives "Wrong camera!". Three misses end the show with no reward, and Try
  again resets to 0/20. Zero page errors, 104.9s.
- Screenshots inspected: "No, Ready Cam 4!" at Stage 2, "HOLD!" with the blue bar at
  Stage 3, and the start screen at 320×640.
- Production build exit 0, 1719 modules, 2.00s. JS 924.92kB (+1.26kB) / 273.57kB
  gzip; CSS 94.30kB / 17.28kB gzip.
- Not released: on branch `codex/vision-mixer` for the owner to play first. `main`
  and the live site still serve the previous version.
