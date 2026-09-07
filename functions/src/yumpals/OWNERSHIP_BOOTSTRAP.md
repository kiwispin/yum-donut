# Reviewed ownership bootstrap — internal foundation only

No live endpoint, paths, operator manifest, protected-source implementation or
default authorizer is provided. Nothing here is exported by `functions/index.js`.

## Authority and API

`createOwnershipBootstrap({ db, authAdmin, refs, loadApprovedManifest })` exposes
`dryRun(reviewId)` and `apply(reviewId)`. Neither accepts a client manifest, name
lookup or claimed teacher role. The injected loader must return
`{ manifest, approvedDigest }` from an independently reviewed, immutable,
protected operator source. Computing a hash is NOT approval. In production the
loader must verify approved provenance/access; a client-writable document or a
display-name teacher check is not an acceptable implementation. No actual
student assignment has been approved or loaded during this implementation.

Manifest schema 1 has exact fields `reviewId`, `schemaVersion`, `approval` and
`entries`. Approval contains `operatorUid`, `source`, `approvedAtMs` and
`decision: approved`. Each entry specifies exact `uid`, `publicProfileId`,
`expectedPublicHash`, `expectedPrivateHash`. The loader's approved digest binds
the entire plain manifest, including provenance. Duplicate UIDs/public IDs,
unapproved or changed content are refused. No passwords or Auth records are
returned or stored.

`refs` must provide distinct server-owned public/private profile, forward UID
mapping, reverse public-record mapping and per-review audit references. Batches
are limited to 40 assignments: at most 161 Firestore reads, 161 writes and 40
Auth lookups per transaction attempt. Profiles use field-only ownerUid updates.
Mapping schema matches the paid-care adapter: schemaVersion 1, ownerUid and
publicProfileId. Reverse mapping is mandatory; incomplete/conflicting pairs
refuse rather than repairing or remapping them.

## Reviewed projection, not entire profile

`snapshotFingerprint` hashes projection version 1 with explicit own-property
presence for: uid, name, claimed, ownerUid, balance, bank_balance, lifetime_given,
lifetime_received, given_today, last_given_date, training_earned_today and
training_last_earned_date. Absent, null and zero differ. Unexpected non-plain
values in these reviewed fields fail closed. `manifestFingerprint` separately
digests plain manifests/audits. Unrelated cosmetics, progress and SDK objects are
never hashed, serialized, copied or interpreted by the bootstrap.

REFUSED draft used whole-profile canonical hashing, which unnecessarily blocked
unrelated cosmetic/progress changes. The corrected projection explicitly tests
that these changes do not block application and their opaque values survive.

Both existing wallets must be equal nonnegative safe integers, matching the
current paid-care adapter. Fractional legacy wallets require a separate reviewed
money-domain decision; no rounding is performed. Bank fields must both exist,
be valid finite nonnegative values and agree; unlike legacy compatibility this
migration does not apply missing-bank defaults. Zero is valid only when actually
present and reviewed. Existing public profiles must already have `uid` equal to
the approved UID and `claimed: true`, so coordinated legacy writers can use the
result. Missing or mismatching public linkage requires separate reviewed repair;
the bootstrap never writes these fields. Private uid is optional but must agree
when present. Any existing ownerUid must agree. These compatibility checks are
NOT ownership authority: independent approval remains mandatory. Display names
are reviewed data, not authority.

Apply rechecks the reviewed projection on every Firestore retry. Changed finance
or identity requires re-review, never overwriting a newer value. After a review
commits, exact audit replay is read-only and permits newer valid financial data;
it verifies current ownership, mapping pairs and mirror validity. A new review
of an already mapped pair adds its audit without rewriting the existing pair.

## Limits and release gates

Auth Admin verifies UID existence, disabled:false and a nonempty non-anonymous
provider list on every attempt. Custom-token-only accounts with no linked
providers are not automatically eligible. Auth and Firestore cannot be read or
committed atomically together; an operator-controlled migration window and
production coordination are still required. Transient Auth/Firestore errors
abort the run; dry-run reports known per-item conflicts without profile details.

All profile assertions, mapping pairs and audit commit atomically, or none do.
No balance, savings, Given, lifetime total, profile history or Teams allowance is
repaired or migrated. Teams-only allowance carryover, server operator access,
protected sources/rules, competing legacy writers, emulator verification of the
complete paid/UI flow and deployment review remain open. Synthetic tests are not live financial
certification. Parent owns central acceptance and rollout logs.

## Isolated real-emulator verification (parent-run)

From the repository root, with ports 8180, 9199, 4401 and 4501 free:

```sh
/tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin/node verification/yumpals/run-ownership-verification.mjs
```

The harness uses the existing `/usr/local/bin/firebase` and Java runtime at
`/tmp/yumpals-java.aAqx58/jdk-21.0.12.1+1-jre/Contents/Home`. No installation is
performed. It refuses conflicting project variables, non-loopback or unexpected
emulator endpoints, occupied ports and non-demo configuration. It starts only
Auth and Firestore with a temporary configuration and deny-all local rules,
explicit synthetic Admin credentials, and synthetic users/profiles. It does not
run Functions, existing free-care callables, or production rules. Logs are kept
in the printed temporary directory. Do not run concurrently with another harness.

Checks cover real Auth eligibility, dry-run, same-name distinct assignments,
concurrent same-review replay, SDK preservation, reviewed financial drift,
duplicate UID/public assignments, incompatible linkage and client REST denial.
Ownership rollback deliberately throws after one and three real staged writes
(including a mapping), then compares original profiles and absent maps/audit.
A separate adapter check throws after staging the mirror debit and verifies both
complete profiles and audit remain unchanged. These print distinct PASS labels;
they are not the infrastructure cleanup sentinel.

To verify failure propagation and managed cleanup separately:

```sh
YUMPALS_OWNERSHIP_SENTINEL=cleanup /tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin/node verification/yumpals/run-ownership-verification.mjs
```

The sentinel intentionally fails after emulator readiness: expect a nonzero exit,
`OWNERSHIP_EMULATOR_CLEANUP_PASS`, and an intentional-sentinel failure message,
not `OWNERSHIP_VERIFICATION_PASS`. Normal success requires the cleanup marker
and final verification marker. Startup, assertions and shutdown failures propagate
as nonzero exits. The harness owns and stops only its spawned process group.

REFUSED first harness run exited 1 before verification checks: the arbitrary
credential object was unsupported by Admin Firestore initialization. Parent
observed `OWNERSHIP_EMULATOR_CLEANUP_PASS`; that is cleanup evidence only, not
financial verification. The corrected harness uses `admin.credential.cert` with
an ephemeral RSA PEM generated in memory, never persisted or logged. Demo and
both loopback endpoint guards run again immediately before SDK initialization;
OAuth token requests explicitly throw instead of contacting a token service.
Firestore/Auth initialization now sits inside app cleanup, with optional database
termination and unconditional app deletion even when termination fails.

Parent execution on 2026-09-08 passed all 12 check groups in 11,136ms, exited0,
and printed both cleanup and verification success markers. The separate cleanup
sentinel exited1 with the intentional failure and cleanup marker, with no
verification success marker. Conflicting-project and non-loopback-host guards
also exited1 before boot, and all four emulator ports were confirmed free.
The first, refused credential attempt is documented above and in the central
log; it is not counted as successful evidence. Backend regression passed78
runner entries (77 tests plus fixture load) in318.042ms; backend lint passed.

Local deny-all REST tests are evidence only for these synthetic rules, not
production authorization or release readiness. Auth/Firestore atomicity,
reviewed live ownership, shared-writer and paid UI integration gates remain open.
