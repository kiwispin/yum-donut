# YumPals-only release log

## 2026-09-08 Title pixel pal trial

- ACCEPTED implementation, user visual acceptance pending: existing static mossbit idle sprite in48px pale-pink rounded tile beside centred title, both views. No device/behaviour changes. Rollback2514371.
- Measured81/81 tests214.832167ms; lint0; enabled build412ms. Browser390/1440px both views:48px tile,256 pixel cells,no overflow; phone header screenshot inspected. Publication pending.

## 2026-09-08 Remove redundant return buttons

- ACCEPTED: removed Back to app from both embedded YumPals views and unused icon import. Shared top navigation and device unchanged. Rollback0aa9b25.
- Initial test80/81: obsolete assertion required removed button. Updated assertion to prevent its return as explicitly requested; final81/81 passed235.78125ms, lint0, enabled build506ms. No backend or account changes. Published20e1393; live index-OwYgp19z.js SHA256 matches validated build.

## 2026-09-08 Stable guidance space

- REFUSED previous content-height panel: longer icon guidance moved the surrounding layout. ACCEPTED replacement: overlapping CSS grid reserves tallest actual guidance at current width/font size; hidden sizing text is aria-hidden, noninteractive and unselectable. Current guidance stays readable at14px. Both views updated; device and logic unchanged. Rollback35755f7.
- Measured81/81 tests249.027583ms, lint0, enabled build405ms. Browser320/390/1440px both views: nine A selections each, zero change in device/panel/help position or height (54 samples). Published7531b2f; first45s propagation check expired, subsequent read confirmed exact live JS/CSS hashes (index-C37351FB.js/index-o8PciaOR.css). No repeat deployment needed.

## 2026-09-08 Instruction emphasis

- ACCEPTED implementation: shared exterior instruction panel uses pale pink, stronger text and a subtle left accent (not a clickable button), with32px top spacing. Both Preview and student views covered; device/behaviour untouched. Rollback a3c0499. No refused approaches repeated; user visual acceptance pending.
- Measured frontend81/81 in259.4655ms; lint0; enabled build416ms/1715modules. Browser4/4 at390/1440px in both views confirms32px spacing, pink background,600 font weight, paragraph semantics and no horizontal overflow. Mobile screenshot visually inspected.
- Published cfe4311. ACCEPTED live verification: index-Bw_nDFMF.js and index-ieOdXvu7.css downloaded hashes exactly match validated build. No backend or live account changes.

## 2026-09-08 Full student guide and real care summary

- REFUSED omission: student help was abbreviated despite full Preview icon guide. ACCEPTED fix: all8 illustrated icon explanations drawn from existing saved labels/help, full A/B/C and conditional game instructions, offline/holiday explanation, real wallet balance and daily care-spend/cap. No fake starting balance or invented lifetime spending; unavailable wallet explicitly labelled.
- Frontend81/81 passed246.016583ms; lint0. Existing regression confirms pre-render behaviour, device markup and saved stylesheet unchanged. Browser actual saved fixture390/1440px verifies8 entries, real quote30 and care0/25, no demo wording/overflow; phone screenshot inspected. Game-not-ready fixture correctly uses fallback help; live guide follows existing gameReady flag.
- No backend/accounts/settings/payment actions changed. Existing hosting retained; rollback617f5ab. User visual acceptance pending.
- Publishedc3984a5; enabled build517ms/1715modules. Live index-bZJ5sNNw.js and index-DdF1MsIm.css hashes match validated dist. Fixture stopped.

## 2026-09-08 Saved-page surround parity

- REFUSED omission: approved exterior polish previously applied only to Preview. ACCEPTED fix: saved route now shares appSurround.css styling with Preview, same heading/card/help/control treatment and back button. Saved-specific explanatory text retained; no pretend-money badge/test controls on student page.
- Device JSX, original savedHandheld.css and all pre-render logic byte-equal to821d951, verified by new regression test. No saved-pet/care/payment changes. CSS exclusively targets outside elements, not LCD/device controls.
- Frontend81/81 passed228.852542ms; lint0; enabled build526ms/1715modules. Actual saved component fixture (synthetic quote, purchases explicitly refused) passed390/1440px white background, no horizontal overflow, refresh and help disclosure; screenshots visually inspected. No production account actions. Fixture verification/saved-surround.*.
- Existing hosting retained; rollback821d951. Publish only frontend; no server/settings/database updates.
- Published34347c0; live index-ByQvLgpr.js and index-Bi3X4q6R.css hashes match validated dist. Fixture server stopped.

## 2026-09-08 True overflow-only More

- ACCEPTED user clarification: every destination participates in priority row; no permanent secondary group. Measure total first without More, showing all when possible. Only when total exceeds width reserve More and move the trailing items into it. Existing style, eligibility and actions untouched.
- Frontend80/80 passed250.823792ms, lint0; browser320/390/1440px passed plus widened1200px container shows all11 items with no More, shrinking restores More. Enabled build508ms/1715modules. No backend/setting changes; previous273f6c5 retained for rollback. Existing hosting used.
- Published8dae1ba; live index-DSKEuB_r.js hash matches validated dist. Fixture stopped.

## 2026-09-08 Priority single-row trial

- User approved Give / Goal / enabled YumPals / Arcade / Bank / Shop / More. ACCEPTED trial: measure actual button widths and reserve More; trailing priority items move into disclosure before less-used items. Existing fonts/colours/buttons and all original visibility gates retained. No horizontal scrolling, wrapping or route changes. Earlier two-link-only layout superseded by user direction.
- Tests80/80 passed243.401041ms; lint0. Browser320/390/1440px passed priority row, destinations, dismissal, focus and no overflow; phone/desktop screenshots inspected. Hidden inert measurement row is inaccessible to keyboard/assistive technology.
- Enabled build528ms/1715modules. Existing hosting retained; no backend/settings/account changes. Rollback source92fed3e retained. User visual acceptance pending.
- Publishedc54cc2f; live index-D3O1pinC.js and index-DnaATKdY.css hashes match validated dist. Fixture stopped.

## 2026-09-08 Discoverable navigation menu trial

- User rejected scrolling arrows and approved Give / enabled YumPals / Menu disclosure while preserving existing look. ACCEPTED for trial: existing primary buttons/font/slate/pink underline retained; remaining supplied destinations in rounded white two-column panel. Preview remains supplied only by existing admin gate. Current secondary page labelled; selection/outside/Escape dismiss with focus return. No route, backend, pet or financial changes.
- Tests80/80 passed258.179959ms; lint0 after correcting cloneElement event focus handling that React lint misclassified as render-time ref access. Initial browser attempt refused connection because lint had prevented server startup; restarted only after correction. Initial patch rejected duplicate-path operations before any edits; reapplied as valid updates. No old scrolling/wrapping approach repeated.
- Browser verification/menu-check.mjs passed320/390/1440px: visible Pals, menu destinations, selection closes, Escape focus, outside dismissal, no horizontal overflow. Screenshots inspected. Old verification/navigation-check.mjs describes rejected scroll design and is superseded by menu-check.mjs.
- Enabled build530ms/1715modules; publish exact dist on existing hosting. Rollback source2a923a8 retained. Visual user acceptance pending.
- Published54a031e; live index--9-jxl43.js and index-DaMnjQdJ.css SHA256 match validated dist. Fixture server stopped.

## 2026-09-08 Holiday Mode clock connection

- ACCEPTED: existing Holiday Mode switch now calls teacher-authorized yumpalsSetHolidayMode; global holiday flag and protected timestamped pet-rest history update atomically with replay receipt. Rest excludes exact elapsed interval, including partial hours, without needing student visits. Care/game endpoints honor live mode; normal student-access flag stays independent.
- Only explicitly approved handleHolidayToggle exempted from baseline handler equality test. All other action comparisons retained. No unrelated account/financial changes. Unknown legacy switch/history disagreement freezes pet access; next teacher toggle reconciles conservatively, avoiding holiday penalties.
- Backend130/130 passed228.375916ms; frontend80/80 passed205.671959ms; lint0. Tests cover atomic abort, replay after opposite toggle, teacher permission, field preservation, exact offline interval and legacy flag mismatch. Emulator34/34 passed25655ms/cleanupPASS, logs /var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-R7wXNY. New callable transaction tested synthetically; no live Holiday Mode toggles claimed.
- Enabled frontend build575ms/1715modules. Existing hosting retained. Deploy new holiday callable and four existing pet/game endpoints only. No teacher settings endpoint, bank/gift endpoint or rules deployment. Rollback sourcef0b3edc retained; database histories must not be rolled back.
- COMPLETE source51ffc2c: all five selected deployments succeeded. New live holiday endpoint rejects unauthenticated403 without mutation. Live index-BiXkg699.js hash matches validated build. Existing Holiday Mode value left unchanged; no signed-in production toggle performed.

## 2026-09-08 Real elapsed care timing

- User approved real offline elapsed time, not monitored time or completed-school-day steps. ACCEPTED implementation: food loses1 heart/8h, happiness1/12h, clean1/24h, health1/24h only while food or cleanliness is empty. Weekends count; explicit calendar rest/holidays/absence/teacher-disabled dates remain frozen. Meters stop at0; no automatic charges/debt.
- Server-bound elapsedCare option enabled only in live app pet connection; old internal legacy path retained. Fractional elapsed counters are saved with the pet, using server timestamps. First encounter with an existing pet preserves its needs and establishes the clock, avoiding retroactive penalties. New adoption anchors immediately. Config digest includes elapsed mode so old quotes require reconfirmation.
- Preview uses the same intervals, tested against server needs, and catches elapsed minutes while mounted. Saved view refreshes each visible minute without interrupting pending purchases/confirmations. No graphics/CSS changed.
- Tests128/128 backend209.086541ms, frontend80/80 in193.411959ms; lint0 both. Includes24h offline, read partition equivalence, DST, weekends, rest intervals, existing-pet preservation, disabled/re-enabled service reads, and charge-once purchase after catchup with full wallet preservation on reads.
- Initial frontend run REFUSED old game test expecting only1 happiness loss/day; approved timing now loses2/day. Updated expectation, preserving same debit/receipt checks. Removed obsolete unused day helper after lint flagged it. No unrelated changes.
- Real emulator34/34 passed26556ms; cleanupPASS, logs /var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-cJljOE. Includes actual live-connection adoption/charge replay path with new clock. Timing scenarios separately covered by service/unit tests, not claimed as production student interactions.
- Deploy only the two YumPals state/purchase functions and enabled frontend. No setting activation, account changes, other endpoint deployments or real student charges. Existing hosting retained; rollback source9dd13cf remains available (new clock fields are additive).
- COMPLETE: source d884c9e, both selected server updates succeeded; frontend index-C9wsxl0t.js live hash matches validated build586ms/1715modules. Browser24h preview verifies1/2/3/4 hearts with balance25 unchanged. Local fixture stopped. No signed-in live student timing simulation performed.

## 2026-09-08 Mixed click/keyboard input correction

- ACCEPTED: preview icon clicks now reset navigation to the newly selected icon, clearing old menu/action selection without a charge. A/B/C keyboard shortcuts work after clicking handheld buttons in preview and saved UI. Native Enter/Space, text inputs, modifier keys and unrelated page buttons are preserved. Saved pending/animation locks retained.
- No appearance changes; CSS bundle unchanged. Exterior preservation test permits only the approved icon handler substitution while retaining exact markup comparison.
- Tests79/79 passed234.248542ms; lint0; enabled build556ms. Browser passed five transitions: icon-click/keyboardB, choice-click/keyboardA, switch icon without backing out, hardwareB, focusedEscape. No purchase. First browser test REFUSED due to incorrect case-sensitive selector Select Meal; corrected to existing Select MEAL, no application change for that fixture mistake.
- Existing hosting retained; no server, settings or wallet modifications.
- Published ce5690e. Live index-B21jlPXE.js hash matches validated build. Fixture server stopped. CSS remains index-CDGfgy5U.css.

## 2026-09-08 Preview exterior integration

- User explicitly approved handheld and prohibited changing it. REFUSED old grey demo surround, mismatched typography/square controls and repetitive explanation.
- ACCEPTED for publication pending user visual feedback: app-scoped white rounded card, slate heading, pink preview badge, rounded help/settings controls, concise exterior text and styled back button. Matches existing app white-card/slate/pink vocabulary. No global restyling or saved-device changes.
- Tests78/78 passed320.034125ms including exact handheld JSX block and original paidCareDemo.css equality against1649d82. Lint0; enabled build511ms/1713modules. Chromium fixture390/1440px passed heading/no horizontal overflow/disclosure checks; both screenshots visually inspected. Device visuals/logic unchanged; outer available width naturally responds to card padding.
- No backend/settings/balance changes. Existing GitHub Pages hosting retained. Browser screenshots /tmp/yumpals-surround-390.png and /tmp/yumpals-surround-1440.png; fixture verification/surround.*.
- Published47f18b5. Live JS index-CQeRx_8o.js and CSS index-CDGfgy5U.css hashes match validated local build. Fixture server stopped.

## 2026-09-08 Saved setting visibility correction

- REFUSED previous visibility: build readiness/auth eligibility alone displayed the saved activity even when school setting was off. Server charge enforcement remained separate; no change to payment logic.
- ACCEPTED: saved navigation/content now additionally requires an account-bound enabled server read. Unknown, off, error, guest or mismatched account hides it. Preview remains independent. Confirmed teacher-setting responses trigger a fresh read; settings open/close, foreground return and visible-page60s refresh reconcile other sessions. Existing route guard exits a hidden activity.
- Tests77/77 passed251.895334ms; lint0; enabled build820ms/1712modules. Browser hook fixture passed both-off, preview-only, saved-on, saved-off transitions. Synthetic fixture only, no live setting toggles or wallets touched. Saved setting can take up to60s to disappear on another already-open foreground session; server continues enforcing charges independently.
- Existing GitHub Pages hosting retained. Only frontend visibility wiring, tests and this log changed; no backend deployment or database writes.
- Published source16c61b4; live index-Clz5kbCv.js SHA256 matches validated build. Local fixture server stopped. No signed-in live toggle claimed.

## 2026-09-08 Single-row navigation refinement

- REFUSED by user: previous wrapping layout. Do not repeat it; technically resolved clipping but lacked visual polish.
- ACCEPTED for publication, pending user design feedback: single-line navigation with explicit previous/next controls, disabled end states, touch scrolling, visible keyboard focus, reduced-motion support and automatic selected-item visibility. Only navigation presentation changed.
- Tests76/76 passed326.767708ms; lint0; enabled build817ms/1711modules. Actual component browser fixture passed at390/768/1440px: one row, arrows reach entire preview label, preview selectable. Screenshots inspected at390 and1440. No real account interaction or payment.
- Initial browser launch failed because bundled Playwright expected an absent browser version; used existing installed Chromium1228 explicitly, with all three viewport checks passing. No installation or app change for that failure.
- Reproducible isolated fixture and browser check retained in verification/navigation*. No cloud connections. Existing hosting retained; source and database scope unchanged outside navigation.
- Published source a73f6fa. Live page serves index-BPsDglSt.js and downloaded SHA256 matches validated dist. Browser fixture server stopped. User visual acceptance remains pending.

## 2026-09-08 Preview navigation clipping

- ACCEPTED: replace hidden horizontal navigation overflow with wrapping rows; prevent individual labels shrinking. Full YumPals preview label retained. No action handlers, backend, settings or balances changed.
- New navigation regression test included: 76/76 src/yumpals tests passed in339.777583ms; lint exit0; enabled production build813ms/1709modules. Existing dependency-age and bundle-size warnings unchanged. No signed-in browser interaction claimed.
- Rollback frontend: dec15ed5d0317487be0f25bb81c5f015300fee1a verified as remote head before publishing. Publish exact validated dist with all three YumPals flags enabled. Existing GitHub Pages hosting retained; no new hosting service.
- Published source c5595d6 to gh-pages459fda489d571bb44feb423cc97fc40f4088c8d1. Live page now references index-BipXHyhe.js; downloaded bundle SHA256 matches the validated local build. ACCEPTED live delivery. No database or enablement changes.

## Scope correction

User explicitly parked the broader bank, gifting, sponsorship and other shared-system rebuilds. They remain saved on codex/yumpals-module, checkpoints55a63d3 andc040957. Do not publish that checkout as the narrowed release.

This isolated release worktree starts at5cc08a4 (existing app plus the earlier YumPals preview). Only the YumPals App integration hunks from4ed53a6,21dfcf6 ande0a6186 were reapplied, plus current src/yumpals files. Existing bank, gifting, sponsorship, rewards, account setup and financial handlers are unchanged from this baseline. No protected-bank/gift client is imported or exported here.

## Acceptance so far

- Isolated frontend build PASS505ms,1708modules; JS885.59kB/261.02gzip, CSS80.85kB/15.10gzip. Existing outdated-browser-data and chunk-size warnings remain. Lint result pending.
- Initial lint PASS. Copied only YumPals backend modules/tests, excluding bank/gift services and keeping the pre-bank wallet adapter froma35085a. Existing Teams service untouched. Backend116/116 PASS230.12225ms and lint0.
- REFUSED first isolated frontend test run: preview logout assertion depended on the parked account-rebuild loginAttemptRef. Restored the baseline assertion that logout clears the preview; no app login/logout code changed. Added an AST-based regression comparing every existing named action handler against5cc08a4 to enforce the narrowed release scope. Corrected frontend results pending. Two read-only inspection paths were initially relative to functions rather than the release root and returned not-found; rerouted correctly without file changes.
- No live deployment, settings enablement, database writes, Auth claims or billing changes.
- Source assembly is not a completed rollout. YumPals server bindings, identity resolution, narrow rules, necessary payment compatibility and live teacher verification remain to be checked. Do not reintroduce the parked whole-system rebuild as a prerequisite.

Every subsequent change must record its files, measurements and acceptance/refusal. Preserve current checkpoints; never overwrite newer financial data with an old snapshot.

## Narrow app connection — in progress, not deployed

- Added appWalletAdapter.js: verifies actual Auth UID/provider/email against exactly one existing claimed public profile, reads the existing private mirror, refuses missing/conflicting balances, debits only both balances in the pet transaction. Preserves bank/Given/progress, including absent fields. No ownership/bank migration or shared gifting/banking endpoint required. This bridge does not repair or secure the existing app's client-writable financial data; that broader security work remains parked.
- Added appConnection.js and four default-off saved-pet/game bindings in functions/index.js, within the existing pet namespace. Teacher Settings bindings remain independently default-off. No deployment or activation.
- REFUSED initial4 bridge tests: fixture used a full pet (correctly refused unnecessary meal) and accidentally exposed its transaction facade instead of the underlying test store. Corrected fixture to hungry pet and retained original store. No application code or assertion weakened. Final targeted results pending.
- Isolated frontend75/75 passed211.889584ms after preview assertion correction; scope AST check passed. Current backend bridge changes still require real emulator and legacy-wallet interaction checks before accepting real charges.
- Corrected bridge4/4 passed94.930666ms and backend lint0. Added only a paid-gated listener synchronization guard so an old public snapshot cannot overwrite a newer pet debit; unchanged named action handlers still pass the scope check. Targeted sync+scope3/3 passed156.878042ms, including forced concurrent debit retry and missing/owner/session refusals. No existing bank/gift/spending handler rewritten.
- Reused the guarded emulator infrastructure with bank/gift checks and endpoints excluded, adding only four verification aliases for the actual app pet bindings. Initial assembly referenced the wrong config filename and aborted before applying files; corrected to firebase.ownership.json. Initial helper5/6 failed because dependency lookup compared a symlink path with its resolved path; changed to the exact resolved installed-package path. Helpers6/6 now passed575.242333ms. No installs or production credentials used. Full emulator acceptance pending.
- REFUSED first full narrow-connection run: prior31 groups and actual legacy-wallet read passed; new test used old action spelling `adopt` instead of the paid contract `adoption`, correctly rejected400 INVALID_ACTION. Fixed the test payload, not server validation. Cleanup PASS; logs /var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-mqdUGm. No production calls from verification.
- Read-only live function inventory confirms only resetStudentPassword (nodejs20) and teamsBot (nodejs22), both ACTIVE. Neither is a deployment target for this addition. Latest isolated build542ms/1709modules and lint0; care remains build-gated off. Listener guard now also cancels on effect cleanup.
- ACCEPTED narrow real-SDK/HTTP run34/34 in26075ms; cleanup PASS: /var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-uzwHim. Existing31 pet/settings/game groups retained plus actual Auth-linked legacy-wallet read, concurrent adoption once/preserved SDK fields and ambiguous identity rejection. Synthetic test duplicate profile removed only inside the disposable emulator.
- Full isolated backend120/120 passed216.262ms/lint0; frontend77/77 passed166.800917ms, lint pending completion. Rule validation API returned200/no issues for the pet-only partition. Live ruleset remains7b40979e-05c0-46de-8631-41bdc54ac695 at this read; old public-read/auth-write behavior outside the pet subtree is deliberately preserved, not certified secure.
- Sites-hosting guidance was inspected; its provider-specific creation/deployment workflow is inapplicable to this existing GitHub Pages/Firebase app. Keep the existing hosting, do not create or migrate to another service. No hosting action performed by that inspection.
- Live read-only preflight: no legacy/new pet Settings documents and no saved pet users exist. Mr Rayner's previously selected UID still matches mrrayner@yumdonut.school, enabled, with no current custom claims. No student migration is needed for the pet namespace.
- Prepared non-secret deployment readiness flags for the six additive pet/settings endpoints. Global student care will be initialized disabled and remains controlled by the teacher switch; these readiness flags alone do not enable care. Existing two live functions are excluded from the deployment target. No new hosting project or billing activation.
- Production pet-only rule partition activated and read back:277be69f-8e8e-42b5-9ed0-cebfcebae10b; previous immutable ruleset7b40979e-05c0-46de-8631-41bdc54ac695 retained for rollback. First exact-source guard refused before writes because baseline fixture omits live comments/spacing; reviewed token-equivalent rules and retried with comment/whitespace normalization plus exact original ruleset check. Existing non-pet grants unchanged.
- Six selective functions successfully created: yumpalsGetPaidSettings, yumpalsUpdatePaidSettings, yumpalsGetPaidCareState, yumpalsPurchaseCare, yumpalsGetSavedGame, yumpalsChooseSavedGame. Existing Teams/password-reset functions excluded. Deployment source3dd436d; no standalone project or billing activation.
- Mr Rayner's verified UID granted only yumpalsAdmin:true, preserving prior claims. Existing teacher-settings service initialized the new configuration disabled with operation initial-yumpals-disabled-20260908; readback configured:true,enabled:false. Only pet Settings/legacy cutover marker/setting receipt written; no wallets or pets changed.
- Initial operator SDK setup refused an access-token-only Firestore credential before any Auth/database action. Used the same operator OAuth via REST transactions to invoke the existing Settings service, retaining its exact binding and atomic writes. No credential files written. Config version ctrl_bb800cc17b989b42309a2fe949e6a96946567e40d39ead5758a6b3dddb4d9245.
- Settings transport now explicitly refreshes its captured user's token so the new teacher permission is picked up without waiting for token expiry. Test fixture verifies refresh=true; final build/tests pending before frontend publication.
- Live read-only checks PASS: new pet Settings direct unauthenticated read403; existing roster read200; all six new callable endpoints return401 UNAUTHENTICATED without credentials. No student actions invoked.
- Final Settings/scope16/16 passed143.455458ms; lint0; enabled frontend build469ms/1709modules, JS886.42kB/261.35gzip and CSS80.85kB/15.10gzip. All three YumPals build flags enabled for this build, global student setting remains OFF. Publish this exact dist output without a default-off rebuild.
- Frontend publication COMPLETE: gh-pages dec15ed5d0317487be0f25bb81c5f015300fee1a from source d8453b7. Previous live head51135cf18e216137f47e7ed121ac8a5cca69e20e was verified unchanged before publication and retained for rollback. After propagation, live index200 references index-Brbhu5UI.js; downloaded bundle SHA256 exactly matches the validated enabled build. Unauthenticated GitHub build-status lookup returned404, so it was not used as completion evidence.
- Post-deployment inventory confirms all six new functions ACTIVE and the existing resetStudentPassword/teamsBot still ACTIVE on unchanged runtimes. Student care remains initialized OFF. Teacher Settings refreshes the permission token automatically. No real pet adopted, care charged or bank/gift/sponsorship action invoked during rollout.
- Handoff: refresh https://kiwispin.github.io/yum-donut/ and use Admin Settings → YumPals. Teacher's signed-in interactive toggle has not been exercised by the agent; local HTTP control tests passed and live unauthenticated/auth-claim/config/rules checks above are the evidence boundary. Broader bank/gift/sponsorship work remains parked, not deployed.
## Centred YumPals introduction — 2026-09-08

- ACCEPTED: shared exterior CSS centres the heading, subtitle, preview badge and introductory notice in Preview and saved student views. Help retains start/left alignment. Device, game logic, wallets and settings untouched. Baseline d0651e0 retained for rollback; no previously refused approach repeated.
- Measured: frontend 81/81 passed in 239.572625ms, lint exit0, enabled production build394ms/1715modules. Browser checks at390px and1440px for both views: heading/intro centre, help start, zero horizontal overflow (4/4). Screenshots captured for each.
- Published source72264ba. ACCEPTED live verification: index references index-UhOdh_AI.js; downloaded JS and index-XEDUY6H7.css SHA256 exactly match the validated build. No backend deployment or live data changes.
