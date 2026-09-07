# YumPals live rollout change log

## Scope and baseline — 2026-09-08

User authorises shared wallet/security fixes necessary for saved, paid YumPals with teacher enable/disable controls in the existing app. Luna xhigh implements application code; parent independently reviews. No separate staging billing. Preserve accounts, all balances, Given totals, progress and receipts.

Baseline commit: 5cc08a4. Rollback checkpoint: checkpoint-before-yumpals-wallet-security-2026-09-08. A rollback must never overwrite newer financial data with an old database snapshot.

Read previous YUMPALS_PRODUCTION_INTEGRATION_LOG.md and YUMPALS_CHANGE_LOG.md before changes. Previously refused unawaited debits, ambiguous receipts, name-based ownership, and unsafe mirror writes must not be retried unchanged.

## LR-001 — Trusted wallet adapter — ACCEPTED internal implementation only

- Requested implementation: server-owned UID mapping, strict ownership and balance validation, transactional reads and atomic mirror debit, preservation of unrelated fields.
- Missing/conflicting records must fail closed, never become zero or silently choose a balance. Shared legacy writers and database bypass permissions remain separate mandatory integration work.
- Measurements: pending implementation and independent review. No production writes or deployment authorised by this entry itself.
- REFUSED initial concurrency-test evidence: parent run of seven adapter tests returned six passes and one failure in171.755083ms. The concurrent reward test did not force overlapping reads, so its retry assertion failed. Requested deterministic overlap before commits, retaining the conflict assertion; do not repeat the same scheduling assumption or delete the assertion to obtain a pass.
- ACCEPTED corrected deterministic overlap test: holds pet transaction after wallet reads until reward commits, then requires conflict/retry and final33 balance on both mirrors. Added second-write failure rollback and actual SDK Timestamp/GeoPoint preservation checks.
- Files: functions/src/yumpals/uidWalletAdapter.js, functions/test/uidWalletAdapter.test.js, functions/src/yumpals/UID_WALLET_ADAPTER.md. No existing runtime exports or writers modified. Adapter uses single-use transaction-bound read handles, immutable returned balances and strict protected ownership assertions.
- Independent results: adapter9/9 passed279.385917ms; full backend57/57 runner entries (56 test cases plus fixture load) passed266.370375ms; backend lint exit0. Frontend33/33 passed; root lint exit0; build810ms,1697modules, same JS840.05kB and CSS78.53kB as baseline. Existing browser-data and large-chunk warnings remain.
- These are synthetic optimistic-transaction checks, not deployed Firestore verification. No live wiring, production writes, database rules changes or deployment. Shared writers, audited ownership bootstrap and release gates below remain incomplete.

## LR-002 — Legacy balance synchronization and spending compatibility — ACCEPTED locally, not deployed

- Baseline8fec897. Luna assigned current-value transactional sync with account/cancellation guards and atomic private/public debits for goal, shop and sponsorship. Preserve existing costs, benefits, counters and receipts.
- Legacy linkage checks are compatibility checks, not trusted financial authorisation. Protected owner accounts must reject balance mismatch rather than automatically reconcile. This does not replace server-owned mapping or database rules.
- No production writes or deployment. Acceptance and measured results pending independent review.
- Implemented in src/App.jsx with new src/walletCompatibility.js and src/walletCompatibility.test.js. Sync rereads both records in a transaction, never accepts a captured event balance, and guards cancellation/current authenticated UID. Missing/corrupt ownership or balances are not replaced with zero. Protected-owner mismatches refuse reconciliation. Legacy public-authoritative reconciliation remains explicitly transitional.
- Goal, shop and sponsorship now read both mirrors before writes and debit both in their existing benefit/receipt transaction. Removed all three stale post-transaction private writes. Sandbox returns without mutation. Digital shop ownership is rechecked transactionally. Costs, existing Given semantics, benefit fields and receipt amounts retained; account/session/funds failures have plain-language messages.
- Interim verification:40/40 tests passed188.51775ms, but lint rejected an unused walletErrorMessage test import, so build was not run. This incomplete candidate was NOT accepted. Completed error-copy and actual-handler regression tests use the import; no lint suppression applied.
- Independent completed verification:43/43 frontend tests passed147.018625ms; root lint exit0; build1.09s,1698modules, JS841.65kB/248.09gzip and CSS78.53kB/14.61gzip. Backend57/57 entries (56 cases plus fixture load) passed383.99525ms; backend lint exit0. Existing browser-data/chunk warnings remain.
- Tests force sync/debit overlap with a barrier and assert retry; execute extracted actual goal/shop/sponsorship handlers with synthetic transaction dependencies to verify receipts, benefits, preserved fields, second-write rollback, sandbox, wrong UID, missing mirrors, conflicts and insufficient funds. These are not real browser/emulator or production tests.
- Checkpoint checkpoint-before-yumpals-shared-writers-2026-09-08 preserves8fec897. Remaining writer/server/rules rollout is still required; legacy client linkage remains writable and does not authorise paid pet launch.

## Remaining rollout gates

- Coordinate every legacy wallet writer and stale mirror listener before charges.
- Verify compatible database rules and authenticated teacher settings; hidden UI is not authorisation.
- Wire persistent handheld state, durable purchase requests and permanent receipts; preserve disabled pets and pause deterioration.
- Test identity, concurrency, existing bank/gifting/Arcade/shop/Teams, Settings and browser flows before controlled publication.

## Read-only writer inventory

Parent inspected current App.jsx: public snapshot listener copies a previously observed balance to private outside a transaction; goal contribution, shop and sponsorship have post-transaction private writes from UI state; bounty payout and bank interest use separate writes. Gifting increments a recipient private mirror without reading it. Bank transactions read both mirrors but do not require wallet equality. Account bootstrap writes mirrors separately. These are not fixed by adding a pet adapter alone; all must be addressed or safely gated before real pet charges. This inventory changes no student data.

## Integration order and acceptance requirements

1. Internal adapter: only protected UID mapping may choose a public record. Both owner assertions and wallet balances must agree. No name lookup, automatic bootstrap, repair or default-zero balance. Concurrent transactional writes must retry without loss. Legacy nontransactional overwrites remain unsafe even with this adapter.
2. Compatible shared operations: replace stale client writes with authenticated server operations and permanent operation receipts. Cover gifts, bank transfers/interest, Arcade/training rewards, shop/sponsorship/goal spending, bounty payouts and teacher adjustments. Existing earning/giving rules must remain unchanged.
3. Account bootstrap/mapping: review existing authenticated ownership, quarantine ambiguous records without deleting or zeroing them, and support future distinct UIDs even with identical display names. Never accept display names or client-writable UID fields alone as proof.
4. Rules rollout: verify legitimate old-app behaviour and overlapping grants in emulators before changing production. Do not deny legacy writes until compatible operations and clients are available; do not permit pet charges while bypass writes remain possible.
5. Saved handheld and teacher controls: server-authorised default-off switch, prospective pause calendar, durable request recovery and recorded receipts. Disabling preserves all state and prevents new charges.
6. Controlled live release: publish only verified compatible changes, keep student activation off for initial teacher checks, record actual deployed versions and observations. Local tests are not evidence of production security.
