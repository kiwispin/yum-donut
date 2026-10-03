# YumPals network-speed audit — 4 October 2026

Request: exhaust remaining safe speed improvements, personally, without changing the toy or financial protections. Baseline `61c0021`; rollback tag `codex/yumpals-network-baseline-20261004`. Previous speed logs reviewed; no repeating rejected changes. Work is limited to YumPals; no account, bank/gifting, pricing, region, capacity or billing changes.

## Evidence / decisions

- Live read-only OPTIONS probe: the four-callable architecture uses cross-origin POST; the game endpoint has no Access-Control-Max-Age. The browser can therefore repeat a permission preflight between interactions. Candidate: cache only the CORS policy, never auth, balances, receipts or responses.
- Installed Firestore SDK starts a transaction with its first read and holds other reads until that returns. Plain Promise.all is not enough to remove that initial round trip. Candidate: use the public transaction.getAll API for independent document reads, keeping every validation/read and atomic write.
- Paid-care startup and purchases still serialize config, Holiday Mode, pet, live Auth lookup and profile mirrors. Candidate: overlap independent reads, never cache the financial/identity proof. Duplicate receipt/refusal recovery must still work without a current wallet/config.
- Benchmark will model the SDK first-read gate, include real YumPals wallet validation using synthetic profiles, and compare the same scenarios before/after. No live student purchases.
- REFUSED: claiming a mathematical fastest implementation, removing auth/audit checks, inventing game outcomes, cross-user caches, changing wallet economics or deploying paid always-on infrastructure. Completion means measured improvements and a documented remaining latency boundary, not a false absolute guarantee.

References checked: [MDN preflight cache semantics](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age), [Firebase callable protocol](https://firebase.google.com/docs/functions/callable-reference), installed Firebase Functions and Firestore implementations. The Firebase callable wrapper and deployment descriptors must remain intact.

## Changes and measured results

- ACCEPTED after initial tests — `readDocuments.js`, `paidCareService.js`, `savedGameService.js`, `holidayMode.js`: batch independent transaction documents, including Holiday Mode, and retain dependent turn-audit reads in a second batch. Duplicate/refused purchases still return before config/wallet access. Normal purchases still validate every document and perform one atomic commit.
- ACCEPTED after initial tests — `appWalletAdapter.js` (YumPals-only adapter): overlap live Auth lookup, unique UID profile query and private mirror read. No cache, relaxed ownership/balance check, or change to mirrored debit fields.
- ACCEPTED after initial tests — `preflightCache.js`, four exports in `functions/index.js`: preserve the real Firebase callable with a proxy and set a 600-second CORS-policy lifetime on OPTIONS only. POST still goes through all SDK auth, request and application checks. No response/account/balance caching. Non-YumPals exports unchanged.
- Verification additions: `network-speed.mjs` compares the actual old/new services and app wallet adapter with 35ms per Auth/database operation, including the installed SDK's first-read gate. Exactly the same document lists and final wallet values in all five scenarios. Opening **220→72ms**, purchase **291→76ms**, receipt replay **73→37ms**, first game guess **110→38ms**, next guess **145→74ms**. These are controlled service measurements, not live internet timings.
- `preflight-speed.mjs`: real Chromium cross-origin requests to the actual Firebase callable implementation, no route interception, 150ms injected per HTTP request and 6.1 seconds between actions. Initial request unchanged (327ms); later requests **310→156/155ms**. Three OPTIONS became one; all three POSTs were still processed and rejected 401 UNAUTHENTICATED. Permissions are cached, authentication is not.
- `networkSpeed.test.js`: deployment descriptor preservation, OPTIONS-only headers, batching/order/failure propagation, no premature writes, duplicate receipt recovery without current config/wallet, corrupt records, Holiday Mode fail-closed, previous game audit retention, concurrent exactly-once payments and terminal refusal replay.
- Three additional paired benchmark runs confirm median opening **217→73ms**, purchase **291→74ms**, replay **73→37ms**, first game guess **110→38ms**, later guess **147→74ms**. Document sets identical on every run. Server work is reduced, not silently skipped.

## Final checks and remaining boundaries

- Frontend **118/118** passed (2639.417833ms); backend **138/138** passed (389.486666ms). Frontend/backend lint and whitespace checks pass. No browser source, CSS, artwork or navigation implementation changed.
- Phone/desktop slow-payment browser: feeding **34/37ms**, next queued care **16/24ms** with payment delayed ten seconds; two receipts, balance 30→27, no duplicate charge or layout shift. Game fixture: existing paid game opens in **9ms**; guesses **324–327ms** with 300ms injected network delay and no extra read/debit. Four-times CPU slowdown: local care **113–166ms**, cancellation/keyboard/refusal recovery all pass. Navigation regression passes 320/390/768/1440px (3559ms).
- Remaining waits are explicit dependencies: first browser permission exchange, auth/network/cloud startup, one authoritative game result, transaction commit, and previous-turn audit references that are only known after loading the session. Duplicate purchase recovery deliberately checks original outcome before reading mutable account state. No first-read speculation that would make recovery require an existing account/config.
- No additional browser micro-optimization justified: prior production input measurements are already approximately one display frame; frontend unchanged, so those measurements are not claimed improved again. Cross-device game-progress caching without fresh confirmation was declined because stale turns could create retry/conflict delays rather than a reliable improvement.
- No always-on capacity, region change, cached financial/identity proof, guessed game outcomes or shortened approved animation. An absolute fastest-possible guarantee is not measurable; this log records which bottlenecks were measured, addressed or bounded.
- Backend-only rollout pending. The already-live frontend should remain byte-identical.

## Corrections / verification limits

- First attempt to run the network benchmark used the Functions subdirectory rather than repository root; no application code failed or data changed. Reran from the correct root. An interim progress note rounded incorrectly; the recorded measurements above are authoritative (72/76ms, not 73/74ms).
- Firestore emulator JAR is present but Java runtime is absent; no runtime installation or new infrastructure undertaken. Tests use the actual public SDK API shape and a first-read-gated transaction fixture. Production deployment metadata and unauthenticated smoke tests will be checked before completion.
