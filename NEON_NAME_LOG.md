# Neon Name and other name effects — 3 November 2026

Report: Lithuli bought Neon Name in the Shop and nothing happened.

Branch: `codex/neon-name`, from `main` `a669480` (the paid giving release).

## Cause

- The purchase worked: `handlePurchase` took 75 donuts and set `neon_name` on
  Lithuli's public profile. It is unchanged.
- The styles for every name effect and avatar border (`.neon-text`, `.flame-text`,
  `.gold-border`, `.silver-border`, the rainbow shimmer) were in `src/App.css`, which
  nothing imports and nothing ever has (checked back to the initial commit). Neon and
  flame names showed as plain text, gold and silver borders never appeared, and
  rainbow names showed the gradient without the shimmer.
- The Shop card checked ownership against the private profile, which never has the
  flags, so a bought item kept showing a Buy button instead of Owned.
- The Leaderboard showed flame, then rainbow, then neon, so a student who had earned
  a flame name would never see a neon name they had bought.

## Changes / disposition

- ACCEPTED — the name and border rules move unchanged from `src/App.css` to
  `src/nameEffects.css`, imported by `App.jsx`. The arcade, claw machine and CRT
  rules stay in `App.css`, still not imported, so the Arcade looks as it does today.
- ACCEPTED — neon and flame names (white glowing text) sit on a dark pill so they
  are readable on white cards.
- ACCEPTED — `src/nameEffects.js` picks one effect: bought beats earned, so neon,
  then rainbow, then flame. Used by the Leaderboard, the Give name search (which
  showed only neon before) and the header name (which showed none).
- ACCEPTED — the Shop receives the student's public profile, so owned items read
  Owned.
- NOT CHANGED — `handlePurchase` and every other handler; no Firestore rules or
  function change.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 227 pass,
  0 fail (4 new in `src/nameEffects.test.js`). `npx eslint .`: clean.
  `vite build`: succeeds.
- Browser, local dev server, read-only sandbox as "Alice" (nothing bought or saved):
  Leaderboard shows Lithuli in neon on a dark pill, Elsie in rainbow, Charlotte with
  a gold border; the header shows Alice's flame name; the Give search shows Lithuli
  in neon. No console errors.
- Not exercised: the Shop's Owned state for a student who owns an item (the sandbox
  only signs in as Alice or the teacher).

## Release — 3 November 2026

The owner approved the release ("Release it").

- Frontend only: no function deploy and no Firestore rules change.
- Rollback: rebuild and publish `codex/neon-name-baseline-20261103` (`a669480`,
  the production source before this release).
- RELEASE VERIFIED — source `43039c9` on `codex/neon-name`, merged to `main` as
  `1e631d6`, rollback tag pushed; remote IDs verified. Published with
  `npm run build` and `gh-pages` as `187677c`, live after ~45s. Byte-identical to the
  build:
  - `index.html` (MD5 `d94457d61fc5a01d3fa64b95cd7e2020`).
  - JS `index-DuUXNxhj.js` (`d64c51b53db18adc42f51468ddcd2297`).
  - CSS `index-AorIDkUl.css` (`abe0cb50c5aeceb21705eed03e475127`).
  The live CSS contains the `.neon-text` dark pill and glow. Not seen live signed in
  (the live site has no sandbox sign-in).
