# YumPals giving cheer for real pets — 28 October 2026

Request: step 2 of giving cheer (see `GIVING_CHEER_LOG.md` for the approved
preview). The owner approved the plan: two releases, each shown before deploying.
Weekend gifts stay excluded, with the message "Giving cheers happen on school days."

Baseline: `82650c6` (`main`, live). Release A branch `codex/yumpals-giving-cheer`;
Release B branch `codex/yumpals-giving-cheer-server`, which builds on A.

## Release order and why

The app checks the saved-pal reply strictly (`validateHandheldView`, exact keys).
A server sending a new `cheer` field to an older app would make pals fail to load.
So Release A (app accepts and shows `cheer`) goes live first, while the server sends
nothing new. Release B (server grants cheers) follows as a targeted deploy of only
`functions:teams:yumpalsGetPaidCareState`.

## Release A — app (ready to deploy)

- ACCEPTED — `paidCareClient.js`: `validateHandheldView` accepts an optional `cheer`
  only when it is exactly `{ date, gain }`, the date is the reply's Auckland date,
  gain is 0 or 1, and a pet is present. Replies without `cheer` validate exactly as
  before.
- ACCEPTED — `YumPalsSavedHandheld.jsx`: on a cheer, play the existing pat animation
  and show "<name> heard you gave a donut! Happy +1." (or "Already as happy as can
  be.") for 8s in the status line above the device. Each owner's cheer plays once per
  date (`claimCheerDisplay`: in-memory plus localStorage, safe if storage throws), so
  the transport's 60s warm cache cannot replay it. The protected device markup is
  unchanged (guard test passes).
- ACCEPTED — the first version cleared the message in the same effect that claimed
  the cheer. Under React's development double-run that would leave the message on
  screen permanently, so the 8s timer now has its own effect. An unnecessary
  eslint-disable comment from the first version was removed.
- ACCEPTED — `appSurround.css`, an existing bug: the saved status line reserves
  2.8em to avoid layout movement, but the magazine surround adds 14px padding, so
  even one line clipped behind a scrollbar (content 50px in a 35px box). This
  affected every message there, such as "Purchase confirmed." For the saved status
  line only: 6px padding, and the box may grow. One line now fits exactly (content
  35px = box 35px; device top 396px with or without a message). A two-line message
  at 320px shows in full (57px) instead of clipping.
- ACCEPTED — `givingCheer.js`: weekend message "Giving cheers happen on school days."
  Live care keeps fading on weekends, so "Pals rest on days off" would be wrong.
- ACCEPTED — `verification/saved-surround.jsx`: `?cheer=1` / `?cheer=0` adds today's
  cheer to the fixed test reply (no account).
- ACCEPTED — `givingCheerClient.test.js`: replies without cheer are unchanged; valid
  cheers pass; wrong date, gain 2/−1, missing or extra keys, null and no pet are
  rejected; play-once per owner and date, including blocked storage; the
  school-days message.

### Release A measured results

- Frontend suite: 149/149 passed in 9.64s; the handheld design guards pass. Lint
  exit 0. `git diff --check` clean.
- Production build exit 0, 1720 modules. JS `index-Blqv6AgW.js` 928.24kB / 274.91kB
  gzip; CSS `index-CxnTlWCp.css` 94.47kB / 17.31kB gzip.
- Browser, saved handheld test page: with `?cheer=1`, the pat animation (happy eyes
  and heart) plays and "Niblet heard you gave a donut! Happy +1." shows unclipped. A
  reload does not replay it. `?cheer=0` at 320px shows the full two-line "Already as
  happy as can be." with no sideways scroll. Preview (`?yumpals=demo`) unchanged
  apart from the weekend message.

### Release A release

- Owner approved. Merged to `main` (fast-forward) and `codex/yumpals-only-release`
  at `09bddb0`; the server code is not on `main`. Rollback tag
  `codex/giving-cheer-app-baseline-20261028` → `82650c6`. Atomic push, and the remote
  IDs were verified (one verification command failed on a `rev-parse --short` usage
  error after the push succeeded, then was rerun correctly).
- RELEASE VERIFIED — published with `npm run deploy` as `gh-pages` commit `f1c9fbb`,
  live after ~60s. Live `index.html` is byte-identical to the build; JS
  `index-Blqv6AgW.js` (MD5 `1a2da05649619bc08c1e72ea02b45881`) and CSS
  `index-CxnTlWCp.css` (MD5 `8ea2d0f5c760ff0f16a7d631d6423a56`) match locally.
- Live, signed in as the owner: the new bundle loads. The saved pal loads as before
  (Fizzgig, 26 donuts, care 0/25), with no cheer because the server is unchanged.
  `yumpalsGetPaidCareState` returned 200, and the status line is empty and
  unclipped. The one startup `documents:commit` 400 is followed by a re-read and
  successful commits: the existing startup transaction retry recorded in
  `PHONE_JOBS_BUTTON_LOG.md`, not new. The page was returned to Give.
- Rollback: rebuild and publish `codex/giving-cheer-app-baseline-20261028`.

## Release B — server (built and tested; not deployed)

- ACCEPTED — `functions/src/yumpals/givingCheer.js`:
  - `givingDateKey` converts "Wed Oct 28 2026" (browser `toDateString` and the
    Teams bot's Auckland label) to `2026-10-28`. It rejects a mismatched weekday,
    an impossible date or another format.
  - `gaveOn` requires today's date and `given_today > 0`. New profiles record
    today's date with 0.
  - `isCheerRestDay` covers weekends, active Holiday Mode periods and calendar rest
    days (paused, holidays, absences, pauses).
  - `applyGivingCheer` gives +1 happiness up to 4 and sets `paidCare.cheerDate`.
- ACCEPTED — `paidCareService.getHandheldState`: when the giving and cheer refs are
  supplied, it reads the private profile, before any write, inside the existing
  transaction. It saves the pet and an audit record
  (`yumpals/main/users/{uid}/cheers/{date}`: amount 0, gain, needs before and after,
  giving label, `given_today`) atomically, and adds `cheer` to the reply. Without
  the refs, behaviour is unchanged. Wallet, receipts, refusals and the care cap are
  untouched. Purchases and games preserve `cheerDate` through their existing spreads.
- ACCEPTED — `appConnection.js` supplies `giving` (the same private profile path the
  wallet adapter reads) and `cheer`. `elapsedCare.js` exports its existing
  `isRestDate`.
- REFUSED (test setup error, code unchanged) — the first rest-day test edited the
  pet's existing calendar entry and the engine correctly refused it
  (`CALENDAR_HISTORY_CHANGED`: history is immutable). The test now adds
  effective-dated entries on the following day, plus a control case that does cheer.
- REFUSED (test expectation error) — the end-to-end test expected happiness 3. The
  fixture clock is two days after adoption, so one day of normal decay happens before
  the cheer. It now compares against the same pal without a gift (+1).

### Release B measured results

- Server suite (`functions`, `npm test` after `npm ci`): 156/156 passed in 1.35s,
  including 9 giving-cheer tests (date conversion; fresh-profile 0; first load +1
  with audit, wallet and care cap unchanged, under both day and elapsed care; once
  per day; full happiness gain 0; no or old or garbled gift; Saturday, calendar
  holiday, pause, absence, disabled and Holiday Mode, with a control; no refs →
  unchanged; no pet → no reads or writes). Server lint exit 0.
- Frontend suite with the server change: 150/150, including an end-to-end test where
  the app controller reads the real server code's cheer reply and it passes the app
  checks.

## Deployment prerequisites (Release B)

- This PC has no Firebase CLI. It needs `firebase-tools`, with the owner signing in
  to Firebase themselves.
- Java is not installed, so the existing local emulator harness was not run. The
  server is covered by the unit tests above.
- Deploy only `functions:teams:yumpalsGetPaidCareState`. Teams and the other
  functions stay untouched.
- Live check: the owner gives one real donut, then the owner's pal is loaded.

## Not tamper-proof

The giving record lives in the student's private profile, which the app writes from
the browser. A determined student could fake it; the most that gains is one free
heart per school day.
