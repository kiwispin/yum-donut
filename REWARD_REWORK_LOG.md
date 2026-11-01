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
- ACCEPTED — balances hidden from other students. Auctions had not worked ("they
  don't care"), which suggests a visible pile is itself the status students save for.
  The Leaderboard line "{n} donuts available" now shows only on the viewer's own row,
  as "You have {n} donuts available". It was the only place students could see each
  other's balances; the depositor ledger and user audit are teacher-only and
  unchanged. Display only: Firestore still lets any visitor read public profiles.
- REFUSED — an overflow cap sending donuts above 150 to the class goal. The owner
  judged it unfair: it would take donuts from some students.
- ACCEPTED instead — a full donut jar stops Arcade prizes (`ARCADE_HOLDING_CAP` 150
  in `src/arcade/arcadeCap.js`). While a student holds 150 or more (wallet plus bank,
  read from the public profile in the prize transaction) every Arcade win pays 0.
  Nothing held is taken; gifts, teacher gifts, bounties and Training are not limited;
  trophies don't count, so buying one makes room. A win below 150 pays its normal
  (daily-capped) prize even if it crosses 150. The win message and the Arcade header
  say the jar is full and to spend some. 11 of 41 students held 150+ on 1 November.
  `releaseScope.test.js` now requires `capArcadePrize(won, earnedToday, held)`.
- ACCEPTED — `releaseScope.test.js` names the removal of `handlePayInterest` as approved.
- ACCEPTED — the goal page says "🏆 Your donations count toward your Leaderboard
  rank." under the Give 1 / Give 5 buttons. It was already true (goal donations add
  to lifetime given, which ranks the Leaderboard) but never said. Shown only while
  the goal is open; not seen live yet because the goal stood at 500/500 when checked.
- NOT CHANGED — the bank ledger mismatch. 23 of 42 profiles' bank balances do not
  equal their logged deposits, withdrawals and interest. Most of the gap is interest
  logged only as class totals before September; several students hold large balances
  with no deposit ever logged, which the log cannot explain. No balance is rewritten.
- ACCEPTED — What's New (`PatchNotesModal`), using the owner-approved draft. Two
  sections go above the YumPals ones: "Trophy Cabinet" (`Trophy` icon) and "Arcade
  update" (`Gamepad2` icon), each with the approved paragraph. The subtitle "Your
  YumPal has moved into a Donut!" became "A new Trophy Cabinet, and your YumPal has
  moved into a Donut!". The YumPals and older sections are unchanged. When the jar
  cap was added, the Arcade paragraph gained "and pays nothing while you hold 150 or
  more" so it stays accurate.

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

## Release — 2 November 2026 (afternoon)

The Donut pal student release went out this morning (`main` `edb14cc`, site
`gh-pages` `cae4fa4`). The owner then approved this release ("Ready to roll this").

- `main` merged into `codex/reward-rework` cleanly (`cc3aad1`); this morning's
  changes touched only `.env.production`, the server environment file, a log and a
  launch image. `VITE_YUMPALS_POCKET=enabled` is kept.
- Frontend suite (`src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`):
  210/210. Functions suite: 180/180 (no server code changed). Lint clean.
  `git diff --check` clean. `npm run build`: JS `index-zax7v6nT.js` 983.42 kB /
  293.84 kB gzip, CSS `index-7ptzX6b7.css` 106.35 kB.
- Frontend only: no function deploy and no Firestore rules change.
- Rollback: rebuild and publish `codex/reward-rework-baseline-20261102` (`edb14cc`,
  the production source before this release). Trophies already bought stay on
  profiles as a harmless `trophies` field; arcade counters likewise.
- RELEASE VERIFIED — source `1378b5f` is on `main` and `codex/reward-rework`, with
  the rollback tag `codex/reward-rework-baseline-20261102` (`edb14cc`) pushed; remote
  IDs verified. Published with `npm run deploy` as `gh-pages` `13f96ea`, live after
  ~50s. Byte-identical to the build:
  - `index.html` (MD5 `bf430884afcbea18c4de064104a5c5c2`).
  - JS `index-zax7v6nT.js` (`40d5c1e04fabb74e2c81010f645d2e0b`).
  - CSS `index-7ptzX6b7.css` (`062d078b5deee2eaa17eadb46ce414f9`).
- Live, signed out (no sign-in attempted): the page loads `index-zax7v6nT.js`; What's
  New shows "A new Trophy Cabinet, and your YumPal has moved into a Donut!", then
  "Trophy Cabinet" and "Arcade update" (with the 150 rule), then the Donut pal
  entries. No console errors. The live bundle contains the Trophy Cabinet, the
  full-jar message and the goal-rank line.
- Not yet seen live signed in: the Bank, Arcade, Leaderboard and goal pages. The
  owner's own price changes (snacks 5→8 and 9→14, raffle 2→4–5) are Admin Settings
  edits, not part of this release.
- Next: rerun the read-only export in about two weeks and compare spending, goal
  progress and trophy sales against the 1 November figures. Then "one more go"
  arcade replays with weekly high scores, as its own release.
