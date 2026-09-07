# Paid-care foundation: synthetic integration only

This additive engine/service is not imported by `functions/index.js`, old callables,
or the app. It has no default Firestore paths or production wallet adapter.

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
  Both adapter methods must tolerate Firestore retries. The only implementation
  is the test fixture, whose canonical wallet is synthetic and owned by UID.

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
record the disabled interval as paused calendar history.** Simply changing
`enabled` back to true without that history permits catch-up and violates the
activation contract. No enable/disable endpoint is supplied in this slice.
Mid-day pauses and retroactive absence corrections need a separately reviewed
calendar policy; this foundation operates on whole date labels.

Health decline uses hunger/cleanliness at the start of each eligible date.
Needs saturate at 0–4. Defaults preserve the 14-donut full recovery and 16 with
reminder/bedtime, 5 adoption, and 25 care cap. Savings and giving counters never
fund pet purchases. Bedtime before 07:00 binds to the prior evening so midnight
does not allow a repeat charge. A game purchase stores one persistent entitlement
and guarantees its happiness at purchase; other care/reads do not discard it.

## Explicitly incomplete release gates

- No production paths, trusted identity bootstrap, mirror compatibility,
  legacy-writer migration, live export, client wiring or rules change.
- No game round/completion endpoint: stored entitlement has round 0 only.
- No automatic attention schedule, paid growth-award policy, configurable
  decline/sleep-hour policy, receipt-fetch endpoint, refund endpoint, or public
  activity write. Existing progress is preserved, not advanced by this engine.
- No legacy free-callable version gate. Keeping the legacy outer schema is for
  preservation only; old endpoints MUST reject migrated pets before any release.
- No config/calendar admin API, retroactive history repair or live migration run.
- Production receipt privacy, public spending classification, old-client write
  rejection, shared-wallet concurrency, and cloud-stage authorization remain gates.

Tests use a synthetic optimistic transaction fixture with read-before-write
enforcement, conflict retries and failed commits. They are not Firestore rules,
Admin SDK serialization or production Auth evidence. The existing 66-check
emulator harness exercises older free care and was not run for this slice.
