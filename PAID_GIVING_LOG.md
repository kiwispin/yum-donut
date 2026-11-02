# Paid giving — 2 November 2026

Request: "I think I originally had it so they could give 5 donuts per day, let's make
that come out of their balance, if it doesn't already? If they don't have it in hand,
it comes out of their bank?"

Finding: it didn't. Each student had a free daily allowance of 5 to give, and every
gift created new donuts. The 1 November export shows 2,453 donuts given
student-to-student this way (2,331 gifts), 451 of them since 1 August.

Branch: `codex/paid-giving`, from `main` `2572333`.

## Changes / disposition

- ACCEPTED — a student's gift now costs them the donuts they give
  (`payForGift` in `src/giving.js`): out of the wallet first, and whatever the
  wallet can't cover out of the bank. Refused ("NOT_ENOUGH") when wallet and bank
  together are short. `handleGiveDonut` reads the wallet from the public profile
  (the source of truth) and the bank with `resolveBankBalance`, inside the same
  transaction as the gift, and writes the new balances to both profiles.
- ACCEPTED — the daily limit of 5 stays as a cap on giving.
- ACCEPTED — Mr Rayner's gifts stay free and unlimited.
- ACCEPTED — the Give screen: the mobile header reads "Left to give today" / "Gifts
  come out of your donuts" (was "Daily Balance" / "Use them or lose them!"); under
  the amount, "Comes out of your wallet first, then your bank. You have n 🍩." The
  amount buttons and Give button respect the smaller of the daily limit and the
  donuts held.
- ACCEPTED — `releaseScope.test.js` names `handleGiveDonut` as an approved change.
- UNCHANGED — recipients, `lifetime_given` / `lifetime_received`, the feed and the
  Muncher.
- NOT CHANGED — What's New.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 223 pass,
  0 fail (3 new). `npx eslint .`: clean.
- Browser, local dev server, read-only sandbox as "Alice" (no gift written): giving
  1 to Jacey shows "1 total for Jacey, 5 left today" and "Comes out of your wallet
  first, then your bank. You have 340 🍩."; the header reads "5 left to give". No
  console errors.
- Not exercised: a real gift, the wallet-then-bank split, or the refusal when short.
