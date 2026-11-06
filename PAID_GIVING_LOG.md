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

## Release — 2 November 2026

The owner approved the release ("Release it").

- Frontend only: no function deploy and no Firestore rules change.
- Rollback: rebuild and publish `codex/paid-giving-baseline-20261102` (`2572333`,
  the production source before this release).
- RELEASE VERIFIED — source `a746bee` on `codex/paid-giving`, merged to `main` as
  `a4e44d1`, rollback tag pushed; remote IDs verified. Published with
  `npm run deploy` as `gh-pages` `708ed65`, live after ~80s. Byte-identical to the
  build:
  - `index.html` (MD5 `415f2754239a5a5622a264a470b43ec6`).
  - JS `index-D7t0-xzk.js` (`d9862d4086b9f7aa4ea4d00ebe260aa9`).
  - CSS `index-OpsmyNCt.css` (`eccb77a99785e1455dbfa54ab771f4fc`).
  The live bundle contains "Gifts come out of your donuts" and "Comes out of your
  wallet first". Not seen live signed in.

## What's New — 6 November 2026

A student asked whether givers lose donuts if nobody gives back. The owner asked to
explain the reason in What's New.

Branch: `codex/giving-whats-new`, from `main` `3dc00c7`.

- ACCEPTED — a first section, "Giving now means more": gifts come out of your
  wallet, then bank; each goes straight to a teammate, so the crew loses none;
  gifts used to create donuts from nothing, so there were far more donuts than
  things to buy; up to 5 a day still, and giving counts toward Leaderboard rank.
- ACCEPTED — the subtitle starts "Giving that means more"; "It doesn't cost any
  donuts" is removed from "Giving cheers up your pal", since gifts now do.
- Checks: 241 pass, 0 fail; lint clean. Local dev server: the panel opens with the
  new section first and no console errors.
