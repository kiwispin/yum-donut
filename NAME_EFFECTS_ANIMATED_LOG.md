# Animated name effects and borders — 3 November 2026

Request: after the Neon Name fix went live, the owner felt the effects were not
worth 50–75 donuts ("these things need to be animated or something").

Branch: `codex/name-effects-animated`, from `main` `f990192` (the neon name release).

## Changes / disposition

- ACCEPTED — Neon Name: a neon sign. Pink tube outline and glow on a dark pill,
  a humming glow, and a flicker on and a blink every 6 seconds.
- ACCEPTED — Rainbow Name: the full spectrum (red to pink) sliding through the
  letters, instead of a mostly pink gradient. Own class `rainbow-text` in place of
  the Tailwind gradient classes.
- ACCEPTED — flame name (90 WPM): white-hot letters with flames rising off them
  and a smouldering pill.
- ACCEPTED — gold and silver borders: a band of light travels round the avatar
  frame (gold every 3s with a pulsing glow, silver every 5s). Uses a CSS
  `@property` angle; browsers without it show a still ring.
- ACCEPTED — Shop cards for Rainbow Name, Gold Border, Neon Name and Verified Badge
  show a live preview on the student's own name and avatar.
- ACCEPTED — the Give name search shows silver borders too, and the name effect
  covers only the name, not the ✅ beside it. Leaderboard names with an effect are
  not cut off by `truncate`, so the glow is not clipped.
- ACCEPTED — devices set to reduce motion get still versions of every effect.
- NOT CHANGED — prices, purchases, `handlePurchase` and every other handler; no
  Firestore rules or function change. Verified Badge itself is unchanged.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 229 pass,
  0 fail (2 new in `src/nameEffects.test.js`). `npx eslint .`: clean.
  `vite build`: succeeds.
- Browser, local dev server, the owner signed in as Mr Rayner against live data
  (looked at only; nothing bought or saved): Leaderboard shows Lithuli as a neon
  sign, Elsie in a full rainbow, silver rings on Lithuli and Aaishah and a gold ring
  on Charlotte; the ring angle and the rainbow position were measured changing over
  time. Shop shows previews on Rainbow Name, Gold Border, Neon Name and Verified
  Badge. One console error, a 400 from a sign-in request, not from these files.
- Not exercised: reduced motion, phone width, and Safari/Firefox.
