# YumPals Donut pal — fairer game and sleepy rules — 5 November 2026

Owner: "Why when I play a game, does it go straight to Sleepy! Lights off?" Then:
"even just playing a game could generate some happiness?" Agreed fix, approved
with "Yes, include it".

Baseline: `24fde51` (`main`, live). It includes other sessions' work since the
student release, among them a student-break feature that also changed
`pocketService.js`, `appConnection.js` and `paidCareCallables.js`. That session
already deployed those changes to the same two YumPals endpoints, so live matches
`main` and this change is the only addition. Branch
`codex/yumpals-donut-pal-game-fair`.

## Cause

- My own invented rule (not from the manual): after 3 finished games the pal got
  sleepy. Play then refused with "Sleepy! Lights off?" until a 20-minute nap or the
  next morning.
- Games start the next round by themselves, so 3 games pass in a minute or two.
- The count only reset on a nap or the next morning. Games spread through the day
  (before school, lunch, afternoon) added up too.
- The third game's result was replaced by "Sleepy! Lights off?", so it looked as if
  the game went straight to sleepy.
- A lost game (fewer than 3 of 5) gave no happiness at all.

## Changes / disposition

- ACCEPTED — the shared rules (`src/yumpals/donutPal.js`, regenerated into
  `functions/src/yumpals/donutPal.js`):
  - Every finished game gives +1 happy (`GAME_PLAY_HAPPY`); a win of 3 or more of
    5 gives +2 (`GAME_WIN_HAPPY`), never above full. Each game still burns 1 weight.
  - Sleepy after 5 games (`GAMES_BEFORE_SLEEPY`, was 3), counted only while each
    game is within 15 minutes of the last (`GAME_STREAK_MS`). A new
    `lastGameAt` time on the pal starts a new streak after a gap. Older pals without
    it start a new streak.
  - The nap is 10 minutes (`NAP_MS`, was 20). Other care still works while sleepy.
- ACCEPTED — `src/yumpals/donutUi.js`:
  - The last game's result always shows first ("You won! +2 happy" / "Nice game! +1
    happy").
  - If the next game can't start, the label then shows why ("Sleepy! Lights
    off?").
- ACCEPTED — `donutPalArt.js`: the "Nice game" animation is now cheerful (a happy
  face and a heart) instead of sad.
- ACCEPTED — `DonutDevice.jsx` How to play, step 3: "Every game cheers it up, and
  winning 3 of 5 cheers it up more… Lots of games close together make it sleepy."
- ACCEPTED — both strict checks accept the new optional field:
  - The app's reply check (`pocketClient.js`, `OPTIONAL_PAL_KEYS`).
  - The server's stored-pal check (`pocketService.js` `validPal`).

  Release order: the site first, so the app accepts `lastGameAt` before the server
  sends it. The live app rejects unknown fields, so after a game the server's reply
  would otherwise fail its checks.
- FOUND AND FIXED (while testing) — right after an egg hatched, the next awake
  minute was treated as "the morning", because the pal had no wake-up date yet.
  That reset the game streak, so a new pal needed one extra game before sleepy.
  Hatching in the daytime now records today as the pal's morning (`wakeDate`).
  Hatching at night leaves it unset, so no empty value is ever stored, which
  Firestore would refuse.
- REFUSED (test mistakes, fixed) — my new sleepy test fed a pal that was already
  full. The two old tests for the 3-game rule were rewritten for the new rules.

## Measured results

- New and rewritten tests:
  - `donutPal.test.js`: play +1 / win +2 / never above full; 5 close games → sleepy
    and a 10-minute nap fixes it; care still works while sleepy; 8 spread-out
    games never sleepy; an older pal starts a new streak; hatching counts as the
    morning.
  - `donutUi.test.js`: the result first, then "Sleepy! Lights off?".
  - `functions/test/pocketService.test.js`: 3 of 5 wins → happy 1 → 3, with
    `lastGameAt` kept.
- Frontend 237/237, server 218/218, both lints exit 0, `git diff --check` clean.
- `caption-sizes-check.mjs` 12/12. `donut-saved-check.mjs` 14/14 ("You won! +2
  happy"). `donut-pal-check.mjs` 28/28 ("Nice game! +1 happy"; the next game still
  starts by itself; C stops it).

## Release (each deploy shown to the owner first)

1. Site: tag the rollback point, merge to `main`, run the tests, push, then
   `npm run deploy`.
2. Server: deploy only `yumpalsGetPaidCareState` and `yumpalsPurchaseCare`.
