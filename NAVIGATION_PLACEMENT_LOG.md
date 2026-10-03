# Navigation placement — 4 October 2026

Request: keep Goal and Feed on the main menu strip; move Training and YumPals into More. Styling, routes, eligibility and all other app behaviour are out of scope.

Baseline: `9bf7248`, preserved by `codex/navigation-placement-baseline-20261004`.

## Changes / disposition

- ACCEPTED — AppNavigation.jsx: priority strip now Give, Goal, Feed, Arcade, Bank, Shop, Jobs, Leaderboard. YumPals (including eligible preview variants) and Training stay in More at all viewport widths. Width measurement reserves More space for these destinations. Existing compact-screen overflow and keyboard behaviour are preserved.
- ACCEPTED — navigationLayout.test.js and navigation-polish-check.mjs: update the former near-front YumPals expectation to the newly requested placement, including wide-screen coverage.
- ACCEPTED — verification/navigation.jsx: add a synthetic Training visibility switch to exercise all-fit/no-More behaviour without real account changes.
- No CSS, Tamagotchi, financial, settings, eligibility or backend changes. Prior rejected navigation designs are not repeated.

## Measured results

- Frontend suite: 106/106 passed, 2722.610917ms. Lint exit 0; whitespace diff check clean.
- Browser checks passed at 320, 390, 768 and 1440px in 3924ms: Give/Goal/Feed visible, Training/YumPals only in More, eligible routes once each, original callbacks once, keyboard/focus/dismissal, no horizontal overflow or content jumps. Also verified wide all-fit with permanent More routes, no More when those routes are absent, resize focus recovery, reduced motion and 320×480 last-item access. Zero page errors.
- Desktop and phone screenshots inspected, including `/tmp/yum-navigation-wide-placement.png` and `/tmp/yum-navigation-320.png`.
- REFUSED test assumption: the prior resize test expected the first dropdown item to become a main-strip button on a wide screen. With the newly requested permanent More placement that expectation is obsolete; initial test timed out. Corrected to assert that YumPals retains focus inside More. No application workaround added.
- Production build passed in 869ms / 1715 modules with all three existing YumPals flags retained. JS `index-IYw8C4cq.js`, SHA-256 `a07fbf8d0455367e13bb6f1a34dbcd0fa8839f946c53c8694e06c957298fd6a0`. CSS `index-BASmV3CR.css` is byte-identical to baseline (SHA-256 `79951ab31a95f92e00a633faf983553ecc505a8b79246b7d8c53fc9ff93d64d3`). Existing dependency-age and bundle-size advisories unchanged.
- Publication verification pending.
