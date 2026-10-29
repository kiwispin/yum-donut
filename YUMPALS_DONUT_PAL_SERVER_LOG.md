# YumPals Donut pal — Release 1 (server) — 29 October 2026

Owner approved the server plan with my recommendations:

- Existing pals start as an egg.
- New eggs cost 5 donuts.
- A teacher-only stage comes first.
- The two existing endpoints are reused.

Release 1 is the server only. The current app never sends the new requests, so
students see no change.

Baseline: `df439c8` (`main`, live). Branch `codex/yumpals-donut-pal-server`, built
on the preview branch `codex/yumpals-donut-pal` (`5874bfb`, see
`YUMPALS_DONUT_PAL_LOG.md`).

## Design

- **One set of rules.**
  - `functions/src/yumpals/donutPal.js` is generated from the app's
    `src/yumpals/donutPal.js` by `npm run sync:donut-pal`
    (`scripts/sync-donut-pal.mjs`: ES module → CommonJS).
  - `src/yumpals/donutPalSync.test.js` fails if the server copy differs from a fresh
    conversion, or exports anything different. The server always decides.
- **Reused endpoints.**
  - `yumpalsGetPaidCareState` and `yumpalsPurchaseCare` pass requests marked
    `{ pocket: 1 }` to the new `pocketService.js` (`paidCareCallables.js` routing).
  - Every other request runs the unchanged paid-care code. The current app sends
    `{}` or paid-care purchases, which never match.
  - No new functions are created, so the personal account's Editor role is enough
    (making a new function callable usually needs more).
- **Teacher only.** Pocket requests are refused with `POCKET_NOT_READY` unless the
  account has the teacher claim (`yumpalsAdmin`) or the new parameter
  `YUMPALS_POCKET_READY` is true. It is set to `false` in
  `functions/.env.yum-donut-school`. Release 3 switches it on.
- **Data.**
  - New `pocket` data sits on each pal record: the rules state (stage, adult type,
    hearts, weight, messes, sickness and doses, naps and lights, treats today, care
    days, care mistakes, timers), any game in progress, and the visit and cheer
    dates.
  - Name and species always come from the record itself.
  - The old `paidCare` data is never read for care or changed, so it remains a
    rollback. Other fields on the record are kept as they are.
- **Records.**
  - `pocketActs/{operationId}`: every action, including refusals, for retries.
  - `migrations/{uid}_pocket`: the move.
  - `visits/pocket-{date}` and `cheers/pocket-{date}`: gifts. These are separate
    from the old gift records so the two never overwrite each other.

## Rules on the server (as approved)

- **The move:** on a pal's first pocket read (or first action), it becomes an egg
  that hatches about 5 minutes later. It keeps its name, species, glaze (`casing`)
  and colour, with a move record (amount 0). Only once.
- **Free care:** Meal, Clean, Medicine and Lights never touch the wallet.
- **Treat:** costs exactly 1 donut, taken from the wallet in the same transaction as
  its receipt (`category: 'pet_spend'`, wallet before and after). It's refused,
  with no charge, when the wallet is short, along with the other rule refusals.
- **Game:** 5 rounds. The server picks the direction for every round with
  `crypto.randomInt` and records it. The score is applied after round 5 (3 wins
  gives +1 happy). Rounds must follow in order. A refused start (sick, sleepy,
  asleep, egg) leaves no game running.
- **Adoption:** 5 donuts for a new egg. The record also gets the old-style
  `paidCare`, so the current handheld still works after a rollback.
- **Time:** minute by minute on Auckland time, from the shared rules. Calendar
  holidays, absences, pauses (YumPals switched off) and Holiday Mode periods freeze
  the pal completely. When YumPals is switched off, actions are refused with
  `paused`. Weekends count.
- **Gifts:** free, once a day, paused with the pal, and not for an egg.
  - Daily visit: +1 to the lower of food and happy.
  - Welcome back after 7+ days: +1 food and +1 happy.
  - Giving cheer: +1 happy on school days.
- **Safety:**
  - Strict request shapes.
  - Every read before any write.
  - Retries return the original outcome; reusing an ID for a different action gives
    `OPERATION_CONFLICT`.
  - Broken pocket data fails closed with `CORRUPT_POCKET`.

## Changes / disposition

- ACCEPTED — `src/yumpals/donutPal.js` (shared rules), three changes needed for the
  server:
  - `advance` and `act` take `isFrozen(ms)`, so rest minutes pass with no change.
  - Morning is the first awake minute of each Auckland day (`wakeDate`), so growing
    up is not skipped when a holiday spans 7am.
  - A nap ends whenever its time has passed (`napUntil` cleared), so a nap that
    ends during rest still gives its happy heart.

  The preview behaves the same: its 17 tests pass unchanged.
- ACCEPTED — new `scripts/sync-donut-pal.mjs`, `npm run sync:donut-pal`, the
  generated `functions/src/yumpals/donutPal.js`, `src/yumpals/donutPalSync.test.js`,
  `functions/src/yumpals/pocketService.js` and `functions/test/pocketService.test.js`.
- ACCEPTED — `paidCareCallables.js` (routing, new reason codes),
  `appConnection.js` (`pocketAct` and `pocketMove` refs, `pocketReady`),
  `index.js` (`YUMPALS_POCKET_READY`, default false) and
  `functions/.env.yum-donut-school` (`YUMPALS_POCKET_READY=false`, so a
  non-interactive deploy is never asked for it).
- REFUSED (my bug, fixed before testing) — the first draft could save a move record
  without moving the pal, when an adoption was refused or YumPals was switched off.
  Now the move is recorded only when the pal is saved with its pocket data.
- REFUSED (lint) — a destructuring helper left two unused names. Rewritten.
- CHECK — the tests were broken on purpose to prove they catch real faults:
  - With the teacher-only gate removed, 1 test failed.
  - With rest-day freezing removed, 1 test failed.

  Both were restored: the gate line and `npm run sync:donut-pal` were re-checked,
  and 14/14 pass again.

## Measured results

- `functions/test/pocketService.test.js` 14/14:
  - The current app's requests are unchanged.
  - Teacher only until the parameter is switched on.
  - The move keeps name, species, glaze, colour and other fields. `paidCare` is
    byte-identical. It moves only once, and the current handheld still loads a
    moved pal.
  - Hatching with empty hearts, then the first visit gift.
  - Free care with the wallet untouched; refusals recorded.
  - Retries and ID conflicts.
  - The treat takes exactly 1 donut (30 → 29), with a receipt; no donuts, no treat.
  - The fair game (server-chosen turns, 3/5 wins → +1 happy, round order, refused
    while sick).
  - Adoption for 5 donuts (7 → 2), with rollback `paidCare`; refused when already
    adopted or short of donuts; invalid adoption rejected.
  - Holidays freeze the pal (food stays 4/4, no mess); switched off is `paused`.
  - Giving cheer once a day; welcome back after 8 days; broken data fails closed.
  - A 14-day catch-up in under a second.
- Server suite 179/179 (165 + 14), server lint exit 0. Frontend suite 185/185
  (184 + sync test), lint exit 0, `git diff --check` clean.
- Two-week catch-up with the shared rules: 7.6ms on average (5 runs).
- `functions/index.js` loads locally with the same 14 exports as before, so no
  function is created or removed.

## Release

- Owner approved the deploy (shown first).
- Rollback tag `codex/donut-pal-server-baseline-20261029` → `df439c8`.
- `main` fast-forwarded to `1d1aaf4`. On `main`: frontend 185/185, server 179/179,
  both lints exit 0.
- Atomic push of `main`, `codex/yumpals-only-release` and the tag. Remote IDs
  verified: both branches at `1d1aaf4`, and the tag at `df439c8` (also checked
  with `ls-remote`).
- Firebase tools signed in as the owner's personal account (Editor), with
  `yum-donut-school` listed.
- RELEASE VERIFIED — the deploy below gave "Successful update operation" for both
  functions (Node.js 22, us-central1, 185.29 KB source). `functions:list`
  afterwards still lists all 10 functions:
  - `resetStudentPassword` and `teamsBot`.
  - 8 YumPals functions: `yumpalsChooseSavedGame`, `yumpalsGetPaidCareState`,
    `yumpalsGetPaidSettings`, `yumpalsGetSavedGame`, `yumpalsManageStudentAccount`,
    `yumpalsPurchaseCare`, `yumpalsSetHolidayMode`, `yumpalsUpdatePaidSettings`.
- Live check in the browser pane, signed in as the owner (Mr Rayner, Admin):
  - The current YumPals loaded the owner's pal normally: Fizzgig, 16 donuts, "Care
    today: 2 / 25", asleep at night, no alerts.
  - `yumpalsGetPaidCareState` returned 200 twice (the background check and opening
    YumPals).
  - The pal was not moved: the current app sends no pocket requests.
- Not checked live: an old-style care purchase, which would spend the owner's real
  donuts. The purchase endpoint was updated from the same upload, and its old path
  is covered by the tests. Its first live use comes in Release 2.
- Deploy, updating only the two existing endpoints:
  `npx --yes firebase-tools@15.34.1 deploy --only functions:teams:yumpalsGetPaidCareState,functions:teams:yumpalsPurchaseCare --project yum-donut-school --non-interactive`
- Live check after deploying:
  - The current app still loads and buys care exactly as before (owner's account,
    `yumpalsGetPaidCareState` 200).
  - `functions:list` still shows all functions.

  The pocket path is first used live in Release 2 (teacher only). That is when the
  owner's pal moves.
- Rollback: redeploy the two functions from the baseline tag.
