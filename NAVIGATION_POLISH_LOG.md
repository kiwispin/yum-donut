# Navigation polish — 4 October 2026

Scope: app navigation presentation and interactions only. Baseline `05ac318` is preserved by tag `codex/navigation-polish-baseline-20261004`. Existing YumPals eligibility, routes, device, purchases, bank and gift handlers are not changed. The user explicitly requested this agent do the coding; no coding was delegated.

## Design decisions

- Preserve one priority row: Give, Goal, enabled YumPals, Arcade, Bank, Shop, then remaining destinations. More is only present when destinations cannot fit.
- Replace the oversized left-edge, two-column panel with a compact single-column popover attached to the right edge of More. Retain app typography and slate/pink/white colours. Use small line icons, a restrained current-page tint and checkmark, and consistent target sizes.
- Use a subtle open-state tint instead of a permanent outlined More button. A visible focus outline remains for keyboard users.
- Preserve every original onClick and aria-current; add arrow/Home/End convenience while retaining native Tab navigation, Escape focus return and outside/focus dismissal.

## Refused approaches / corrected attempts

- Do not repeat previously rejected wrapping tabs, horizontal scrolling, an all-destinations dropdown, or permanent categories that hide frequently used pages.
- Do not remove focus indication to achieve a cleaner screenshot.
- Initial patch tool refused delete/add of the same path in one patch without changing files. Applied the replacement in separate patch operations instead.
- Initial lint flagged a ref-reading close callback captured by the render helper. Event handlers now return focus using the clicked button's own navigation ancestor; no lint suppression added.
- An existing local `git` shim returned empty output to historical-preservation tests. Rerun uses `/usr/bin/git` via PATH; application/baseline assertions are unchanged.
- First browser dismissal test tried clicking a heading covered by the open menu. Corrected the test to click outside the navigation and popover; no application behaviour changed for this test error.

## Verification / disposition

- ACCEPTED for release after engineering/visual review; user design feedback remains separate.
- Full frontend suite: **106/106 passed**, 2772.534042ms. Lint: exit 0. Diff whitespace check: clean. Historical preservation tests ran against real `/usr/bin/git`, without disabling assertions.
- `node verification/navigation-polish-check.mjs`: passed at **320, 390, 768 and 1440px** in 3729ms, plus 320×480 short-screen reachability, all-fit/no-More, resizing with focus on a moving link, reduced-motion support, and admin-preview/YumPals visibility changes. Every eligible destination appears once; original selection callbacks run once; keyboard/Tab/Escape/outside dismissal and focus restoration passed. Panel right edge matches More within 1px; content bounds unchanged opening/closing; zero horizontal overflow or page errors.
- Desktop 1440px and phone 320/390px screenshots inspected: compact right-aligned panel, familiar slate/pink/white styling, icons and selected-row check, priority YumPals visible, no clipped labels. Screenshots: `/tmp/yum-navigation-320.png`, `/tmp/yum-navigation-390.png`, `/tmp/yum-navigation-1440.png`.
- Production build with all three existing YumPals flags enabled: exit 0, **893ms / 1715 modules**, JS `index-BXZZFmC0.js`, CSS `index-BASmV3CR.css`. Existing dependency-age and bundle-size advisories are unchanged/non-blocking.
- Application source changes are limited to `AppNavigation.jsx` and `appNavigation.css`; `App.jsx`, route handlers, eligibility flags, payment/device/server code are unchanged. No student/account/payment activity used in testing.
- RELEASE VERIFIED: source `8644f4c`, existing GitHub Pages publication succeeded. Live HTML references the tested assets; downloaded SHA-256 matches both local files: JS `219d02558cd3a56eabad45ae934e547d77a0e83ecf2522aca9aa54313dcae8b6`, CSS `79951ab31a95f92e00a633faf983553ecc505a8b79246b7d8c53fc9ff93d64d3`. No backend deployment or settings changes. Rollback baseline remains `05ac318` / `codex/navigation-polish-baseline-20261004`.
