# UID wallet adapter — internal, not activated

`createUidWalletAdapter({ refs })` supplies `read(transaction, uid)` and awaited
`debit(transaction, wallet, amount)` for `createPaidCareService`. Resolvers are
trusted server dependencies: `mapping(uid)`, `publicProfile(publicProfileId)` and
`privateProfile(uid)`. No live paths, callable exports or bootstrap are supplied.
The public ID is an opaque locator from protected mapping, never a request name
or a name search. Private profiles are resolved only by authenticated UID.

Required protected mapping: `{ schemaVersion: 1, ownerUid, publicProfileId }`.
Both existing profiles must have protected `ownerUid` equal to that UID. Any
legacy `uid` field, if present, must also agree. Both balances must be equal,
nonnegative safe integers. Missing, corrupt or conflicting records refuse care;
there is no fallback zero, selected larger balance, automatic repair or savings
withdrawal. Private balance is usable only after mirror equality is established.

The adapter reads mapping and both profiles before staging either write. Both
balance changes participate in the service's pet/receipt transaction. Every
other field is retained, including bank, Given, lifetime totals and opaque SDK
values. A handle is immutable, transaction-bound and single-use; only one wallet
read is allowed per transaction attempt. Firestore retries use fresh transactions.

## Bootstrap and release prerequisites

- Audited, separately authorised bootstrap must establish unique UID-to-public
  record ownership, independent of client-written names/UID fields. Existing
  records lack the required trusted owner assertions. Same-name, renamed,
  ambiguous or conflicting accounts require review, not merging or guessing.
  Bootstrap must protect mapping and ownership fields and reconcile conflicting
  financial records with an audit trail without erasing balances or history.
- All overlapping rules must deny client bypass writes. Mapping and injected
  resolvers are a trusted boundary, not something this library can authenticate.
- Coordinate the public-to-private snapshot sync, profile creation, shop,
  sponsorship, gifting/Teams, Arcade/training/Muncher, bank moves, goal
  contributions (including stale private update), nontransactional bounty pay,
  and nontransactional bank interest. Each must obey the same atomic mirror
  protocol. Existing writers have NOT been changed or certified here.
- Synthetic coordinated-writer tests demonstrate transaction retries, not safety
  against legacy stale writes AFTER a successful commit. Such writes can still
  resurrect spent donuts; activation remains blocked until removed/protected.
- Still required: reviewed production resolvers/bootstrap, compatible rules and
  shared writers, real emulator integration, persistent endpoints/UI, teacher
  server permissions and default-off activation. No deployment or live writes.

Earlier refused approaches remain refused: name-based authority, legacy public
UID as proof, zero repair, unawaited debits, separate mirror writes, or claiming
synthetic tests certify existing financial workflows. This adapter is pending
parent acceptance; it does not supersede those release gates.

## Local evidence — 2026-09-08, pending independent acceptance

The first seven-test run passed six and failed its concurrency-conflict assertion:
uncontrolled scheduling did not force overlap (118.069167ms locally; parent
independently reported 171.755083ms). That evidence was refused. The corrected
test retains the assertion and uses an explicit barrier after care wallet reads,
letting the coordinated reward commit before care resumes and retries. It does
not remove the assertion or claim the legacy writers are safe.

Corrected targeted run: 9 actual adapter tests passed in 217.37275ms, including
second-set staging failure and real Admin SDK Timestamp/GeoPoint preservation.
Full backend runner: 57 passing entries in 292.084625ms, comprising 56 actual
tests and one fixture-module load. Backend lint and whitespace check exited 0.
No emulator, live-account test, endpoint export, frontend change or deployment
was performed for this slice. Parent owns the central live-rollout log.
