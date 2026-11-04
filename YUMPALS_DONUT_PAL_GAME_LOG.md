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

## Release (owner: "Approved, deploy")

- Rollback tag `codex/donut-pal-game-fair-baseline-20261105` → `24fde51`. `main`
  fast-forwarded to `04e0483`. On `main`: frontend 237/237, server 218/218, both
  lints exit 0.
- Atomic push of `main`, `codex/yumpals-only-release` and the tag. Remote IDs
  verified: both branches at `04e0483`, and the tag at `24fde51`.
- The live site had been published from `main` `b6372a8` (`gh-pages` `5801d7f`).
  The only later commit was a log, and the stylesheet name was unchanged
  (`index-DBOHlzyJ.css`), so this publish adds only this fix.
- 1. SITE VERIFIED (first, so the app accepts `lastGameAt` before the server
  sends it). `npm run deploy` gave `gh-pages` `d56e215`, live after ~70s.
  Byte-identical to the build:
  - `index.html` (MD5 `6b4f3228c511851562b7619b793d655c`).
  - JS `index-BCdWUihB.js` (`e19d89484e715e246123e24ba92be2ad`).
  - CSS `index-DBOHlzyJ.css` (`0470cdeb3a784dd3d3e0dd9cd780a26c`).
- 2. SERVER VERIFIED — `deploy --only functions:teams:yumpalsGetPaidCareState,
  functions:teams:yumpalsPurchaseCare` (211.11 KB): "Successful update operation"
  for both. `functions:list` shows all 12 functions: the 10 from before plus
  `teamsManageLinks` and `yumpalsSuspendStudent`, from other sessions.
- Live as the owner, Thursday 8:49am (`index-BCdWUihB.js`):
  - The pal is now a teen, and it was sleepy from its 3 games earlier that morning
    under the old rule.
  - Lights gave "Lights off. Zzz" with the dark screen at 8:50am, a nap under the
    new 10-minute rule.
- LIVE CHECK VERIFIED, as the owner:
  - The nap ended by 9:01am, about 10 minutes, with "Good nap!": awake, no longer
    sleepy, and happy 3 → 4. Under the old 20-minute nap it would have lasted until
    about 9:10.
  - Three games in a row (15 guesses, every `yumpalsPurchaseCare` 200; the first
    3,969ms as the server started up, the rest about 0.9s).
  - The label showed "Nice game! +1 happy", then the next game's hint "A=left
    B=right C=stop". Happy stayed 4 (already full), and weight stayed 20 (a teen's
    minimum).
  - After 3 games Fizzgig was not sleepy; the old rule made it sleepy at 3. C stopped
    the game and returned to the room.
  - Seen in passing: taps sent while a guess's reply is still pending are ignored,
    as designed. Only taps during the reveal itself carry on to the next guess.
- Rollback:
  - Site: rebuild and publish `codex/donut-pal-game-fair-baseline-20261105`.
  - Server: redeploy the two functions from that tag. A `lastGameAt` already
    stored on a pal would then fail the older checks, so roll back the server
    before the site.
