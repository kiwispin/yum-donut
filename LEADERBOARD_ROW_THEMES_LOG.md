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
