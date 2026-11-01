# Reward rework: trophies and no bank interest — 1 November 2026

Request: rework the donut rewards so students spend more of what they earn, to be
released after the YumPals update on 2 November 2026. The owner chose the Arcade
daily cap (see `ARCADE_DAILY_CAP_LOG.md`), donut trophies, and bank changes, then
decided to switch bank interest off ("I haven't paid it out in ages, and noone has
asked").

Branch: `codex/reward-rework`, stacked on `codex/yumpals-donut-pal-students` at
`e2d0c36`, so it releases after the YumPals update.

Evidence (read-only export of the live data, 1 November 2026): students hold 3,847
donuts, 3,112 (81%) of them in the bank; the top 10 hold 69%. 24 students hold at
least 25, 13 at least 100, 5 at least 250. Bank interest paid about 1,363 donuts
in 12 payouts, the last on 26 September 2026; until then payouts were logged only
as a class total, not per student.

## Changes / disposition

- ACCEPTED — bank interest switched off. `handlePayInterest`, the Bank Manager
  "Pay Interest" button and payout total, the "Projected Interest" panel and
  `BANK_INTEREST_RATE` are removed. Deposits, withdrawals, balances, the depositor
  ledger and Total Deposits are unchanged. The Bank tagline "Earn interest." became
  "Save up for a trophy."
- ACCEPTED — donut trophies (`src/trophies.js`). Four permanent tiers: 🏅 Medal 25,
  🏆 Trophy 75, 💎 Diamond Donut 200, 👑 Crown 500. A Trophy Cabinet card on the Bank
  page sells them, paid from the wallet or straight from the bank by the student's
  choice, after a confirm that says trophies can't be turned back into donuts. A
  source that can't cover the cost is refused, never topped up from the other.
- ACCEPTED — `handleBakeTrophy` pays in one transaction: reads both profiles, takes
  the wallet from the public profile (as Arcade prizes do) and requires the two bank
  copies to agree (`resolveBankBalance`), writes wallet and bank to both, adds one to
  `trophies.<tier>` on the public profile, and logs "Added a … to their trophy
  cabinet!" to "The Trophy Cabinet". Sandbox only simulates.
- ACCEPTED — trophies show beside the student's name on the Leaderboard and at the
  top of the Trophy Cabinet, best first, with ×n for repeats. Leaderboard order is
  unchanged (lifetime given).
- ACCEPTED — the student audit counts "The Trophy Cabinet" as spent, like "The Shop".
- ACCEPTED — `releaseScope.test.js` names the removal of `handlePayInterest` as approved.
- NOT CHANGED — the bank ledger mismatch. 23 of 42 profiles' bank balances do not
  equal their logged deposits, withdrawals and interest. Most of the gap is interest
  logged only as class totals before September; several students hold large balances
  with no deposit ever logged, which the log cannot explain. No balance is rewritten.
- ACCEPTED — What's New (`PatchNotesModal`), using the owner-approved draft. Two
  sections go above the YumPals ones: "Trophy Cabinet" (`Trophy` icon) and "Arcade
  update" (`Gamepad2` icon), each with the approved paragraph. The subtitle "Your
  YumPal has moved into a Donut!" became "A new Trophy Cabinet, and your YumPal has
  moved into a Donut!". The YumPals and older sections are unchanged.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 208 pass,
  0 fail (5 new trophy tests).
- `npx eslint .`: clean. `git diff --check`: clean. Production build compiles
  (existing large-chunk warning only).
- Browser, local dev server, teacher account already signed in, view only (nothing
  bought, paid or written): What's New shows the two new sections first under the
  new subtitle. The Bank page shows no interest panel and the Trophy Cabinet with
  four tiers. With 18 in the wallet and 49 in the bank only "Medal: Bank" is enabled.
  At 375px wide the tiers sit two to a row with no sideways scroll. The Arcade header
  reads "Arcade donuts today: 0 of 3". No console errors.
- Not exercised: actually buying a trophy or winning past the cap, which would
  write to the live project. The Leaderboard shelf has no trophies to show until one
  is bought.
