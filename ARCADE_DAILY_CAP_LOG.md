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
