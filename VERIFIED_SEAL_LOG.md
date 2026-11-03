# Verified seal — 3 November 2026

Request: the Verified Badge, the dearest look in the Shop at 150 donuts, was the ✅
emoji, which reads as a ticked checkbox and differs by device ("a bit sad"). The
owner approved a proper verified seal ("Go ahead").

Branch: `codex/verified-seal`, from `main` `ba578a3` (the smooth neon release).

## Changes / disposition

- ACCEPTED — `src/VerifiedSeal.jsx`: a blue scalloped seal with a white tick, drawn
  as SVG so it looks the same everywhere. A shine sweeps across it every 5 seconds;
  it is otherwise still. Hover or tap shows a "Verified" label (off inside the Give
  name search, where the seal sits inside a button). Styles in
  `src/nameEffects.css`; the shine is still for devices set to reduce motion.
- ACCEPTED — the seal replaces ✅ beside verified names on the Leaderboard, in the
  Give name search and in the Shop preview, and is new beside the student's own
  name in the header and beside a verified giver or recipient in the Feed.
- ACCEPTED — the Verified Badge Shop card shows the seal as its icon.
- NOT CHANGED — price, purchase and every handler; the item's stored icon and
  description; no row theme for verified; no Firestore rules or function change.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 230 pass,
  0 fail. `npx eslint .`: clean.
- Browser, local dev server, the owner signed in as Mr Rayner against live data
  (looked at only; nothing saved): Elsie, the one verified student, shows the seal on
  the Leaderboard and in three Feed entries ("Mr Rayner recognized Elsie", "Elsie went
  shopping", "The Bank recognized Elsie"); hovering shows "Verified"; the shine was
  measured resting, then sweeping across about every 5 seconds. The Shop card shows
  the seal icon and a preview on Mr Rayner. No console errors.
- Not exercised: the header seal (Mr Rayner is not verified), tap on a phone, and
  reduced motion.
