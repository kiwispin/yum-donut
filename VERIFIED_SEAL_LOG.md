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
  the seal icon and a preview on Mr Rayner. One console error, the same 400 from a
  sign-in request seen in earlier checks, not from these files.
- Not exercised: the header seal (Mr Rayner is not verified), tap on a phone, and
  reduced motion.

## Release — 3 November 2026

The owner approved the release ("Release it").

- Frontend only: no function deploy and no Firestore rules change.
- `main` on GitHub had moved to `c12e31a` (the Teams paid giving release, merged
  elsewhere) since this branch was cut. It was fast-forwarded in before merging, so
  that work is kept. It changes only `functions/` and its log, nothing the website
  build uses, so this publish ships only the seal.
- Rollback: rebuild and publish `codex/verified-seal-baseline-20261103` (`ba578a3`,
  the website source before this release; its frontend matches `c12e31a`).
- RELEASE VERIFIED — source `cae232d` on `codex/verified-seal`, merged to `main` as
  `7cebaf6`, rollback tag pushed; remote IDs verified. Published with
  `npm run build` and `gh-pages` as `99f9bf5`, live after ~45s. Byte-identical to
  the build:
  - `index.html` (MD5 `3e59bb502ba57eb8279b4a09ac5bb2ad`).
  - JS `index-QggKwhgx.js` (`aa6d2c4e409e6bd79e34dce6ea4b6c43`).
  - CSS `index-B72WUvYm.css` (`44ed203cfc1e4dcc246b08b0a682ed9e`).
  The live CSS contains `.verified-seal-shine` and `@keyframes seal-shine`. Not
  seen live signed in.
