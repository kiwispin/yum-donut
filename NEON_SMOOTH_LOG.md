# Smooth neon and What's New for Shop looks — 3 November 2026

Request: the owner did not like the Neon Name flicker ("Looks like it's having
issues rather than it being an 'effect'") and asked whether What's New covered the
name effect changes. It did not: none of today's three releases touched it.

Branch: `codex/neon-smooth`, from `main` `203e722` (the Leaderboard row themes
release).

## Changes / disposition

- ACCEPTED — Neon Name no longer flickers or blinks. It keeps the steady glow with
  a soft hum, and a white spark of current runs round the tube outline every 3.5s
  (the same travelling-light technique as the avatar borders). The spark is still
  for devices set to reduce motion.
- ACCEPTED — What's New (`PatchNotesModal`): subtitle now "Shop looks that shine, a
  new Trophy Cabinet, and your YumPal has moved into a Donut!", and a new top
  section "Shop looks got an upgrade" (`ShoppingBag` icon, already imported):
  - "Neon Name, Rainbow Name and Gold Border now glow and move, and your whole row
    on the Leaderboard lights up to match. Each Shop card shows a preview on your
    own name first, so you know what you’re getting."
  - "Fast typing in Training earns looks too: a silver frame at 50 WPM, gold at 70
    and a flame name at 90. Reach the speed on a run that still earns donuts that
    day." (The looks are granted only on a run under the 3-a-day training cap.)
  Every other section is unchanged.
- NOT CHANGED — purchases and every handler; no Firestore rules or function change.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 230 pass,
  0 fail. `npx eslint .`: clean.
- Browser, local dev server, the owner signed in as Mr Rayner against live data
  (looked at only; nothing saved): Lithuli's neon has only the `neon-hum` animation
  and full opacity, and the spark angle was measured moving. Enlarged in the page
  (not saved), the spark shows as a white glint travelling round the outline. What's
  New opens with the new section first.
