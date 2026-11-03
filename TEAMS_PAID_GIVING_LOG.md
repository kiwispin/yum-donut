# Teams paid giving — 3 November 2026

Request: review the YumDonut Teams bot ("Does everything look right?"), then
"Yes, fix it" for the findings below.

Findings:

- Paid giving (2 November) made gifts in the web app cost the giver, but the Teams
  path in `functions/src/donutService.js` was never updated. Gifts from Teams still
  created new donuts, so any student could give 5 free donuts a day through Teams,
  and two students could trade them back and forth.
- When a recipient's balance was corrupted, the gift transaction used `return` after
  it had already queued writes. Firestore commits writes when the callback resolves,
  so the sender's counter, their `lifetime_given` and the earlier recipients'
  donuts were saved. The activity was not marked processed, so when Teams resent the
  message, the earlier recipients were paid again.

Branch: `codex/teams-paid-giving`, from `main` `ba578a3`.

## Changes / disposition

- ACCEPTED — `functions/src/giving.js`: CommonJS copies of the web app's
  `payForGift`, `getBankBalance` and `resolveBankBalance`, so a Teams gift costs
  exactly what the same gift costs in the app.
- ACCEPTED — `giveDonutsFromTeams` charges students: wallet first (public profile is
  the source of truth), then bank, in the same transaction as the gift. It writes
  the new balances to both profiles. Mr Rayner's gifts stay free and unlimited.
  New refusals: `NOT_ENOUGH`; `SENDER_BALANCE_CORRUPT` (a profile is missing or the
  balances conflict); and `SENDER_NO_ACCOUNT` (the mapping and public profile have
  no `uid`, so no wallet can be charged — the student must sign in once). The
  daily limit of 5 is unchanged.
- ACCEPTED — every recipient's balance is checked before any write, so a corrupted
  recipient refuses the whole gift and nothing is saved.
- ACCEPTED — `functions/src/replies.js`: Teams replies for the three new refusals.
- ACCEPTED — `functions/README.md` lists the charge.
- ACCEPTED — `functions/test/donutService.test.js`: 10 tests (the giving path had
  none). The tests cover: the wallet charge, the bank covering the rest, refusal
  when short with nothing written, the shared daily limit, free teacher gifts,
  refusal with no linked account, a corrupted sender, no partial write for a
  corrupted recipient followed by a single payout on resend, and a resent message
  charged once. 7 of them fail against the previous `donutService.js`.
- UNCHANGED — the parser, mapping, Teams manifest, web app, Firestore rules and
  giving cheer (it already reads the private-profile giving record this path writes).

## Checks

- `functions`: `npm test` 190 pass, 0 fail (10 new).
- Web: `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js` 230
  pass, 0 fail. `npx eslint .` clean (existing stale `baseline-browser-mapping`
  notice only).
- Not exercised: a real Teams message against the deployed function.

Note: another agent was working in the main checkout at the same time (branch
`codex/verified-seal`). This work was moved to its own worktree
(`yum-donut-teams-paid-giving`) and touches none of its files.
