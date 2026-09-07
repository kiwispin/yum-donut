# LR010 internal teacher controls and permanent legacy cutover

LR011 adds separately gated callable exports, trusted path resolvers and an
AdminSettings client connection; see SETTINGS_CONNECTION.md. They are not
deployed or enabled. The parent owns production
approval and the central rollout log. Request auth in these unit/emulator tests
is injected context, not proof of callable token verification.

## API and transaction boundary

`createTeacherSettingsService({db, refs, now})` requires injected protected
`refs.settings()`, `refs.legacySettings()` and `refs.receipt(actorUid, operationId)`.
Reference paths must be distinct. There are no defaults or inferred display-name
roles. Both methods require a nonempty authenticated nonanonymous UID and the
strict boolean `token.yumpalsAdmin === true`.

`getSettings` accepts absent data or exact plain `{}`. Missing settings with no
cutover marker returns configured:false, enabled:false, null version/hash/settings
without writes. Existing bare engine configs require separately reviewed setup;
the service never fills missing control metadata.

`updateSettings` accepts exactly operationId, expectedVersion,
expectedSettingsHash and boolean enabled. Both expectations must be null for
first initialization. Price/restore/cap patches are deliberately not supported
in this bounded slice; defaults and engine recovery/cap validation are retained.
No caller dates, resulting versions, actor identity or role fields are accepted.
Versions derive from the actor/request binding. Sorted plain settings hashing
is separate from the untouched engine digest and calendar/old receipt hashes.

Each transaction reads receipt, current settings and raw legacy settings before
any write. It validates config/control metadata, marker, clock and version/hash
compare-and-swap. It writes only settings/legacy settings/operation audit, never
wallets or pets. No-op operations add a receipt only. Receipt before/after config
snapshots, hashes, actor and server time bind the operation. Replay validates the
original audited transition and tolerates Firestore map order without rewriting.
An exact duplicate response describes the ORIGINAL operation, not current
settings after someone else's change. The eventual UI must fetch getSettings
after completion/recovery. Edited retries conflict; backwards clocks refuse.

## Permanent legacy closure

First initialization atomically merges `enabled:false` and
`paidCareControl:{schemaVersion:1,mode:'paid',settingsPath:<trusted new path>}`
into the injected legacy settings, preserving unrelated fields/SDK values.
It creates the new config and receipt in that same transaction. The audit stores
only legacy existence and enabled/marker presence/value metadata, not the opaque
legacy document. Missing both configs is allowed. Marker without config, config
without marker, malformed/wrong-path marker or legacy enabled drift refuses for
review; none is repaired. Later disables never remove the marker or reopen free
routes. Re-enabling the paid module does not alter old settings.

All old handlers inspect raw settings before sanitization and refuse ANY own
paidCareControl field, including null/malformed values. Old pet handlers also
refuse ANY own paidCare field before successful replay or writes. Errors ask to
refresh/use updated YumPals. Marker reads participate in the same transactions
as old writes, so a conflicting cutover forces retry/refusal. A read-only old
getState can race a display but cannot write. Marker-absent schema1 behavior
remains supported.

Deployment ordering remains a release gate: updated old guards must be deployed
and rules/server authority must protect marker, settings, ownership and receipts
BEFORE any live cutover. This local code is not a protected-field deployment.

## Inclusive pause history without rewriting the old calendar

Disabling blocks charges immediately. Pauses freeze inclusive Auckland disable
AND resume dates, including weekends and both DST transitions. Same-day toggles
reopen today's last closed interval rather than duplicate it. Only the final
interval can be open, and only while disabled. Intervals are sorted, disjoint,
bounded to 512; exhaustion fails rather than deleting history. Global base
calendar absences must remain empty. Per-UID absence merging needs a future
trusted resolver; controls never copy one pupil's absences globally.

The base historyHash implementation and defaultConfig remain unchanged. Optional
paidCare.pauseHistoryHash binds normalized control-pause intersections from
startedDate+1 through checkpoint, excluding adoption/migration day. Old v2 pets
without the field are accepted only if no pauses intersect processed dates.
Malformed/missing-after-processed or altered hashes refuse, never reset needs.
Disabled getState validates but returns the saved pet unchanged, without writing
checkpoint or hash. Enabled advancement adds the pause hash only when used or
already present. Counting merges pauses with holidays/absences before subtracting
weekdays, avoiding overlap double-counts and per-day loops on long gaps.
For an older pet, enabled reads and purchases process at most yesterday, not
today. A new pause beginning today therefore cannot alter its already-processed
pause history. A service regression checks care before disabling, unchanged
disabled reads, later resume and subsequent normal decline. No hash exception
or retrospective history bypass is needed for this case.

## Evidence boundary

Tests cover strict auth/input, missing default-off initialization, metadata and
marker corruption, receipt ordering/retries, exact CAS, staged/commit rollback,
forced competing admins, disable versus paid purchase, cutover versus old
adoption, old paid-pet receipt bypass, same-day toggles, processed-history tamper,
per-UID absence isolation, long gaps and both DST transitions.

The existing guarded ownership emulator harness now uses actual internal
settings and paid services on one synthetic global config, stages and aborts
initial cutover, checks SDK preservation and real old-handler refusal, then
disables across several dates and resumes without catch-up. The earlier parent
LR009 14-check result does NOT cover these additions. Parent LR010 run passed
17 groups in 11258ms, exit0, with OWNERSHIP_EMULATOR_CLEANUP_PASS. Logs:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-mTbUj2`.
Internal auth remains injected synthetic context; deny-all fixture rules are not
production security rules. Disabled getState remains permitted but writes no pet
state; charges are blocked. Final local backend: 98/98 entries (97 tests plus
fixture load), 260.547166ms, including the older-pet-before-toggle regression;
lint, syntax and diff checks passed. No emulator rerun for label/docs-only edits.
