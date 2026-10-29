# YumPals Donut pal — retry fix (server) — 29 October 2026

Found in the Release 2 live check (`YUMPALS_DONUT_PAL_APP_LOG.md`).

## Finding

- The owner reported that the pal had become an egg and hatched. When I checked,
  the browser-pane tab was still running the old script (`index-DTBnI_tO.js`) and
  showed the current handheld.
- After reloading that tab on the new script (`index-DUJnJVjF.js`) and opening
  YumPals at about 10:13pm Auckland, the first Donut pal read returned **503** and
  the handheld showed "Your pal could not be reached. Please try again."
- The current app's two background reads at the same moment returned 200.
- The function logs show no error text: the endpoint maps unexpected errors to
  `UNAVAILABLE` without logging them.

## Cause (reproduced)

- Opening YumPals sends the current app's background read (old path, which writes
  `paidCare`) and the Donut pal read (which writes `pocket`) at the same time,
  both writing the same pal record.
- Firestore retries one of the two transactions and reuses the same Transaction
  object for the retry.
- The live wallet adapter allows one read per Transaction object, so the retry
  failed with `WALLET_ALREADY_READ`, an unexpected code, which became 503.
- `paidCareService.js` already wraps each attempt in a fresh object for exactly
  this reason. My `pocketService.js` called `db.runTransaction` directly.
- The test fixture's fake database hands out a new object on every attempt, which
  is why my Release 1 tests missed it.
- A failed transaction writes nothing, so no pal data was changed by the failure.

## Changes / disposition

- ACCEPTED — `functions/src/yumpals/pocketService.js`: both `getState` and `act`
  run through the same per-attempt wrapper as `paidCareService.js`.
- ACCEPTED — `functions/test/pocketService.test.js`: a new test reuses one
  transaction object across attempts (as live Firestore does), forces one
  contention retry, and uses a wallet adapter that refuses a second read on the
  same object.
  - Before the fix it failed with `UNAVAILABLE`, exactly as live.
  - After the fix it passes.
- Checked and left as is: the current handheld's requests about every 2 seconds in
  the logs come from its existing refresh on window focus, as the browser pane
  gains and loses focus. That is existing behaviour, not new.

## Measured results

- Server suite 180/180 (179 + 1), server lint exit 0. Frontend 195/195, lint
  exit 0, `git diff --check` clean.

## Release

- Not deployed yet. Shown to the owner first.
- Deploy updates only the same two existing endpoints:
  `npx --yes firebase-tools@15.34.1 deploy --only functions:teams:yumpalsGetPaidCareState,functions:teams:yumpalsPurchaseCare --project yum-donut-school --non-interactive`
- No site change is needed: the app already handles the retry correctly once the
  server stops failing.
