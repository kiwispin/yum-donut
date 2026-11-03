# Leaderboard row themes — 3 November 2026

Request: the owner asked whether the whole Leaderboard row should take on the
effect, not just the name and avatar, and chose to try a quiet row theme matching
each name effect ("Let's try first option").

Branch: `codex/leaderboard-row-themes`, from `main` `67a574a` (the animated name
effects release).

## Changes / disposition

- ACCEPTED — `rowThemeClass` in `src/nameEffects.js`: a row follows the student's
  name effect (neon, rainbow, flame, same order as the name), or a gold wash for a
  gold border when there is no name effect. Silver borders get no row theme.
- ACCEPTED — Neon row: a dark sign mount down the left edge with pink light
  spilling across. Rainbow row: a faint wash and a rainbow line sliding slowly
  along the bottom (8s). Flame row: a warm glow rising from the bottom-left. Gold
  row: a soft gold wash. Only the rainbow line moves; the name stays the main motion.
- ACCEPTED — Leaderboard only. The Give name search is unchanged.
- ACCEPTED — the rainbow line is still for devices set to reduce motion.
- NOT CHANGED — prices, purchases and every handler; no Firestore rules or function
  change.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 230 pass,
  0 fail (1 new). `npx eslint .`: clean.
- Browser, local dev server, the owner signed in as Mr Rayner against live data
  (looked at only; nothing saved): Lithuli's row is neon, Elsie's rainbow,
  Charlotte's gold. No student has a flame name, so the flame row was shown by
  adding the classes to Ash's row in the page only, not saved.

## Release — 3 November 2026

The owner approved the release ("Release it").

- Frontend only: no function deploy and no Firestore rules change.
- Rollback: rebuild and publish `codex/leaderboard-row-themes-baseline-20261103`
  (`67a574a`, the production source before this release).
- RELEASE VERIFIED — source `80971e7` on `codex/leaderboard-row-themes`, merged to
  `main` as `9182571`, rollback tag pushed; remote IDs verified. Published with
  `npm run build` and `gh-pages` as `249d7f8`, live after ~45s. Byte-identical to
  the build:
  - `index.html` (MD5 `79b27b920de1e88d0ff043d24b81a3fd`).
  - JS `index-Cm68mVWR.js` (`47f600da9f8b9b7c15a5df43e2e0632a`).
  - CSS `index-Td-W_oqP.css` (`c2deacac7e671bf2a9d40bd8906c09fb`).
  The live CSS contains `.row-neon`, `.row-rainbow:after`, `.row-flame` and
  `.row-gold`. Not seen live signed in.
