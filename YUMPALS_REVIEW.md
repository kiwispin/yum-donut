# Independent review checklist

Reviewer: parent agent. Coder: GPT-5.6 Luna Extra High. Baseline: `gold-standard-before-yumpals-2026-09-07`.

## Required evidence before local acceptance

- Diff against the baseline contains only additive module work and narrow integration; auth, wallets, bank, gifting, existing games, leaderboard and Teams logic unchanged.
- Feature disabled by default; failure to load or failed callable leaves existing app usable. Demo does not invoke real Firebase operations.
- Pet identity uses authenticated UID, never supplied name or arbitrary caller UID. Anonymous callers cannot create authoritative pets. Teacher server privileges require a trusted claim, not a display name.
- Server supplies the clock. Auckland day, weekend, holiday and cumulative growth rules tested. Client timestamps cannot award care.
- Atomic transaction couples pet state and append-only audit. Duplicate operation IDs and repeated daily actions cannot add progress. Reused request IDs with different actions cannot silently mutate data.
- Read/modify operations reject invalid existing state without resetting progress. Settings changes preserve already-earned growth and selected creature. Disabling preserves records.
- Browser checks: adopt, feed, pat, hardware controls, preferences, holiday rest, refresh persistence, safe failure/retry; mobile layout and accessible controls.
- Root lint, existing bank tests, functions lint/tests and build rerun. Quantify changed build size against baseline; existing warnings distinguished from new failures.
- Production rollout remains blocked until scoped server/rules checks and teacher identity setup are independently verified. Do not claim emulator mocks prove production rules.

## Baseline browser observation

Local app at `http://127.0.0.1:5173/yum-donut/` rendered the existing authenticated administrator session and bank screen. Read-only navigation showed wallet/bank and teller controls; no deposit, withdrawal, gift, game or admin action was submitted. Existing app startup may run its normal background synchronisation. This is a rendering smoke check, not a transaction test.

## Findings and outcomes

### R-001 — Initial backend draft: REFUSED pending correction

Inspected the first written backend draft during implementation; no deployment. Sent findings to Luna on 2026-09-07. These findings refer to this draft, not necessarily subsequent revisions.

1. `paths.js`: collection reference used as if it were a document (`.collection()` on collection), preventing real Admin SDK requests. Require valid alternating document/collection paths and strict test fake.
2. `rules.js`: junior stage at second milestone/day 5 instead of day 10; computed growth changes backwards when teacher slows speed. Require earned milestones persisted independently of current thresholds.
3. `callables.js`: care draft omitted saved-state/day validation and fell back to zero for invalid care count. Require fail-closed no writes.
4. Settings read outside mutation transaction: stale enabled/settings races. Require config read in same transaction.
5. Profile updates returned no daily record, falsely clearing care UI. Require refreshed current daily status.
6. Timestamp-only profile/settings audit IDs collide; operation-ID helper unused. Require unique auditable operations and mismatch-safe idempotency.

Measurement: static inspection of 508 initial backend lines; no real Firestore calls made. Verification and final disposition pending revised tests/diff.

### R-002 — Initial interface/integration: REFUSED pending correction

- Global keyboard handler intercepted Tab, Enter and Space even on normal buttons. Require scoped shortcuts and normal keyboard navigation.
- Callable responses were discarded and refresh failure swallowed, allowing false success; require response-driven status and honest error/retry.
- In-flight load not scoped to current UID; clear old state and reject stale responses, remount pet view per UID.
- New callable ran on every app startup including anonymous users despite default-off rollout; require explicit build gate.
- Existing Admin Settings lacked YumPals entry; demo settings did not recalculate current day immediately and demo actions could ignore disabled state.
- Measurement: static inspection of App integration and 326-line initial view. Browser demo adoption succeeded; feed alone retained 0 care days, pat then produced exactly 1 and disabled both action buttons. These happy-path results do not override the refusal above.

### R-003 — Initial visual implementation: REFUSED pending correction

- Device had 34px rounded-rectangle corners, not approved egg silhouette. Browser screenshot confirms mismatch.
- Sprite rows malformed: Mossbit 254 cells (one 14-wide row), Pufflet and Emberoo 255 each (one 15-wide row each), while grid expects 256. Measured with Node over sprite source arrays. Require rectangular-grid tests.
- Require visible eat/pat/rest reactions and earned accessory/toy/theme rather than just a bounce and milestone labels; replace student-facing UID jargon.

### R-001 interim verification

Actual installed Firebase Admin SDK successfully constructed all four revised settings/user/day/audit references under `artifacts/yum-donut-school/yumpals/main/`. No network operations. Full acceptance still pending tests and remaining findings.

### R-004 — Initial verification coverage: REFUSED as sufficient evidence

- Five new backend tests used a serial in-memory transaction fake; no concurrency, retry conflict or failed-commit evidence despite an atomicity test title.
- Requested explicit same/different-action concurrent calls, failed-commit no writes, invalid state/day mutation rejection, disabled preservation, response assertions, audit counts and date spoofing/DST tests.
- Parent intermediate run: frontend+bank 5/5 (84.27ms); backend+Teams 16/16 (105.68ms). All passed but not sufficient to close review.
- Environment measurement: Firebase CLI available at `/usr/local/bin/firebase`; `java -version` reports no Java runtime; no Firebase emulator cache. Actual Firestore emulator/security rules tests NOT RUN. No runtime installation or live data testing attempted.

### R-005 — Session/rollover guard revisions

Additional finding: existing developer sandbox mocks a user without changing Firebase authentication. Requested explicit build/sandbox/anonymous/current-UID guards on reads and writes, callable whitelist, room-entry/focus/day refresh and caught retry errors. Revised source contains these guards; cloud-enabled browser scenario not exercised against live Firebase.

### R-006 — Settings-only phantom unlocks

Additional distinct growth edge: a faster speed could show new rewards on read without persisting them, then lose those visible rewards when slowed again. Requested stored-earned-only display, with actual awarding inside care transaction, plus regression test. Also requested controlled-date and disabled guards for demo adoption and explicit temporary-demo disclaimer. Pending coder final results.

### Browser revision measurements (after Luna resume)

- 390x844 viewport: document scrollWidth 390px equals innerWidth390px; no horizontal overflow. Egg silhouette, centred brand, screen/actions and three circular hardware buttons fit. Pixel blur removed. R-003 visual correction accepted for local preview.
- Native keyboard Tab advances from Settings to Cycle; Enter opens Settings and saves preferences.
- Demo feed+pat gives exactly 1 care day; holiday date set to current demo day immediately shows REST and preserves 1; disabling feature shows paused state while keeping pet and care day.
- Normal local app with cloud gate off renders original Bank, Arcade menu, Admin Settings; additive YumPals settings show cloud controls disabled. Browser error log empty during this smoke check. No bank/game/settings mutation submitted to live service.
- Temporary mobile viewport restored. Demo records are temporary and not student data.

## Final disposition

ACCEPTED for local preview and continued staged development only. R-001 through R-006 code corrections inspected; targeted tests, browser evidence and final independent measurements are recorded in FINAL-001 of YUMPALS_CHANGE_LOG.md. Final suite: 32 passing tests, both lints, production build, diff whitespace check, plus 1,084 independent parity comparisons.

REFUSED for live activation at this stage. Follow YUMPALS_ROLLOUT.md before enabling or deploying. The cloud gate remains OFF. This acceptance is not a guarantee that every pre-existing live workflow has been exhaustively tested; financial actions and real student records were deliberately not used for testing.

Update 2026-09-07: the earlier missing-Java/emulator limitation above is superseded by real local Auth/Functions/Firestore verification: 66 checks passed in 26,921 ms. The failure-cleanup sentinel correctly exited 1, printed no PASS marker, and closed emulator ports. Frontend/backend regressions passed 32/32, both lints and build passed. Settings now replaces the room visibly, focuses its heading, and restores the opener on Escape/Back; parent browser checks confirmed both entry paths and unsaved draft preservation. The candidate scoped rules also passed Google's non-deploying compiler test (HTTP 200, no issues). Live rules remain unchanged and broadly permissive outside the candidate pet protection. Separate cloud staging and production Auth verification remain outstanding; emulator acceptance of forged JWTs must not be mistaken for production signature verification. See YUMPALS_SECURITY_VERIFICATION.md for boundaries and evidence.
