# YumPals production integration work log

Started 2026-09-08 after user instruction to prepare rollout. Coder: Luna Extra High; parent independently reviews. This log supplements YUMPALS_CHANGE_LOG.md and records accepted/refused work without overwriting prior attempts.

## PI-001 — Baseline and wallet boundary audit — ACCEPTED finding

- Baseline bba6390 preserved as annotated tag `checkpoint-before-yumpals-production-integration-2026-09-08`; prior source/live gold-standard tags retained. Working tree clean at start.
- Current demo has no persistent paid-care integration. Existing cloud callables implement the earlier free-care model; production gate remains off.
- `src/App.jsx` public-wallet listener reads a public snapshot and later writes its balance into a UID-private profile, outside a shared transaction. This can race with other wallet changes.
- Shop and sponsorship debit the public wallet transactionally but then write the private balance from client profile state separately. Gifting credits public and private records using public UID mapping. Bank moves read both profiles. Therefore a standalone pet-wallet debit cannot certify cross-module consistency.
- Public records and their UID/name mapping are client writable under the previously inspected broad live rules. They are not a trusted ownership source for server purchases. No current live student records or balances were inspected or changed in this audit.
- Audit UI classifies `The Shop` specially; new pet spending requires an explicit spending category rather than being counted as giving.
- REFUSED approach: connect the demo to public name-based wallets and call it production ready; tighten only the pet subtree while leaving wallet authority open; restore balances from old snapshots during rollback.

## PI-002 — Isolated server foundation — ACCEPTED for local integration testing

Scope: additive, unexported paid-care server modules and synthetic-state tests. Authoritative server time, calendar checkpoints, safe migration, request replay binding, atomic pet/wallet/receipt updates. No live wallet adapter will be inferred from untrusted legacy names/UID fields. Existing callable exports, UI routes, production rules and balances stay unchanged.

Acceptance requires measured tests and independent review. Unit/fake-transaction success is not cloud staging or production financial certification.

Implemented additive `paidCareEngine.js` and `paidCareService.js`, with engine/service tests and a synthetic optimistic-transaction fixture. Server dependencies must supply trusted per-UID config references and a wallet adapter; no production adapter or default name lookup exists. No exports or app wiring changed.

Reviewed corrections, not unchanged retries:

- REFUSED unawaited wallet adapter debit: corrected to await rejection inside the transaction; injected asynchronous failure leaves every staged document unchanged.
- REFUSED ambiguous receipt before-state: receipts separately capture last-saved needs, post-time-progression/pre-care needs and resulting needs, so the purchased gain can be audited accurately.
- Tightened outer/inner pet ownership, future dates, receipt bounds and replay-effect checks; invalid data fails closed instead of becoming zero.
- Synthetic wallet fixture preserves bank, Given, lifetime totals and extra fields; this validates the adapter contract, not the existing live mirror protocol.
- Disabled reads preserve the pet. Re-enabling must record the paused interval in effective-dated calendar history; a future settings service must enforce this before activation.

Independent evidence:

- All625 possible initial need combinations match five sequential eligible daily steps; care progress remains unchanged.
- Engine10/10 tests280.896ms; service12/12 tests164.995417ms. Includes DST, whole school dates, overlapping freezes, bounded long gaps, no-charge migration, same/different-ID concurrency, insufficient balance, corrupt/missing ownership, failed commit, async adapter failure, config-change reconfirmation and receipt replay integrity.
- Full backend runner46/46 entries271.917ms (45 test cases plus fixture-file load); backend lint exit0. Existing frontend/bank31/31 in121.627417ms; root lint/build exit0. Build817ms,1696modules, same JS838.50kB/246.93gzip and CSS78.41kB/14.58gzip. Existing browser-data/large-chunk warnings remain.
- Parent independently observed two simultaneous identical purchases produce one debit and one2-heart effect, with an optimistic conflict/retry. Disabled read and staged asynchronous debit failure preserve saved data.
- No new real-emulator/cloud test was run for this service. Earlier66-check emulator evidence applies to the old callables only and is not reused as paid-service acceptance.

This stage does not finish paid gameplay, growth, configurable decline/sleep settings, durable client request recovery, a deployed migration, legacy free-endpoint gating, real activity-feed integration or cloud financial security. The browser demo is unchanged and remains disposable. Those items require integration and review before a pilot.

## Release gates still open

1. User-selected/authorised separate staging project; ask separately before enabling billing. Production and unrelated projects must not be used for test purchases.
2. Verified server-owned UID-to-wallet mapping and coordinated legacy writer/sync migration; preserve all balances, Given totals and account separation.
3. Deny bypass writes across all overlapping rules while providing compatible replacements for legitimate bank, gifting, Arcade, shop and Teams operations.
4. Export/wire paid endpoints, durable client request IDs/reconciliation, persistent handheld state and teacher settings only after boundaries are reviewed.
5. Real emulator/cloud concurrency, calendar, identity, privacy, migration and rollback tests; explicitly approved limited pilot before broad activation.

Rollback must pause new charges and deterioration, preserve receipts and newer transactions, and never restore an old database over post-launch spending.
