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

## Releases (owner approved A, then B, then C, with the weekend wording fix in A)

- A — `main` fast-forwarded to `a265745`, then the weekend wording branch merged
  (`3eaecfe`). Frontend 158/158, lint exit 0, no server code. Rollback tag
  `codex/visit-gift-app-baseline-20261028` → `e6a7b52`. RELEASE VERIFIED —
  `gh-pages` `7a954b8`, live after ~90s, files byte-identical (JS `index-BhP9Lr8H.js`
  MD5 `96982bc372be7102c183b99f1b81918b`). The owner's pal loaded normally
  (`yumpalsGetPaidCareState` 200, no gift yet). The two startup `documents:commit`
  400s were followed by successful commits: the known retry pattern.
- B — merged as `1ed733f`. Server 165/165, server lint exit 0, frontend 159/159.
  Rollback tag `codex/visit-gift-server-baseline-20261028` → `3eaecfe`. RELEASE
  VERIFIED — `deploy --only functions:teams:yumpalsGetPaidCareState`: "Successful
  update operation"; `functions:list` still lists all 10 functions. The owner's
  `visits` record for 2026-10-28 exists (`daily_visit`, Food +1; the only record).
- FINDING (B live check), FIXED in C: the gift was granted, but opening YumPals
  showed no message. `useSavedVisibility` (the YumPals tab visibility check) calls
  `yumpalsGetPaidCareState` on app open, every 60s and on focus, so it was the read
  that granted the gift. Its reply was ignored, and once the transport's 60s warm
  cache expired the handheld never saw `visit`. The giving cheer has the same
  latent issue; it only showed in its earlier live check because YumPals was opened
  before a background read ran. The hearts were still granted correctly and for
  free.
- ACCEPTED (C) — `src/yumpals/giftStash.js`: the visibility check now calls
  `stashGifts(uid, result)`, which keeps a `visit` or `cheer` for today only after
  `validateHandheldView` accepts the reply for that student. The handheld shows
  `quote.visit || stashed.visit` (likewise for cheer), still once per owner and date
  via `claimOnce`, and re-reads on a stash event. Tampered or broken stored values
  are ignored. Tests: `giftStash.test.js` (4). `visit-gift-check.mjs` adds a kept
  background gift that shows on opening, once: PASS.
- C — merged as `fffc628`. Frontend 167/167, lint exit 0; server 165/165. Rollback
  tag `codex/visit-gift-reminder-baseline-20261028` → `1ed733f`. RELEASE VERIFIED —
  `gh-pages` `b364495`, live after ~45s, files byte-identical (JS
  `index-BuHEh_rm.js` MD5 `e9bd2bcdc857fca78aade557b259e50b`, CSS
  `index-CJZ2KnV1.css` MD5 `88a61d67d6a9c98b68a43d4d75cf67fe`).
- Live checks for C, signed in as the owner:
  - Top menu: the YumPals item showed the dot and "(gift waiting)" before the
    visit; after opening YumPals and returning, it was cleared and the visit record
    saved.
  - 390×844: after removing this browser's own visit record, the bottom-bar button
    read "Pals (gift waiting)" with the dot. It cleared while on YumPals and stayed
    cleared after leaving. The pane's screenshot did not reach the bottom bar at
    that size, so this was checked through the page itself.
  - What's New: the subtitle "Visit your pal every day for a free heart.", then "A
    free gift every day you visit", "Giving cheers up your pal", Vision Mixer and
    YumPals. No failed requests.
- Not yet seen live: a kept background gift on the live site. The owner's gift
  today was granted (by B, before C) without being kept, so the first live showing
  will be the next day's visit. The same path passed on the test page.
- Rollback: rebuild and publish the matching baseline tag for the site; redeploy
  `yumpalsGetPaidCareState` from `codex/visit-gift-server-baseline-20261028` for the
  server.
