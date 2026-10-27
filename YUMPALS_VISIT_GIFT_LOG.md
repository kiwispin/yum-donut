# YumPals daily visit gift — 28 October 2026

Request: drive engagement back up. The usage totals (read-only, totals only) showed:

- 12 of about 23 students adopted a pal.
- 7 students ever bought care after adopting; 5 adopted and never returned.
- About 113 care actions came in the first two weeks after launch (9–22 Sept).
- Only 3 student care actions in the last three weeks.

The owner left the design to me ("whatever you think"). The chosen pack targets
both findings, the drop-off and the cost of care. Server rules are free and paused
with the pal. Each release is shown to the owner before deploying.

Baseline: `e6a7b52` (`main`, live). Release order (the app checks replies strictly,
so the app must accept new fields before the server sends them):

- A, branch `codex/yumpals-visit-gift-app`: the app accepts and shows `visit`.
- B, branch `codex/yumpals-visit-gift-server`: the server grants gifts. Targeted
  deploy of only `yumpalsGetPaidCareState`.
- C, branch `codex/yumpals-visit-gift-reminder`: gift-waiting dot and What's New,
  released after B so the dot never promises a gift that does not exist yet.

## Rules (server, `functions/src/yumpals/visitGift.js`)

- The first pal load on an Auckland day gives +1 heart to the lowest need. Ties
  are broken in the order Food, Happy, Clean, Health. A full pal is greeted with
  no gain.
- After 7+ days since the pal was last loaded, it is a welcome back instead: +1 to
  every need that is not full. "Last loaded" is the care clock's existing
  `elapsedClock.at`, read before this load advances it.
- Once per day (`paidCare.visitDate`). Weekends count, since pals fade on weekends
  by the owner's 8 September decision. No gift while YumPals is disabled, Holiday
  Mode is on, or on calendar rest days (holidays, absences, pauses).
- Free: never charges, pays out or counts toward the care cap. An audit record is
  written to `yumpals/main/users/{uid}/visits/{date}` (`daily_visit` or
  `welcome_back`, gains, needs before and after, `lastSeenMs`, amount 0).
- Opt-in through `refs.visit`, which only the live app connection supplies. The
  visit is computed before the giving-cheer read, and its record is written only
  after every read, as Firestore transactions require. The reply includes `visit`
  only on the load that granted it, and the cheer still applies on top.

## Changes / disposition

- ACCEPTED (A) — `paidCareClient.js`: optional `visit` accepted only when exactly
  `{ date, welcomeBack, gains }`, with date = reply date, gains exactly the four
  needs at 0/1, at most one gain unless welcome back, and a pet present.
  `givingCheer.js`: `claimOnce(kind, …)` (cheer keeps its earlier storage key),
  `visitMessage` and `visitAnimation`. `YumPalsSavedHandheld.jsx`: the gift plays
  its matching animation (Food → feed, Happy → pat, Clean → clean, Health →
  medicine, welcome back → wake) with a message. Messages queue for 6s each, so a
  visit gift and a cheer show one after the other. The test page accepts `?visit=`.
- REFUSED (A, my error, fixed before commit) — my first edit replaced the cheer
  effects block, which also contained the phone auto-scroll effects, and deleted
  them. Lint caught it ("`userScrolled` is assigned a value but never used"). The
  block was restored byte-for-byte from `HEAD`, and the diff was rechecked to show
  only the gift changes.
- ACCEPTED (B) — `visitGift.js`, the `paidCareService.getHandheldState` wiring and
  the `appConnection.js` `visit` ref. Tests: `functions/test/visitGift.test.js`
  (9) and `src/yumpals/visitGiftEndToEnd.test.js`, moved to B because it needs
  the server code.
- REFUSED (B, test expectation error) — the welcome-back test expected cleanliness
  to stay full, but eight days of normal fading happen first. It now checks the
  rule against the recorded needs before.
- ACCEPTED (C) — `visitReminder.js` remembers each student's last visit date and
  whether they have a pal, on this device. A pink dot (with "(gift waiting)" for
  screen readers) shows on the bottom-bar Pals button and the YumPals menu item
  until today's visit. It is hidden while on YumPals, never shown for a student
  known to have no pal, and shown when there is no record yet, to invite a visit.
  The saved handheld records the visit and fires an event so the dot clears at
  once. What's New gets a new top section, "A free gift every day you visit", and
  the subtitle "Visit your pal every day for a free heart."
- REFUSED (test script) — the visit+cheer order check first included the start-up
  status "Please sign in to see your saved pal.". It now compares only gift
  messages. That brief start-up text is existing behaviour, left as is.

## Measured results

- A alone, with the server files set aside: frontend 158/158, lint exit 0, build
  exit 0.
- B: server 165/165 (9 new), server lint exit 0; frontend 159/159 including the
  end-to-end test, where the real server's visit reply passes the app checks.
- C: frontend 162/162 (4 new), lint exit 0, build exit 0, 1721 modules. JS
  932.43kB / 276.46kB gzip; CSS 95.17kB / 17.37kB gzip (new dot classes).
- `verification/visit-gift-check.mjs` (saved handheld test page, 390px, no
  account): for Food, Happy, Clean, Health, none and welcome back, the right
  message and animation, no clipping, and no replay after reload. A visit gift
  with a cheer showed both messages in order. Zero page errors.
- The dot needs the signed-in app, so it is to be checked live after release C.
