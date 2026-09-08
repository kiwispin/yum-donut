# Paid-care foundation: internal implementation, not deployed

LR013 adds an internal safe handheld view, refusal-aware purchase wrapper and
unwired pinned client/controller; see [PAID_CARE_CONNECTION.md](PAID_CARE_CONNECTION.md).
Existing raw getState output, engine hashes and success receipts stay compatible.
Parent's frozen-source verification passed27 local emulator groups (22 prior +
4 paid HTTP + 1 actual-SDK injected ABORTED group), exit0, elapsed24635ms, with
OWNERSHIP_EMULATOR_CLEANUP_PASS. Artifacts:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-6ds89E`.
The separate LR013 sentinel exited1 as intended after six definitions/readiness,
with cleanup PASS and no verification success marker. Sentinel artifacts:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-ajlA8s`.
All five ports were independently free after the full run and sentinel. The
successful-run inventory is firebase.json, ownership.firestore.rules,
firestore-debug.log and isolated CLI/cache files, not a complete Functions trace.
Parent syntax checks for all new JS/MJS/CJS and diff check passed. Final
frontend117/117 passed454.398167ms; backend111 entries (110 cases plus fixture)
passed395.785084ms; helper5/5 passed916.115083ms. Both lints exit0; build815ms,
1705modules, unchanged JS864.10kB/255.89gzip CSS78.45kB/14.60gzip and existing
warnings. These supersede interim LR013 measurements. Paid HTTP checks use real
Auth-emulator tokens; the SDK retry group uses injected synthetic auth/ABORTED.
Neither proves production JWT signatures or compatible live rules. Actual saved
handheld UI, game completion and live protected shared writers remain unfinished;
no live paid endpoints or student activation are established.

LR010 adds internal teacher controls and permanent legacy-route cutover; see
TEACHER_CONTROLS.md for the injected API, audit/replay semantics, deployment
ordering and separate pause-history compatibility. No live endpoints or UI are
wired at LR010. LR011 adds a separately gated teacher Settings screen, pinned
transport and two additive Settings callable exports; see SETTINGS_CONNECTION.md.
They remain disabled and undeployed; paid-pet endpoints/client are still unwired.
LR012 subsequently passed 22 local emulator groups (17 prior + 5 Settings HTTP)
in 20065ms, exit0 with cleanup PASS; its separate cleanup sentinel also passed as
intended (exit1, no verification success). See
[SETTINGS_HTTP_VERIFICATION.md](../../../verification/yumpals/SETTINGS_HTTP_VERIFICATION.md)
for exact evidence and retained-artifact limits. Settings checks use actual
Auth-emulator tokens and the frontend controller/transport; paid-service requests
remain injected synthetic context. Production JWT signatures, real app login,
deployed claims/rules and paid-pet HTTP integration were not established by
LR012; the separate local LR013 HTTP evidence is recorded above, not live proof.
Parent LR010 emulator passed 17 groups in 11258ms, exit0, with
OWNERSHIP_EMULATOR_CLEANUP_PASS. Logs:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-mTbUj2`.
Internal request auth is injected synthetic context and deny-all fixture rules
are not production security evidence. Disabled reads are permitted without pet
state writes; charges are blocked. Local backend 98/98 entries (97 tests plus
fixture load) passed in 260.547166ms, including the older-pet regression.

LR009 numeric compatibility: existing finite wallet balances from zero through
Number.MAX_SAFE_INTEGER may contain fractions. Prices, caps, needs and counters
remain integer-only. Service and adapter share exact bounded debit validation;
receipt replay requires walletAfter to equal the computed JS subtraction result,
not merely a matching difference (1.1 - 1 is not literal 0.1). No rounding,
conversion, default-zero, bank/Given change or receipt-schema migration occurs.
Existing integer receipts remain replayable. Parent-run LR009 real-emulator
verification passed14 check groups in11,754ms, including fractional paid adoption,
receipt replay and staged-write abort. No live rollout is implied.

LR009 serialization correction: a synthetic reordered saved request demonstrated
CORRUPT_RECEIPT despite unchanged content. Replay now validates the exact five
stored request fields (including mandatory null adoption for non-adoption), then
reconstructs the original outer/adoption field order before checking the original
binding. Unexpected keys, missing fields and semantic edits still refuse as
CORRUPT_RECEIPT. No receipt rewrite, schema migration or global digest/calendar
change occurs; legacy integer bindings remain compatible. Config-key-only order
changes still conservatively require reconfirmation. Emulator requests now use
getState quotes from saved config, not a pre-write in-memory hash. Parent verified
actual Firestore purchase/replay with this correction in the LR009 run.

This additive engine/service is not imported by `functions/index.js`, old callables,
or the app. The real internal `uidWalletAdapter` and reviewed ownership bootstrap
exist, but no live resolvers, approved student manifest or deployed exports are
provided. LR008 ownership/adapter emulator verification passed under isolated
rules; LR009 fractional paid-service/serialization emulator verification also
passed locally. Neither constitutes production authorization.

## API and trust boundary

- `createPaidCareService({ db, refs, walletAdapter, now })` exposes internal
  `getState(request)`, `migrate(request)`, and `purchase(request)` methods.
- A future trusted callable wrapper must supply verified Firebase auth context.
  The internal service rejects missing/empty UID and missing/anonymous providers;
  passing a JavaScript object is not itself proof of authenticated identity.
- `refs` resolves `config(uid)`, `pet(uid)`, `receipt(uid, operationId)` and
  `migration(uid)` from server-owned identifiers. No reference or target UID is
  accepted in request data. Config must be resolved per UID: absence intervals
  must never accidentally freeze every student through one shared calendar.
- `walletAdapter.read(transaction, uid)` must read a protected trusted mapping
  and the exact wallet/mirrors within the same transaction, reject ambiguity,
  and return `{ ownerUid, balance, ...adapterContext }`. Missing or conflicting
  balances are not repaired. Legacy client-editable public `uid` is not authority.
- `walletAdapter.debit(transaction, wallet, amount)` is awaited. It must stage
  all wallet/mirror writes in that transaction, preserve unrelated fields,
  perform no external effects and make no additional reads after writes begin.
  Both adapter methods must tolerate Firestore retries. `uidWalletAdapter` is
  the internal real mirror implementation, requiring injected trusted resolvers
  and protected ownership. A separate synthetic adapter remains in unit fixtures.

`getState` validates and transactionally persists completed-date advancement.
Legacy records require the explicit migration operation. Migration adds a
`paidCare.schemaVersion=2` envelope while preserving the legacy schema and all
old fields, progress and opaque SDK values. It writes a separate zero-charge
migration audit; it does not access the wallet. Repeating migration does not
reset needs. It is not an automatic read-time or purchase-time repair.

Purchases require `operationId`, `action`, `expectedConfigVersion`, and
`expectedConfigHash` (the hash returned by `getState`). Adoption additionally
requires exactly name/species/casing/color. No client price, time, owner or admin
fields are accepted. Config changes, including edits under an unchanged version,
require a fresh confirmation. Config storage must still be versioned and protected
by the future administrative layer; this service does not manage config writes.

The successful transaction includes the debit, pet/checkpoint, guaranteed effect
and protected receipt. Receipt binds the exact request and config hash, captures
saved needs, post-decay/pre-care needs and resulting needs, and categorizes the
charge as `pet_spend`. Same-ID/same-payload retry returns that original receipt
even on a later date/config version; changed payload fails. No-op/insufficient/
cap failures throw and leave the entire transaction unchanged, including the
checkpoint. A separate successful `getState` can persist passage of time.

## Calendar and activation contract

Server `now` determines Auckland date/hour. UTC arithmetic counts date labels
only, not elapsed Auckland milliseconds. Adoption/migration date and the current
incomplete day never decline. Weekends, effective-dated pauses, holidays and
merged absence intervals are excluded. History starts no later than migration.
Processed history is fingerprinted; changing it fails closed for separate review.
Calculations are bounded by configured history/interval limits, not missed days.

Disabled reads return the validated pet unchanged, with no checkpoint write;
disabled purchases fail. **Before re-enabling, the administrative layer must
record the disabled interval as control pause history.** Simply changing
`enabled` back to true without that history permits catch-up and violates the
activation contract. The internal teacher service implements inclusive off/on
dates without changing the base-calendar hash; no live endpoint is supplied.
Mid-day pauses and retroactive absence corrections need a separately reviewed
calendar policy; this foundation operates on whole date labels.

Health decline uses hunger/cleanliness at the start of each eligible date.
Needs saturate at 0–4. Defaults preserve the 14-donut full recovery and 16 with
reminder/bedtime, 5 adoption, and 25 care cap. Savings and giving counters never
fund pet purchases. Bedtime before 07:00 binds to the prior evening so midnight
does not allow a repeat charge. A game purchase stores one persistent entitlement
and guarantees its happiness at purchase; other care/reads do not discard it.

## Explicitly incomplete release gates

- Internal reviewed ownership bootstrap, mirror adapter, fractional compatibility
  and coordinated legacy-writer compatibility slices are implemented locally.
  Live approved ownership/provenance, protected resolvers, server-authorized
  writers, deployed exports, client wiring and compatible rules remain missing.
- No game round/completion endpoint: stored entitlement has round 0 only.
- No automatic attention schedule, paid growth-award policy, configurable
  decline/sleep-hour policy, receipt-fetch endpoint, refund endpoint, or public
  activity write. Existing progress is preserved, not advanced by this engine.
- Old handlers now refuse paid pets and permanent cutover markers locally; those
  guards and protected rules must be deployed before any live cutover.
- Internal enabled-only settings control exists; no live settings endpoint,
  editable base-calendar API, retroactive repair or live migration run exists.
- Production receipt privacy, public spending classification, old-client write
  rejection, shared-wallet concurrency, and cloud-stage authorization remain gates.

Baseline unit tests use a synthetic optimistic transaction fixture with read-before-write
enforcement, conflict retries and failed commits. They are not Firestore rules,
Admin SDK serialization or production Auth evidence. Parent separately verified
LR008 ownership and adapter with 12 real Auth/Firestore emulator check groups.
The expanded LR009 harness exercises the actual paid service with injected
synthetic request auth; parent passed14 check groups in11,754ms, including its
new fractional/replay cases. Backend85 runner entries (84 tests plus fixture)
passed340.596ms and lint passed. See the central rollout log for retained logs.
The historical 66-check emulator harness exercises older free care, was not run
for this slice, and is not paid-service verification evidence.
