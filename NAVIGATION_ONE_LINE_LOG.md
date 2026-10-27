# Navigation on one line — 27 October 2026

Request: replace the More drop-down by showing every destination on the menu line.
Styling, routes, eligibility and all other app behaviour are out of scope.

Baseline: `fe89105`, preserved by `codex/navigation-one-line-baseline-20261027`.

## Changes / disposition

- ACCEPTED — AppNavigation.jsx: removed the permanent More-only group, reversing the
  4 October placement request at the owner's direction. Order is Give, Goal, Feed,
  Arcade, Bank, Shop, Jobs, Leaderboard, YumPals, Training. More now appears only
  when destinations genuinely do not fit (phones, or the extra admin YumPals preview).
- ACCEPTED — appNavigation.css: tab side padding 12px → 9px at all widths (phones
  already used 9px). All ten destinations measure 605px against the 640px menu line.
  No wrapping or horizontal scrolling, both previously rejected.
- ACCEPTED — AppNavigation.jsx focus fix: when More disappears while focus is inside
  it, focus now stays on the moved destination instead of jumping to the current
  page. The previous single `find` matched whichever came first in the row.
- ACCEPTED — navigationLayout.test.js and navigation-polish-check.mjs updated for
  the new placement.

## Measured results

- Frontend suite: 124/124 passed. Lint exit 0 (existing stale
  `baseline-browser-mapping` warning only). `git diff --check` clean.
- `verification/navigation-polish-check.mjs` (run on Windows via a local Playwright
  copy): passed at 768 and 1440px (all ten on one line, no More, no overflow) and at
  320 and 390px (priority order, More panel anchoring, every route once, keyboard,
  Escape/outside dismissal, focus return, no layout jump or overflow). Also passed
  all-fit, resize focus recovery, admin preview overflow, reduced motion and 320×480
  last-item access. Zero page errors.
- The first run exposed the resize focus bug above; fixed in the component, the test
  assertion was not weakened.
- Production build exit 0 with the `.env.production` YumPals flags.
