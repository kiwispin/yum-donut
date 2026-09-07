# YumPals implementation and review log

## PLAN-002 — Full paid-care proposal — PENDING user approval of defaults

- User requested a revised plan, not coding. Created YUMPALS_PAID_CARE_PLAN.md and marked the old YUMPALS_PLAN.md as historical. User's direction supersedes free care and cosmetic-only nap, the restricted feed/pat activity set, and continual idle foot movement. Existing code remains unchanged in this pass.
- Proposed coverage: meals/snacks, direction game, status, cleaning, medicine, sleep/lights, gentle discipline/attention, pat and growth; simple stationary blob with action-specific pixel frames. Costs/restoration/decline/calendar/adoption and recovery limits explicitly marked as proposals.
- Read-only findings: separate wallet/bank balances and private/public profile mirrors; public-wallet shop handler; current audit classifier may count non-Shop outgoings as Given; verified UID mapping and shared wallet permissions are required before pet debits. The prior pet-only candidate is insufficient for secure wallet spending. No live balances inspected.
- Arithmetic review: maximum default meter recovery 4 hunger +4 happiness +2 cleanliness +4 health =14 donuts; one reminder and bedtime routine total16, excluding adoption/optional items and intervening decline. Not measured affordability or approved pricing.
- Reference check: Bandai official original-programming description confirms direction guessing and core care activities. Original behaviours distinguished from proposed school/economy adaptations. No claim of frame-perfect replication.
- Verification is documentation-only: scoped diff and whitespace check; no runtime test/build or new security certification claimed. Prior gold tags and a0465d1 preserved. No application/configuration/UI state/live data changes, no deployment or agent coding dispatch. Implementation approval remains outstanding.

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

## IMPL-008 — Settings visibly replaces room and restores focus — ACCEPTED locally

- Finding: selecting Settings appended its card below the device and growth section without focus or scrolling, making the action appear inert. Revised hypothesis: an exclusive visible panel with explicit focus makes both direct Settings and hardware Select immediately apparent.
- Scope: `src/yumpals/YumPalsView.jsx` only, plus this appended entry. The room/adoption wrapper is hidden while settings is visible, preserving its DOM and component state. Direct Settings, hardware Select, and pre-adoption Teacher settings share an opener that remembers the activating button. The settings heading receives focus and scrolls into view; top/bottom Back buttons and panel-local Escape restore the room and focus to that opener. Drafts and pet progress remain in the existing component state. Native Tab, Enter, and Space behavior is unchanged; no modal focus trap or new global keyboard interception was added.
- Measured verification: root lint exit 0; existing frontend/bank/sprite tests 9/9 in 99.246ms; production build exit 0 in 812ms, 1692 modules; `git diff --check` exit 0. JS `index-CEim1V1d.js`: 802.58kB /236.41kB gzip; CSS unchanged at 65.48kB /11.92kB gzip. Existing browser-data and large-chunk warnings remain.
- These existing tests exercise care/date/progression regressions, not DOM focus or scrolling. Parent browser verification is pending for direct Settings, Cycle-to-Settings plus Select, Back/Escape focus restoration, unsaved draft preservation, and normal keyboard navigation. No backend/configuration changes or deployment were performed in this revision.

- Parent verification completed: direct Settings replaces room with panel and focused heading; hardware Select with Settings highlighted also opens it; Escape restores respective opener focus; Enter reopens, retaining an unsaved name draft and unchanged pet. Original off-screen-panel approach is REFUSED on new user-reported evidence. This revision is ACCEPTED locally.

## SEC-001 — Read-only production rules inspection — ACCEPTED finding; current rules REFUSED for YumPals activation

- Exact release: `projects/yum-donut-school/releases/cloud.firestore`; ruleset `7b40979e-05c0-46de-8631-41bdc54ac695`, updated 2025-12-19T08:45:42.181400Z. Retrieved through authenticated Rules API GET calls only. No rules or student data writes.
- Existing global rules permit public reads and all writes when request.auth is non-null, including anonymous Firebase identities. These overlapping grants would bypass intended pet callable enforcement; adding a separate deny would not override them.
- Scope: test a candidate that preserves legacy access outside the new pet subtree and denies direct client access within it. Candidate is NOT a live deployment. Existing broader legacy security remains outside this narrow change and must not be described as secure.
- Available Firebase projects include production YumDonut and an unrelated app, no YumDonut staging project. Use `demo-yumpals-stage` emulator only; no cloud project creation or use of unrelated project.

## SEC-002 — Isolated staging runtimes — ACCEPTED setup

- Official Adoptium Java21.0.12.1 JRE archive SHA256 verified: `dec50fc6f9fcd4fe3ae8cabf5a5fa68f6afc48841f7698e468e9aa5d54beed84`.
- Official Node22.23.2 macOS ARM64 archive SHA256 verified: `61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6`.
- Extracted only to `/tmp/yumpals-java.aAqx58`; no system-wide installs. Firebase CLI downloaded Firestore emulator1.19.8 to its normal cache. Root app/backend dependencies unchanged.
- Local emulator verification pending. Parent reviewed Settings while Luna builds isolated security tests.

## SEC-003 — Real local security stage and independent review — ACCEPTED locally; cloud activation remains REFUSED

- Luna Extra High implemented the isolated verification fixture/harness; parent reviewed and ran it. An initial cleanup `return` that could suppress failure was REFUSED. Luna corrected it; new deliberate-failure evidence below validates the revised cleanup, not the refused approach.
- Real Auth/Functions/Firestore emulator run: exit 0, 66 checks, 26,921 ms. Baseline fixtures demonstrate unsafe access; candidate denies direct pet reads/writes (403), preserves representative legacy access (200), and passes callable UID separation, admin gating, duplicate/concurrent care with exact audit counts, server-date authority, disabled preservation, and corrupt-state fail-closed checks.
- Cleanup sentinel: expected exit 1 with deterministic error, no PASS marker, owned emulator ports closed. The Auth emulator accepts forged JWTs; this is explicitly a limitation, not evidence of production signature verification. Fixture dependency warning is documented; existing installed dependencies resolve successfully without upgrades.
- Parent regressions: frontend 9/9 in 104.33 ms; backend/Teams 23/23 in 107.47 ms; both lint commands exit 0; build exit 0 in 823 ms, 1692 modules. JS `index-CEim1V1d.js` 802.58 kB /236.41 kB gzip; CSS `index-CUYuo-A0.css` 65.48 kB /11.92 kB gzip. Existing browser-data/chunk warnings remain. Diff whitespace check passed.
- Google Rules API non-deploying test: HTTP 200, empty response body/no issues. Follow-up read confirms live release still points to `7b40979e-05c0-46de-8631-41bdc54ac695`, update time 2025-12-19T08:45:42.181400Z. No rules deployment, live claims, student data, or production configuration changes.
- Current acceptance: Settings fix and local candidate verification accepted. Cloud staging unavailable without a separate authorized project. Candidate protects only the new pet subtree; existing broad legacy permissions are NOT certified safe. Production activation remains refused pending cloud verification and reviewed rollout. Gold-standard tags retained; no prior refused application changes repeated.

## IMPL-009 — Minimal blob animation revision — PENDING parent visual review

- Date: 2026-09-07 (Pacific/Auckland). Coder: Luna Extra High; parent visual review remains outstanding.
- Scope: `src/yumpals/YumPalsView.jsx`, `src/yumpals/yumpals.css`, `src/yumpals/yumpalsSprites.js`, and `src/yumpals/yumpalsSprites.test.js`. No backend, rules, account/financial logic, package dependencies, deployment, commits, or persisted-state migration/reset.
- Revision: replaced the three elaborate creature drawings with one original 16x16 pixel blob geometry while retaining `mossbit`, `pufflet`, and `emberoo` IDs and the existing `availableSpecies` contract; species now differ only by palette. Removed emoji animation/status/reward substitutes and retained code-native pixel marks.
- Revision: added deterministic idle A/idle B/blink frames; feed sequence is open/3 → closed/2 → open/2 → closed/1 → open/1 → closed/0 → happy with 320–350ms bite holds and a 520ms happy hold. Food is one exported 8x8 pixel snack grid with 3/2/1/0 segment variants. Pat is a successful-action happy pose with the exported pixel heart. Sleep alternates closed-eye `Z`/`Zz`; wake uses a wide-eye pose then happy.
- Revision: added local-only Nap/Wake cosmetic rest. It does not call care, change the date, alter care days, award rewards, or persist state. Pat remains labelled `Pat` because no separate play mechanic was added. Existing feed/pat limits and cloud/demo writes remain unchanged.
- Revision: action animation starts only after successful demo care or a complete cloud call plus refresh; duplicate, blocked, failed, or refresh-error paths do not start it. Non-looping feed/pat/wake animations have a shared UI and handler busy guard, including hardware Select; pending saves also guard Nap/Wake. Animation and notice timers clean up on unmount. Reduced-motion action poses hold briefly then return to idle; reduced-motion idle/sleep loops remain static.
- Focused evidence: 12/12 `node --test src/yumpals/*.test.js` passed in 80.118ms, covering compatible species keys, rectangular grids/palettes, food decrement-on-close, idle/pat/sleep/wake sequences, lifecycle tokens, and reduced motion. `git diff --check` exit 0. `npm run lint` exit 0 with only the existing stale `baseline-browser-mapping` warning.
- Production build evidence: `npm run build` exit 0 in 763ms; 1692 modules transformed; assets `index-otZk3Wt8.js` 806.89kB / 237.88kB gzip and `index-CHvXZ0o8.css` 67.32kB / 12.27kB gzip. Existing stale browser-data and >500kB chunk warnings remain; no unrelated optimization was attempted.
- Parent browser review target: `http://127.0.0.1:5173/yum-donut/?yumpals=demo`. Please verify the shared blob/palette variants, readable 2.5s feed sequence and single segmented snack, busy blocking for direct buttons and hardware Select, pat heart, cosmetic Nap/Wake with unchanged care state, reduced-motion finite action pose, and direct/hardware Settings focus restoration. Acceptance is pending this visual review; no deployment or live data mutation was performed.

## IMPL-010 — Browser follow-up visual corrections — PENDING parent visual review

- Date: 2026-09-07 (Pacific/Auckland). Follow-up to IMPL-009 based on parent’s first browser feed screenshot; no scope expansion.
- Revision: the custom food-grid class now explicitly renders its 8-column pixel grid and positions the single segmented snack beside the blob rather than centered over its feet/body.
- Revision: Nap/Wake now has a light backed button, dark primary text, darker supporting text, border, and small shadow so it remains readable on the Berry shell.
- Measured verification: `git diff --check` exit 0; `npm run lint` exit 0 with the existing stale `baseline-browser-mapping` warning; `node --test src/yumpals/*.test.js` 12/12 passed in 77.533ms; `npm run build` exit 0 in 760ms with 1692 modules. Build assets: `index-jq6tGbrh.js` 806.89kB / 237.88kB gzip and `index-Co6Ey_hu.css` 67.45kB / 12.30kB gzip. Existing stale browser-data and >500kB chunk warnings remain.
- Parent retest target: `http://127.0.0.1:5173/yum-donut/?yumpals=demo`. Acceptance remains pending parent visual confirmation of food visibility/placement and Nap/Wake contrast; no deployment or live data mutation was performed.

## IMPL-011 — Final responsive pixel-layout corrections — PENDING parent retest

- Date: 2026-09-07 (Pacific/Auckland). Follow-up to IMPL-010 from parent’s static mobile review; focused layout-only correction.
- Revision: the base 16-column pixel grid now uses `width: 100%` and `height: 100%`, so it tracks the responsive sprite’s 160px desktop and 128px mobile dimensions while preserving integer pixel cells.
- Revision: the pixel heart is right-anchored within the sprite (`right: 4px`) instead of using a fixed 112px left offset, preventing mobile overflow. The segmented food placement remains beside the blob.
- Revision: Nap/Wake’s pixel mark now owns a fixed 16px layout box and renders its shadow through a pseudo-element, preventing the active icon from overlapping the label.
- Parent browser evidence before this static correction: feed mouth/food sequence passed with filled-pixel counts 28 → 22 → 14 → 0 on closing frames; pat heart, sleep `Z`/`Zz`, unchanged one care day, Settings focus, and reduced-motion wake recovery all passed. Final retest should confirm only responsive grid sizing, heart anchoring, food bounds, and Nap/Wake spacing.
- Measured verification: `git diff --check` exit 0; `npm run lint` exit 0 with the existing stale `baseline-browser-mapping` warning; `node --test src/yumpals/*.test.js` 12/12 passed in 81.346ms; `npm run build` exit 0 in 757ms with 1692 modules. Build assets: `index-D-gWQQ9N.js` 806.89kB / 237.88kB gzip and `index-BUGB-LMr.css` 67.57kB / 12.33kB gzip. Existing stale browser-data and >500kB chunk warnings remain.
- No backend, rules, account/financial logic, dependencies, deployment, commits, or persisted-state changes were made. Parent acceptance remains the final disposition after the focused retest.

## FINAL-002 — Parent animation acceptance — ACCEPTED locally

- User-approved simplification is recorded in YUMPALS_PLAN.md: one original 16x16 blob with palette-compatible species IDs, discrete feed/pat/idle/sleep/wake frames, and no new financial or saved sleep mechanics. Luna Extra High performed all application/test code changes; parent reviewed and updated the design contract.
- Historical drafts REFUSED on new evidence: food decrement during mouth-open instead of close; food-grid class without grid layout (invisible snack); low-contrast Nap label; fixed 160px inner grid under a 128px mobile container; Wake icon overlapping its label. Revisions IMPL-009 through IMPL-011 resolve these findings and are now ACCEPTED locally. No refused approach was restarted unchanged.
- Independent browser capture observed open/closed mouth pixels while filled food pixels decreased 28 → 22 → 14 → 0 on closing bites, followed by happy finish and idle. Pat remained disabled throughout feeding and re-enabled afterward. Successful pat displayed happy eyes and a 25-cell heart grid; completion changed the temporary pet from zero to exactly one care day.
- Sleep alternated Z/Zz with closed eyes; wake changed expression without changing the one care day. Reduced-motion sleep stayed static; reduced-motion wake released its busy guard and returned to idle. Direct and hardware Settings both focused the settings heading; Back/Escape restored the respective opener. Browser error log was empty.
- Final mobile measurement at 390x844: content width 390, sprite/grid both 128px; device bounds x16–374, screen x60.20–329.80. Wake button fit within x119.59–270.40 with corrected icon spacing. Temporary viewport override reset after review. Fresh temporary Niblet left in review tab with Feed/Pat available; no real account was reset.
- Final parent frontend/bank/sprite tests: 14/14 in 89.16 ms. Unchanged backend/Teams tests: 23/23 in 125.51 ms, backend lint exit 0. Final frontend lint/build/diff checks exit 0; build 743ms, 1692 modules. JS `index-D-gWQQ9N.js` 806.89 kB /237.88 kB gzip; CSS `index-BUGB-LMr.css` 67.57 kB /12.33 kB gzip. Existing browser-data/large-chunk warnings remain.
- Exact source change scope is four src/yumpals UI/style/sprite/test files plus the plan and this log. Backend, auth, bank, Arcade, gifting, Teams, rules, dependencies and production configuration unchanged. No push/deployment/cloud project creation or live data mutation. Prior gold-standard tags and d31f216 checkpoint preserved. Local visual acceptance does not resolve the separate cloud-staging/security rollout prerequisites.

## IMPL-012 — Reference-faithful paid-care handheld correction — PENDING parent browser review

- Date: 2026-09-07 (Pacific/Auckland). User resumed the existing Luna Extra High worktree after parent review; no restart, commit, push, deploy, cloud spend, live wallet write, account write, or backend/rules change.
- Historical attempt recorded: the first isolated demo route used a primary `TOP_MENU` word list with `screen="menu"`, menu rows, and a selection arrow. The route was browser-routable and the menu was keyboard/native-button testable, but the approach is REFUSED after direct inspection of the official Gen 1 manual page 1. That reference keeps the pet visible with four top icons (food, lights, game, medicine), four bottom icons (clean, status, discipline, attention), and three physical A/B/C buttons; it has no primary word menu.
- Correction: removed the primary word-list path and added code-native 8x8 icon definitions/tests in `src/yumpals/paidCareIcons.js` and `src/yumpals/paidCareIcons.test.js`. The fixed order is food/lights/game/medicine over clean/status/discipline/attention; all eight grids are unique, rectangular, palette-valid, and use integer cells. Attention is now a paired-face/call mark rather than a second lightbulb; clean is a side-profile duck mark. `YumPalsHandheldDemo` keeps the pet and rails visible while A cycles the selected icon, B invokes it, C clears/returns, and native focused buttons do not double-fire through the global key handler. Food/Play/etc. remain compact secondary paid choices; Settings is an outside-device uncharged utility and is not a care icon.
- Corrective behavior retained/finalized: paid game benefit is delivered once at purchase, never on finish; every game result carries a valid target; reveal holds the actual round number and target after the guess while the pre-guess pet remains neutral, including the final reveal screen; pause/resume and local-day advance preserve the paid game entitlement. The care estimator uses cheapest meter units and the recovery sequence verifies the planned 14-care / 16-with-reminder-and-bedtime totals. Bedtime now tracks the purchased sleep session date, remains dim/duplicate-blocked from 00:00 through 06:59 across the date boundary, wakes at 07:00 without a charge, and does not confuse a previous evening with a new daytime purchase.
- Corrective visuals retained/finalized: still idle feet with a real blink sequence; no duplicate pat heart; one shrinking edible food prop; integer 32px food and 35px heart grids; clean has three discrete broom positions with the mess disappearing; medicine/reminder use visible expression/prop states; action busy time is derived from the animation sequence so the feed tail cannot unlock controls early; bedtime dim is state-derived. The three round buttons remain inside the egg casing. Warning copy now limits its claim to pretend donuts and no pet/account database writes; reload-reset and same-open-session game resume are stated.
- Local-only scope stayed bounded to `src/App.jsx`, `src/yumpals/YumPalsHandheldDemo.jsx`, `src/yumpals/paidCareDemo.css`, `src/yumpals/paidCareDemo.js`, `src/yumpals/paidCareDemo.test.js`, `src/yumpals/paidCareIcons.js`, `src/yumpals/paidCareIcons.test.js`, and the existing sprite files/tests. Parent-owned `YUMPALS_PAID_CARE_PLAN.md` and `YUMPALS_HANDHELD_REVIEW.md` were not edited in this correction.
- Measured verification on this revision: `node --test src/yumpals/*.test.js` passed 22/22 in 53.272917ms, including icon order/geometry, game start → exit/resume → finish with exactly one benefit/debit, full 14-donut recovery, and bedtime after-midnight duplicate/wake behavior. `npm run lint` exited 0 with only the existing stale `baseline-browser-mapping` warning. `npm run build` exited 0 in 558ms with 1696 modules; assets were `index-DN4aL-8O.js` 835.62kB /245.97kB gzip and `index-Dj7UlH-2.css` 77.84kB /14.44kB gzip. `git diff --check` exited 0. Existing stale browser-data and >500kB chunk warnings remain; no unrelated optimization was attempted.
- Disposition: implementation is stable for parent’s routed browser review, not claimed perfect or accepted yet. Parent should visually inspect icon silhouettes/order, pet visibility while cycling, secondary choice flow, neutral/reveal game timing, bedtime dim/wake, and the restrained shell. No commits or pushes were made.

### IMPL-012 follow-up corrections — measured and browser-verified, parent final review pending

- Corrected the CSS cascade that had allowed the later base `.paid-pixel-grid` rule to override icon sizing. `.paid-pixel-grid.paid-icon-grid` now hard-bounds each 8x8 icon to 24x24px (3px cells); the routed browser measured all eight icon boxes at exactly 24x24px. The 16x16 game sprite preview is 80x80px (5px cells), and 5x5 meter hearts are 15x15px (3px cells).
- Corrected the Game icon mapping from the nonexistent `game` submenu key to the existing `play` secondary menu. Added a pure mapping export and regression covering Food, Lights, Game, Medicine, Clean, Discipline, and the intentional non-menu Status/Attention icons. Browser review confirmed Game opens GAME/PAT/BACK; Medicine, Reminder, Clean and the other paid flows remain reachable.
- Room C now clears the selected icon once and then no-ops; it no longer invokes the old route-exit callback. The standalone App wrapper no longer passes that callback. The global keyboard effect now includes `gameReveal` in its dependencies, and A/B input is locked for the reveal hold while C can still pause.
- Added a distinct purchased-bedtime night class so a paid sleep session is visibly darker than ordinary night while remaining legible. The date-boundary helper/test continues to assert active at 00:30 and 06:59, awake/inactive at 07:00, with wallet and receipt count unchanged.
- Parent browser evidence for this follow-up: icon rails corrected to integer-sized pixels; A cycles all 8 icons while the pet remains visible; Meal C-cancel preserves wallet 25; Game mapping, pause/resume/three-round finish, one `-2` receipt and exactly +2 happiness; no-funds remains at wallet 0; Medicine -2 and Reminder -1 props; three clean patterns; bedtime wallet 24 across 00:00/06:00/07:00 with wake and no repeat charge. No crash was observed.
- Final local measured verification after these corrections: `node --test src/yumpals/*.test.js` passed 23/23 in 56.747583ms; `npm run lint` exited 0 with only the existing stale `baseline-browser-mapping` warning; `npm run build` exited 0 in 472ms with 1696 modules. Assets were `index-BcclrB7i.js` 835.76kB /245.98kB gzip and `index-CedK3u8x.css` 78.06kB /14.50kB gzip. `git diff --check` exited 0. Existing stale browser-data and >500kB chunk warnings remain.
- Disposition remains PENDING parent final mobile/idle review. This log records local and parent-supplied evidence; it does not claim production readiness or a blanket visual-perfect result. No commits or pushes were made.

## FINAL-003 — Icon-first handheld parent acceptance — ACCEPTED locally only

- Parent review recorded in new `YUMPALS_HANDHELD_REVIEW.md`, including refused attempts and measured corrections. Luna Extra High implemented application/test code; parent reviewed the official manual visually, exercised the routed browser and updated review/plan records.
- Final parent checks: eight-icon cycling preserves pet; C clears/no-ops; meal cancellation25 and single Enter payment23; food28→22→14→0 with busy guard; three cleaning frames; medicine/reminder props; working uncharged Preferences; game pause/resume/completion one debit and one benefit; first reveal correct ROUND1 and locked input; midnight sleep/wake no repeat charge; paid-night colour visibly distinct; no-funds no debit.
- Idle lower-body patterns1 across6.1seconds. Mobile390×844: document width390, casing x26.40–363.60, sprite128px, icons24px; game sprite80px. Viewport reset after visual inspection.
- Independent final frontend/bank tests25/25 in52.328625ms; lint/build/diff-check exit0. Build472ms,1696modules; JS835.76kB/245.98gzip, CSS78.06kB/14.50gzip. Existing stale browser-data/large-chunk warnings retained. Backend unchanged, earlier independent23/23 and lint0 evidence retained.
- Acceptance covers the disposable local demo, not production security, persistent transactions, or deployment. No account, bank, gifting, Arcade, Teams, backend/rules or production-config modification. Gold-standard tags and pre-prototype checkpoint retained. No push or deployment.

## IMPL-013 — Permanent original button labels — PENDING parent review

- User rejected the casing label CYCLE and dynamic LEFT/RIGHT/WAIT/OK/BACK labels. Casing text and accessible names now remain exactly `A SELECT`, `B CONFIRM`, `C CANCEL` across room, care, game and busy states. Generic LCD help uses the same wording; payment confirmation and game direction/pause instructions remain contextual inside the LCD. Handlers, guards and economy behavior are unchanged.
- Scope: text in `src/yumpals/YumPalsHandheldDemo.jsx`, removal of its unused dynamic label variable, a focused `paidCareHardwareLabels.test.js` source-contract regression, and this appended entry. The regression verifies three fixed visible labels and matching ARIA names regardless of conditional handlers, plus retained LCD game directions.
- Measured: frontend/YumPals/bank tests 26/26 in 75.625584ms; lint exit 0; build exit 0 in 451ms, 1696 modules; diff whitespace check exit 0. JS `index-fR8d7YIn.js` 835.68kB /245.89kB gzip; CSS unchanged at 78.06kB /14.50kB gzip. Existing browser-data and large-chunk warnings remain. Parent visual review pending; no commit or push.
- Parent disposition: ACCEPTED locally. Browser screenshot confirms SELECT / CONFIRM / CANCEL fit the three casing buttons; accessibility names match. A selection, B opening Food, C returning, and matching submenu help verified with wallet25 unchanged. Changes are text-only; prior rollback checkpoints retained.

## IMPL-014 — Icon explanations and outside how-to guide — PENDING parent review

- User approved this usability attempt: short plain-English icon label/description below the casing, matching explanatory hover titles and keyboard-focus help, and a collapsed How to play guide outside the toy. All eight icons share the same description source; each has its own `aria-describedby` text. Hover/focus temporarily explains the target and falls back to the selected icon when released. A selection and direct taps use the existing selected-icon state.
- Guide covers A SELECT / B CONFIRM / C CANCEL, all eight functions, free Status/Attention checks, price confirmation before a pretend charge, Needs care for first try, and game pause/resume. Icon rails, central pet, fixed casing labels, payment handlers and reducers are unchanged. Scope: demo component/CSS, icon help definitions/tests and this log; checkpoint da8da96 preserved, no commit or push.
- Verification: frontend/YumPals/bank tests 27/27 in 61.8585ms, including selected/hovered/focused help for every icon, fallback/clear behavior and free-check descriptions. Lint/build/diff checks exit 0; build 461ms, 1696 modules. JS 837.33kB /246.48kB gzip; CSS 78.28kB /14.56kB gzip. Existing browser-data/chunk warnings remain. Parent browser review of helper placement, focus and hover is pending.
- Requested legend follow-up: each guide name now includes the matching existing `PaidCareIcon` in a relatively positioned, non-shrinking 24x24px wrapper. Name rows use flex alignment; icons retain the specific 24px grid sizing. No other behavior changed. Verification: 27/27 tests in 63.057125ms; lint/build/diff checks exit 0; build 462ms. JS 837.42kB /246.49kB gzip; CSS 78.41kB /14.58kB gzip. Existing warnings retained; parent visual review pending, no commit.
- Parent found stale pointer hover masking keyboard focus (Food hovered, Tab to Lights). That precedence behavior is rejected. Icon focus now clears stale hover before setting the focused target; subsequent mouse entry still takes precedence. Focused regression executes the component's focus callback with Food hovered and Lights receiving focus, then verifies a fresh Medicine hover. Tests 28/28 in 57.004167ms; lint/build/diff checks exit 0; build 449ms. JS 837.43kB /246.50kB gzip; CSS unchanged. Parent retest pending, no commit.
- Final parent verification: clicking Food then Tab focuses Lights and displays Lights help while Food stays selected and wallet remains 25. All eight A-selection descriptions match; legend contains eight actual 24px icons; mobile viewport/document width both 390px. These requested usability corrections are verified locally. Final tests 28/28 in 55.806333ms; lint/build/diff checks exit 0; build 361ms, 1696 modules, assets unchanged from the preceding run. Existing browser-data/chunk warnings retained. Work stopped as requested; checkpoint da8da96 preserved, no commit or push.
- Parent disposition: ACCEPTED locally. Independent full frontend/bank suite28/28 in61.072083ms; lint/build/diff checks exit0, build451ms. Desktop guide and mobile helper visually reviewed; viewport override reset. No wallet/payment logic, cloud data or production configuration changed. No deployment.

## IMPL-015 — Plain pet-care language audit — PENDING final parent review

- User rejected developer language in the student experience. Audited the isolated component, reducer validation messages and all eight icon descriptions. Changed categories: full/not-needed meal, snack, game, pat, clean, medicine and reminder refusals; unavailable/no-pet/paused-game/duplicate-bedtime warnings; exact insufficient-funds and remaining-care-spending messages (including singular donut); price/effect confirmation; adoption and care success notices; game guessing/results/pause copy; FOOD/HAPPY/CLEAN/HEALTH status labels and settled/reminder text; receipt display; settings instructions; header, currency summary and temporary-demo boundary; guide/hover/focus help; and demo-control notices.
- Food hearts consistently mean being fed, never becoming hungrier. Effects show exact partial heart gains before payment; reminder and bedtime use short descriptions rather than a spurious +1 flag/schedule label. Receipt display omits raw DELIVERED status without altering receipt data. Fixed A SELECT/B CONFIRM/C CANCEL labels remain. Technical scenarios, clock and recovery diagnostics stay inside the separate Demo controls. No payment/care behavior, raw receipt status, CSS, backend or routing changes; baseline61ff47e retained.
- Regression coverage: contextual no-op text for all seven need-based actions with identical state/no charge; exact remaining allowance at24 where a2-donut meal is refused but a1-donut snack remains allowed; insufficient funds and duplicate bedtime; all eight effect descriptions including a partial1-heart meal. Parent browser evidence: full-meal refusal leaves25; Food/Happy/Clean/Health readable; mobile meal confirmation cost2/left23/+2Food hearts fits.
- Final measured results: frontend/bank31/31 in82.494291ms; backend23/23 in64.746792ms; root lint, build and diff checks exit0. Build474ms,1696modules; JS838.50kB/246.93kB gzip, CSS unchanged78.41kB/14.58kB gzip. Existing browser-data/chunk warnings remain. Parent final review pending; no commit, push or deployment.
- Final copy clarification: replaced ambiguous RIGHT! with CORRECT! in both direction reveal and final result, keeping LEFT/RIGHT exclusively directional. Frontend/bank31/31 in71.924208ms; lint/build/diff checks exit0, build449ms; asset sizes unchanged. No behavior changes or further scope; no commit.
- Parent browser verification: no-funds snack reads “This costs 1 pretend donut. You have 0. No donuts spent.” and balance remains0; Settings LESS MOVEMENT OFF / B CHANGE fits; full-meal refusal preserves25; mobile meal price/effect fits. Parent final pipeline is running and its result is not yet recorded here. Implementation edits stopped as requested; baseline61ff47e preserved, no commit or push.
- Parent disposition: ACCEPTED locally. Independent frontend/bank31/31 in63.626042ms; lint/build/diff checks exit0, build496ms, same assets. Successful meal still debits exactly2 (25→23) and reports +2 Food hearts; no-funds/refusal cases unchanged. Desktop/mobile copy reviewed, viewport reset, fresh Needs care example left ready. No real student transactions or deployment.

## IMPL-016 — Isolated paid-care server foundation — ACCEPTED for local integration testing

- 2026-09-08: user authorised readiness work. Baseline bba6390 preserved as `checkpoint-before-yumpals-production-integration-2026-09-08`; all original gold tags retained. Luna Extra High wrote additive engine/service, synthetic transaction fixture,22 new test cases and API/trust-boundary documentation; parent reviewed and owns the new `YUMPALS_PRODUCTION_INTEGRATION_LOG.md`.
- Engine handles whole completed Auckland school dates, DST, effective-dated holidays/absence/pauses, bounded long gaps, no-charge explicit migration preserving existing fields/progress, server-priced default care and persistent game entitlement. Service uses injected trusted UID paths/wallet adapter and atomic debit/pet/receipt transactions, config-bound operation replay, corruption rejection and exact saved/pre-care/post-care receipt states.
- Refused/revised during parent review: unawaited wallet-adapter call; receipt before-state conflating deterioration with purchased care; incomplete outer-owner validation; synthetic wallet replacement dropping unrelated fields. Fixes verified with rollback injections, unchanged bank/Given/metadata, exact receipt effects and identity tests. No unchanged refused approach was restarted.
- Parent engine10/10 in280.896ms, service12/12 in164.995417ms; full backend46/46 runner entries in271.917ms (45 actual tests plus fixture load), lint0. Root frontend/bank31/31 in121.627417ms; lint/build0, build817ms/1696modules. JS838.50kB/246.93gzip, CSS78.41kB/14.58gzip unchanged; existing browser-data/chunk warnings retained. Independent625-combination calendar calculation and duplicate/async-failure/disabled-state checks passed.
- Scope acceptance is synthetic local foundation ONLY. No production adapter, auth wrapper/export, app integration, real student charge, migration run, rules deployment or cloud test. Old66-check emulator evidence is not evidence for this new service. Game completion, paid growth/attention policy, configurable timing, durable client requests, receipts/refunds UI, teacher settings, old endpoint gating and legacy-wallet compatibility remain release gates, explicitly documented.
- Updated rollout guide prevents the old free-care deployment instructions being mistaken for paid release readiness. Separate staging project choice/authorisation is awaiting user response. No push/deployment/billing or live data changes.
