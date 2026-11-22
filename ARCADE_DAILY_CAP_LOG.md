# Arcade daily donut cap — 1 November 2026

Request: students earn far more donuts than they spend, and adding things to buy
has not helped ("they very rarely buy them"). After reviewing the live numbers the
owner chose to cap Arcade earnings.

Evidence (read-only export of the live transaction log, 23 Nov 2025 – 1 Nov 2026,
run by the owner): the Arcade paid 8,126 of about 11,800 donuts coming in (69%);
peer giving paid 2,453 (21%). Cable Commander alone (2,904) paid more than all peer
giving. Across 1,667 player-days since February the median player earned 5 Arcade
donuts a day (p90 8, max 15). Replaying those days, a shared cap would have cut
Arcade payouts by: 2/day 60%, 3/day 41%, 4/day 26%, 5/day 15%.

## Changes / disposition

- ACCEPTED — one shared allowance of 3 Arcade donuts per Auckland date
  (`src/arcade/arcadeCap.js`, `ARCADE_DAILY_CAP`). It covers every game paid
  through `handleWinBonus`: Claw Machine (including Box of Donuts and Golden
  Ticket), Typing Defence, The Daily Rushes, Cable Commander, Memory Match and
  Vision Mixer. Typing Dojo (Training) pays through its own handler and is not capped.
- ACCEPTED — `handleWinBonus` trims each prize to what is left of the allowance in
  the same transaction that pays it, and records `arcade_earned_today` and
  `arcade_earned_date` on the private profile beside the per-game cooldowns. A win
  past the allowance still uses that game's daily play, pays nothing, writes no feed
  entry, and says "Nice win! … just for glory". A partly paid prize says so.
- ACCEPTED — the Arcade header shows "Arcade donuts today: n of 3", then "Today's 3
  arcade donuts earned · games still count for glory".
- ACCEPTED — `releaseScope.test.js` names `handleWinBonus` as an approved change
  (it must call `capArcadePrize` and record `arcade_earned_today`).
- NOT CHANGED — in-game result screens (for example Typing Defence's "REWARD: n
  DONUT(S)") still show the uncapped prize; the notification gives the amount paid.
- NOT CHANGED — like the existing cooldowns, the count is client-written to the
  private profile, so it is not tamper-proof.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 203 pass,
  0 fail (4 new cap tests).
- `npx eslint .`: clean.
- Not checked in a browser: the Arcade needs a signed-in account, and the dev server
  writes to the live project.

## Claw prize screen shows the amount paid — 23 November 2026

Report: "Amelia just got a box of donuts but was only awarded 1." The record shows
her Box at 7:26:17 paid 3, the most the daily cap allows (Chloe's and Kate's Boxes
also paid 3). Her wallet probably read 1 from 7:32:14 to 7:35:25, after she banked 2
of the 3; that is worked back from her logged entries and current 9. The Claw's
result card named the prize with no amount, so the owner asked to show it.

Branch: `codex/claw-shows-paid`, from `main` `2bfaa20`.

- ACCEPTED — `handleWinBonus` returns what the win paid (`paid`, `jarFull`,
  `limited`), or null when it could not be saved. Payouts are unchanged.
- ACCEPTED — the Claw result card shows `arcadePayoutText` (`src/arcade/arcadeCap.js`):
  "Adding it up...", then "+n donut(s) added to your wallet", with "That's today's
  3-donut arcade limit." when trimmed; "Just for glory" with the reason when it pays
  nothing; "This prize couldn't be added" on failure.
- ACCEPTED — `releaseScope.test.js` names the Claw's `handlePlay` change and still
  pins the rest of that handler.
- NOT CHANGED — other games' result screens, and any student's balance.

Checks:

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 244 pass,
  0 fail (3 new). `npx eslint .`: clean.
- Local dev server: the capped Box card was displayed by setting the Claw's local
  state, with no GRAB and no write. It reads "You grabbed a Box of Donuts!", "+3
  donuts added to your wallet" and "That's today's 3-donut arcade limit." No console
  errors.
- Not exercised: a real Claw play from GRAB through a saved win.

Release — 23 November 2026. The owner approved it ("Release it").

- Frontend only: no function deploy and no Firestore rules change. Between the
  previous live build (`0071e81`) and this release's base, only logs and Teams bot
  function files changed, so this is the only website change.
- Rollback: rebuild and publish `codex/claw-shows-paid-baseline-20261123` (`2bfaa20`).
- RELEASE VERIFIED — source `7a72dbd` on `codex/claw-shows-paid`, merged to `main` as
  `ce70534`, rollback tag pushed; remote IDs verified. Published with `npm run deploy`
  as `gh-pages` `604b79d`, live after ~40s. Byte-identical to the build:
  - `index.html` (MD5 `e68e4501cffc9a32d1adccb697837af2`).
  - JS `index-DbKu9dTO.js` (`fc7c90c0220c03ff929e4ead3ce14479`).
  - CSS `index-BBcyT2o4.css` (`7c32359cb887e5dd29a091571a7ca6ec`).
  The live bundle contains the new prize wording. Not seen live signed in, and no
  real Claw play has run through it yet.
