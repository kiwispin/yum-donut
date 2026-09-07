# YumPals implementation and review log

Every distinct attempted modification must have an ID, scope, rationale, measured verification results, and disposition (PENDING, ACCEPTED, or REFUSED). Preserve refused attempts and reasons; do not repeat an attempted change without new evidence and an explicitly documented revised hypothesis. Never fabricate measurements. Acceptance means local review, not deployment approval.

## GS-001 — Working gold standard — ACCEPTED as rollback baseline

- Date: 2026-09-07 (Pacific/Auckland).
- Source commit: d77abfa; tag: `gold-standard-before-yumpals-2026-09-07`.
- Includes all seven previously modified/untracked source files containing existing bank/account/Teams fixes. No pre-existing work discarded.
- Live Pages commit: `51135cf18e216137f47e7ed121ac8a5cca69e20e`; local tag: `gold-standard-live-before-yumpals-2026-09-07`.
- Live and baseline-built assets: `index-Bwm8PKOH.js`, `index-Dws-zttM.css`.
- Baseline: frontend lint exit 0; bank tests 2/2 (60.17ms suite); Teams tests 11/11 (100.60ms suite); functions lint exit 0; production build exit 0 (708ms, 1688 modules).
- Build sizes: JS 776.78kB (228.98kB gzip), CSS 57.27kB (9.65kB gzip).
- Existing warnings: stale browser compatibility data and JS chunk >500kB. Do not perform unrelated dependency upgrades.
- These automated checks are not proof of every live interaction. No live student balances or records changed.
- Implementation branch: `codex/yumpals-module`. Tags are local; not pushed or deployed.

## Rollback procedure

Do not reset or delete the current checkout. Create a separate worktree from `gold-standard-before-yumpals-2026-09-07`, install locked dependencies and build there. Compare asset hashes to the baseline above. Redeploy only with explicit deployment authorization. For exact published static files use a separate worktree from `gold-standard-live-before-yumpals-2026-09-07`. Do not restore/overwrite student data. New pet data must be additive and disabling the feature must preserve it. Any new backend deployment needs an independently reviewed rollback plan.

## IMPL-001 — Isolated YumPals module — ACCEPTED for local preview only

- Coder: GPT-5.6 Luna, Extra High; reviewer: parent agent.
- Specification: YUMPALS_PLAN.md. Implementation and measured results to be appended by coder; review disposition reserved for reviewer.
- No production deployment or live data mutation authorised in this implementation stage.

## REVIEW-001 — Initial backend draft — REFUSED

- Findings R-001 in YUMPALS_REVIEW.md: invalid Admin SDK path, incorrect/regressing growth, missing corruption guards, stale settings transaction reads, profile response lost daily status, audit ID collisions.
- Evidence: static inspection of first 508 backend lines. Sent to Luna; revised implementation must satisfy focused tests, not repeat draft.
- Interim correction: real installed Admin SDK now constructs all four expected namespace references successfully without network calls. Other changes pending final review.

## REVIEW-002 — Initial client draft — REFUSED

- Findings R-002/R-005: keyboard focus trap, discarded save responses, stale UID responses, unguarded cloud calls/sandbox, missing settings entry and day rollover refresh.
- Measured initial browser path: adoption works; feed leaves 0 days, pat gives exactly 1; both actions disabled after completion.
- Revised keyboard check: Tab from Settings moves to Cycle; Enter activates Settings; keyboard preference save succeeds. Remaining acceptance pending final review.

## REVIEW-003 — Initial visual draft — REFUSED

- R-003: rounded rectangle instead of egg, then revised egg content overflowing shell; malformed sprites and blurred pixel edges.
- Measured row totals: 254/255/255 instead of 256. Corrected rectangular-grid test now passes for all three creatures. Shell fitting correction still pending.

## REVIEW-004 — Initial tests — REFUSED as sufficient acceptance evidence

- Serial fake did not test concurrency or failure atomicity. Revised tests now exercise optimistic retry conflicts and failed commits. Actual emulator not run: Java runtime absent.
- After Luna usage interruption/resumption, parent independently ran root lint, six frontend/bank/sprite tests, functions lint, 22 backend/Teams tests, and build: all exit 0.
- Measured test suite durations: frontend 100.16ms; backend 108.82ms. Build: 903ms, 1692 modules; JS 800.96kB/236.02kB gzip; CSS 65.44kB/11.85kB gzip. Baseline warnings unchanged.
- Intermediate build assets: index-CpKXiZP2.js, index-u9juOqg1.css. Not deployed. Build passing is not final acceptance.

## RESUME-001 — Continue Luna after usage interruption — ACCEPTED workflow action

- User requested Continue. Reused the same Luna Extra High agent and existing draft; no higher-model coding takeover, no reset credit consumed, no duplicate implementation restarted.

## IMPL-002 — Read-only growth cannot invent rewards — ACCEPTED locally

- Revision: split display growth from care-time award growth. `publicPet` and demo settings/profile refreshes now render only persisted `earnedMilestones`; care transactions and eligible demo care still compute and persist newly crossed milestones. Current speed continues to supply the next threshold/progress without retroactively awarding a reward during a read.
- New evidence: backend regression covers standard careDays below the first threshold, then quick `getState`, then gentle `getState`; both reads retain an empty stored/completed reward list. Client regression covers the same isolated demo transition.
- Measured: backend `npm test` 23/23 passed; client/bank/sprite tests 8/8 passed. No emulator or live request was used.

## IMPL-003 — Controlled-date and disabled local demo correction — ACCEPTED locally

- Revision: `demoAdopt` now rejects disabled settings, records the supplied controlled Auckland date, and refreshes the selected day's status. The UI passes its selected demo date into adoption and shows the demo's temporary/no-account-save behavior explicitly. Disabled adoption now reports the paused-feature message instead of an incorrect duplicate-pet message.
- New evidence: client test confirms disabled adoption creates no pet and preserves the selected date; existing demo care test still confirms disabled care creates no write-like local mutation.

## IMPL-004 — Final visual/integration revision — ACCEPTED locally

- Revision: retained the approved egg-shell fit and crisp integer pixel grid; no further cosmetic expansion was made in this pass. Parent's latest mobile measurement reports `scrollWidth=390` and `innerWidth=390` at 390x844, with the centered brand and all three circular hardware buttons inside the shell. The accessible hardware controls and direct Feed/Pat paths remain in the isolated demo.
- Browser/demo URL for independent review: `http://127.0.0.1:5174/yum-donut/?yumpals=demo` while the local Vite server is running. Demo state is temporary and makes no Firebase/account writes.

## IMPL-005 — Rollout documentation and final local verification — ACCEPTED locally

- Revision: added `YUMPALS_ROLLOUT.md` and a README pointer documenting the explicit `VITE_YUMPALS_CLOUD=enabled` gate, five callable allow-list, UID/non-anonymous guards, `yumpalsAdmin` claim setup, scoped namespace/rules prerequisite, staging checks, emulator limitation, and rollback behavior. No deployment, push, dependency upgrade, rules change, or live data mutation was performed.
- Final measured results on 2026-09-07 (Pacific/Auckland): root lint exit 0 (existing stale `baseline-browser-mapping` warning); functions lint exit 0; root bank/YumPals tests 8/8 in 474.815ms; functions/Teams/YumPals tests 23/23 in 580.259ms; production build exit 0 in 2.01s with 1692 modules. Build assets were `index-Dbl_LWXY.js` 801.65kB / 236.10kB gzip and `index-CUYuo-A0.css` 65.48kB / 11.92kB gzip, compared with GS-001's 776.78kB / 228.98kB JS and 57.27kB / 9.65kB CSS. Existing stale browser data and >500kB chunk warnings remain; no unrelated optimization was attempted.
- Security limitation: Java and a cached Firebase emulator were unavailable, so emulator/rules/production-auth verification remains outstanding. The strict optimistic-retry fake covers handler conflict/commit-failure intent only and is not evidence of deployed Firestore rules or cloud readiness.

## IMPL-006 — Rollout note accuracy correction — ACCEPTED locally

- Revision: corrected the demo documentation to use relative `/yum-donut/?yumpals=demo` with the active printed Vite port (parent review server: 5173; this implementation's separate server had used 5174). The note now distinguishes normal Firebase/auth module initialization from the absence of YumPals pet/account database operations.
- Revision: corrected the persisted namespace description to `config/settings` and `config/settings/audit`; documented that `firebase.json` uses the `teams` codebase and that a broad `functions:teams` deployment would include the existing Teams export. The command is intentionally not invented; deployment requires a reviewed codebase-qualified selector for only the five YumPals exports.
- Revision: added the Firestore overlapping-allow warning: a new deny-style rule cannot override a broader existing allow because matching allows are ORed. Emulator, rules, claim, staging, deployment, and production verification remain pending parent review.

## IMPL-007 — Final small UI guards and verified selector — ACCEPTED locally

- Revision: milestone room copy now shows `Ready on next care` when stored-only rewards are waiting to be awarded, never a negative `-N` count after a growth-speed change.
- Revision: added validated controlled-date parsing. Empty/invalid native date input is ignored so the last valid demo date remains selected; invalid dates cannot reach `Intl.DateTimeFormat` and crash the page. Added a focused regression for empty, impossible, fallback, and valid date keys.
- New evidence: the Firebase CLI selector parser was independently verified for the `functions:teams:<export>` form. The rollout document now includes all five verified selectors and avoids the broad codebase target.
- Final measured results after this revision: root bank/YumPals tests 9/9 in 384.186ms; functions/Teams/YumPals tests 23/23 in 522.404ms; root lint exit 0 with only the existing stale `baseline-browser-mapping` warning; functions lint exit 0; production build exit 0 in 1.84s with 1692 modules. Assets: `index-6VsuxJJm.js` 801.98kB / 236.22kB gzip and `index-CUYuo-A0.css` 65.48kB / 11.92kB gzip. The build still reports the pre-existing stale browser-data and >500kB chunk warnings.
- No deployment, push, live data mutation, Java/emulator installation, dependency upgrade, or parent acceptance was performed.

## FINAL-001 — Independent parent acceptance — ACCEPTED for local preview; live activation REFUSED pending prerequisites

- Reviewer independently reran final code: frontend/bank/sprite tests 9/9 (144.30ms), backend/Teams tests 23/23 (142.89ms), both lint commands exit 0, production build exit 0 (5.46s, 1692 modules), `git diff --check` exit 0. Elapsed build time varies with machine load; this is not a runtime-performance benchmark.
- Final artifacts: `index-6VsuxJJm.js` 801.98kB /236.22kB gzip; `index-CUYuo-A0.css` 65.48kB /11.92kB gzip. Versus gold standard: JS +25.20kB (+7.24kB gzip), CSS +8.21kB (+2.27kB gzip). Existing browser-data/large-chunk warnings retained; no dependency changes.
- Additional independent read-only Node check: 1,084 client/backend comparisons passed across growth speeds, days, stored rewards and DST date keys.
- Browser measurements: 390x844 viewport has exactly 390px content width; egg/buttons fit; adoption, daily feed/pat, keyboard navigation/preferences, holiday and disable preservation checked in temporary demo. Normal app Bank, Arcade menu and Settings render with cloud gate OFF; browser errors empty during that smoke check. Detailed evidence and historical refusals: YUMPALS_REVIEW.md.
- Protected baseline files unchanged: authIdentity, bankBalance and its tests, Teams service/replies/bot/tests, package manifests/lockfile, firebase.json. Existing App behavior receives only narrow YumPals integration; no financial handler edits. Existing backend Teams handler unchanged; only additive callable exports/imports.
- Production activation is NOT accepted: real Firestore rules/overlapping permissions, teacher claim setup, emulator/auth integration and staging tests remain outstanding. No deployment or push performed. No deliberate live account, balance or pet record writes; normal app browser startup retains its existing background sync behavior.
- All seven final implementation groups above are accepted as a disabled-by-default local implementation, not certified cloud readiness. Historical refused approaches remain refused; each revision above is linked to new review evidence rather than restarting an old attempt.
- v1 preview scope: original pixel pets/casing, feed/pat, cumulative stages and simple reward indicators, teacher rollout settings. Donut purchases/payouts, student-drawn assets and gallery remain excluded. Temporary demo is not cross-device persistence; authoritative persistence must be staged before student rollout.
