# YumPals measured speed pass — 4 October 2026

Request: squeeze remaining speed out of YumPals without breaking existing behaviour. Per user instruction, this agent performed all coding/review; no delegation. Baseline `259167f`, rollback tag `codex/yumpals-speed-pass-baseline-20261004`. Earlier speed logs reviewed first; previously accepted animation timings, durable queue, recovery and economic rules remain.

## Changes and disposition

- ACCEPTED — `pixelPaths.js`, `PixelDrawing.jsx`, saved/preview handhelds: compile immutable pixel rows to cached colour paths rather than one element per pixel. Keep outer sizing, colours, source drawings and accessibility labels. No CSS or artwork redesign. Unit test reconstructs every pixel of all frames, icons, props, food and hearts.
- ACCEPTED — `paidCareClient.js`: reuse one Auckland formatter for identical validation; skip no-op cancel notifications. All clock/identity/receipt checks remain.
- ACCEPTED — `paidCareTransport.js`: share concurrent same-user, same-generation read requests across visibility/focus/mount subscribers. Separate cancellation checks for each subscriber; never share writes or pre-purchase snapshots with post-purchase reads. New tests cover StrictMode remount, independent results, account switch, malformed requests and purchase invalidation.
- ACCEPTED — saved-game controller/handheld: prefetch existing paid game on opening the handheld; start a newly paid game from the already-validated purchase receipt rather than an extra get-game request. Never reset an already-started game when the same receipt is seen again. Actual guesses and recovery remain server-confirmed.
- ACCEPTED — `functions/index.js`: defer loading the unused Teams SDK until its own handler executes. This removes it from YumPals cold startup. No Teams behaviour/endpoint or secrets changed; only the four YumPals paid-care/game endpoints were redeployed, not Teams or other app functions.
- ACCEPTED — `paidCareEngine.js`: reuse identical Auckland formatter; `savedGameService.js`: overlap independent prior-audit and session reads. All existing transaction reads, config/entitlement/receipt/audit validation and writes are retained. No financial transaction algorithm, database schema, rules, pricing, billing, capacity or region changes.
- Verification-only additions: production-mode synthetic fixture config, before/after device profiler, game-response browser checks, and optional game wiring in the local care fixture. These do not enter the deployed app.

## Measurements so far

- Saved room DOM: **1,649 → 155 elements** (90.6% fewer); status screen **1,817 → 206** (88.7% fewer).
- Actual phone/desktop device screenshot comparison at 390/1440px: **zero changed pixels**, with identical 330×516 and 420×525 bounds.
- Development StrictMode / 4× CPU slowdown: median button response approximately **59 → 42ms**. Production-mode before/after test uses isolated baseline/current builds, 300ms synthetic reads, three runs per width and direct frame observation rather than tool-poll timing. Results to be consolidated below.
- New-game browser: **346ms** with a deliberately 300ms server delay; no extra get-game call. Preloaded existing game: **9ms**; same-session pause/resume: no request. Each guess **323–328ms** with that same 300ms artificial delay, one request, correct audit and no additional charges; wallet remains 28 after a two-donut game.
- Local server module startup: **476 → 170ms**. Standalone unused SDK import alone measured 342ms. These are local cold-process measurements, not claimed live-cloud cold-start timings.

## Refused approaches / corrected attempts

- REFUSED: removing validation/audit reads, optimistic game outcomes, new paid always-on servers, region migration, changing bank/gifting, shortening already-approved animation again or replacing the familiar device design.
- Combined patch initially rejected duplicate file targets without changing files; applied one consolidated operation per path.
- Initial SDK timing script used a filesystem subpath that bypassed package exports. Corrected to resolve from the Functions package.
- Initial game harness attached its response listener after prefetch had already completed; fixed listener setup before navigation. Application prefetch was correct.
- Tool locator polling overstated game/first-paint wait by hundreds of milliseconds. Replaced those measurements with browser MutationObserver + animation-frame timestamps. No application delay introduced to satisfy tests.
- Existing navigation resize test raced ResizeObserver: it focused a permanent More item before the narrow layout finished, then incorrectly expected that item to move. Wait for the intended three-link narrow layout before testing focus recovery. Navigation implementation is unchanged.
- Initial unauthenticated live browser smoke waited for all network activity to stop and timed out after 30 seconds. Switched the smoke criterion to DOM readiness plus rendered app content; both widths passed. This is a test-readiness correction, not a measured 30-second app-loading delay or an application change.

## Final verification / rollout

- Frontend **118/118 passed**, 2686.077625ms; backend **132/132 passed**, 438.401792ms. Both lints exit 0; whitespace check clean. Historical app-handler, device-markup and CSS preservation assertions remain passing.
- Production isolated-fixture measurements (4× CPU slowdown, six runs, same 300ms injected read delay): median first painted ready state **645 → 607ms**; interaction-loop script work **64 → 54ms**, layout work **15 → 13ms**. Median button-to-frame response **17ms both before and after**, already at the sampled display-frame limit. Do not claim a further response-time improvement where production measurements show none.
- Six production preview screenshot comparisons (room/status/night at phone/desktop widths): **zero differing pixels** in every case. Saved-device comparisons also zero differing pixels.
- Parallel game-read test: **43ms** for the first round with 40ms-per-read injection; peak five independent reads overlap, none removed. Durable audit and wallet invariant checks pass.
- Final slow-payment browser checks: feeding **35/37ms**, second queued action **16/16ms**, with the first payment held for ten seconds. Exactly two receipts and wallet 30→27; no duplicate charges, lost food frames, layout movement or page errors. StrictMode/4×-CPU care checks **116–155ms**, including refusal rollback, immediate needs/lights and insufficient-funds handling. Navigation regression rerun passed at 320/390/768/1440px with no navigation implementation changes.
- Enabled production build: **847ms / 1717 modules**. JS `index-BglSS_DU.js`, SHA-256 `b31d49abd7bb603d055ff32b33343195687827002be2f34fcbed582b1542514d`; CSS byte-identical `index-BASmV3CR.css`, SHA-256 `79951ab31a95f92e00a633faf983553ecc505a8b79246b7d8c53fc9ff93d64d3`. Existing dependency-age/bundle advisories remain.
- Backend deployment targets resolved read-only: exactly the four existing YumPals paid-care/game functions in us-central1/nodejs22. Existing limits are 256MiB, 1 CPU, 60-second timeout, max 20 instances and concurrency 80; readiness flags remain true. No always-on capacity requested.
- Backend deployment completed successfully for exactly `yumpalsGetPaidCareState`, `yumpalsPurchaseCare`, `yumpalsGetSavedGame`, and `yumpalsChooseSavedGame`. Post-deployment metadata matches baseline region/runtime/platform, timeout, memory, CPU, minimum/maximum instances, and concurrency for all four. All four deployed endpoints return HTTP 401 / UNAUTHENTICATED to unauthenticated calls; no student data was accessed. This is an access/startup smoke check, not a live payment latency benchmark.
- Frontend published from the tested, feature-enabled `dist`. Live HTML now references `index-BglSS_DU.js`; both live JS and CSS SHA-256 hashes exactly match the tested build recorded above. Unauthenticated live browser smoke passes at 390/1440px: app rendered, correct bundle, no page errors or horizontal overflow. All performance traffic uses synthetic local accounts; no live student purchases are used for testing.
- Release source commit `7a60853`; rollback remains `codex/yumpals-speed-pass-baseline-20261004` (`259167f`). Publication and scoped verification complete. Remaining server-confirmed game latency depends on the connection; results are not fabricated and payment/audit safeguards are retained.
