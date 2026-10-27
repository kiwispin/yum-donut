# YumPals giving cheer (preview prototype) — 28 October 2026

Request: link YumPals to recognition. The first donut a student gives a teammate
each school day cheers up their pal with one free happiness heart. The owner
approved the design and asked for a preview-only prototype, shown to them before
anything else.

Baseline: `82650c6` (`main`). Branch `codex/yumpals-giving-cheer`. Preview only:
no saved pets, wallets, Firebase Functions, rules or live site touched, and
nothing deployed.

## Design (approved)

- Trigger: the first gift to a teammate on an Auckland school day. Munch does not
  count. Weekends, frozen or holiday dates and teacher pauses rest. No pal, no cheer.
- Effect: +1 happiness, up to the 4-heart maximum. If happiness is already full the
  pal still cheers, but nothing is banked. The pal uses the existing pat animation
  (happy eyes and heart) with a CHEER label, plus "<name> heard you gave a donut!
  Happy +1."
- Limits: once per school day. Free: never charges or pays out, and does not count
  toward the 25 daily care cap. It leaves a free receipt ("CHEER FREE").

## Changes / disposition

- ACCEPTED — `src/yumpals/givingCheer.js`: pure rule `applyGivingCheer(state,
  gift, { paused })` returning OK, OK_FULL, ALREADY_CHEERED, REST_DAY, NOT_A_GIFT,
  NOT_TODAY or NO_PET; `isCheerRestDay` (weekend or frozen date); and the
  student-facing messages.
- ACCEPTED — `src/yumpals/givingCheer.test.js`: 7 tests covering the free heart,
  wallet/spend/cap unchanged, once per day, full happiness, Munch, an old gift, a
  pause, a weekend, a frozen date, no pal, and a new school day.
- ACCEPTED — `YumPalsHandheldDemo.jsx`: a "Pretend I gave a donut today" button in
  "Try different situations" stands in for the real gift. A "Giving cheer used /
  not used today" readout was added. A free receipt reads "CHEER FREE" instead of
  "-0 DONUTS". The cheer plays the pat animation.
- REFUSED — showing the CHEER label by editing the device markup. The guard test
  "outside polish preserves handheld markup and original device stylesheet exactly"
  (`surround.test.js`, baseline `1649d82`) failed: 143/144. The markup edit was
  reverted and the guard left unchanged. Instead, `cheer: 'Cheer'` was added to
  `PAID_CARE_LABELS`, which is only ever read by key (checked with a repo-wide
  search), so the existing markup shows CHEER.
- Not done: the separate test page from the design. The existing standalone preview
  (`?yumpals=demo`, no sign-in, pretend donuts) already hosts the button, so a second
  page added nothing.

## Measured results

- Frontend suite (`src/*.test.js src/yumpals/*.test.js src/arcade/*.test.js`):
  144/144 passed in 9.35s, including the design guard. Lint exit 0 (existing stale
  `baseline-browser-mapping` warning only). `git diff --check` clean.
- Browser, `localhost:5174/yum-donut/?yumpals=demo`, "Needs care" scenario: the
  pretend gift showed CHEER on the screen, happy eyes and heart, and "Niblet heard
  you gave a donut! Happy +1." The pretend wallet was unchanged (left 25, spent 5),
  care today stayed 0/25, and the recovery estimate fell 16 → 15. A second press
  gave "already cheered for your giving today". The status screen lists "CHEER
  FREE". Saturday 2026-10-31 gave "Pals rest on days off…", and Monday 2026-11-02
  cheered again. Zero console errors, re-checked after the label change.
- Production build exit 0, 1720 modules, 1.63s; JS 927.61kB / 274.66kB gzip, CSS
  unchanged (`index-p6o1Gwbm.css`).

## Not yet built (step 2, needs separate approval)

- A server-side cheer for real pets (Firebase Functions, atomic with care and with
  a receipt). It would read the student's giving record, which the student's own
  browser writes (as for all giving), so it is not tamper-proof. Giving records
  browser-local dates (`toDateString`) while YumPals uses Auckland dates; the
  server must convert rather than assume they match.
- Releasing this preview change alone would show the pretend-gift button to anyone
  opening the preview. It affects pretend data only.
