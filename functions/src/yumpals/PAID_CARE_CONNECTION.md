# LR013 saved paid-care connection core — internal, not activated

Baseline d76c9c3. No UI, production exports/resolvers, flags, rules, claims,
deployment or live data changes. Parent owns acceptance and the central log.

## Backend contract

`createPaidCareService` retains valid `getState` and legacy purchase response
contracts. `getState`/`migrate` now accept only absent data or plain empty data.
Additive `getHandheldState` reads config, pet and trusted UID wallet in one
transaction before advancement writes. It projects schema/owner, enabled,
config version/hash, known prices/restores/cap, server timestamp and Auckland
date/hour; pet identity/accessibility/progress plus needs/daily/sleep/attention/
round-zero game fields; and wallet `{available:true,balance}` or
`{available:false}`. No raw profile, mapping, calendar or opaque fields escape.
Missing paid envelope on valid legacy state requires explicit migration; corrupt
state never becomes a new pet. No automatic adoption or migration.

Only TRUSTED_MAPPING_REQUIRED, INVALID_WALLET_MAPPING, WALLET_MIRROR_MISSING,
WALLET_OWNER_CONFLICT, INVALID_WALLET_BALANCE, WALLET_BALANCE_CONFLICT, or an
invalid returned wallet produce unavailable wallet. Other failures abort. Unknown
is never zero. Fractional balances and opaque stored fields are preserved.

`createPaidCareCallables` is an internal injected factory with required refusal
refs and strict nonanonymous UID before default-closed readiness/database access.
It exposes only safe state and purchase handlers. Purchase returns
`{outcome,duplicate}` with a whitelisted COMMITTED or REFUSED outcome. No index
export or live paths are supplied. Readiness is separate from school enabled.

## Terminal refusal barrier

With `refs.refusal(uid, operationId)`, every purchase reads both receipt and
refusal before deciding. Distinct paths are required; dual outcomes fail closed.
The unchanged canonical request/hash binds both. Success receipts remain
unchanged. A recognized pure pre-write business refusal (disabled, reconfirm,
no effect, insufficient funds, cap, no pet, already adopted or active game)
commits only an immutable separate refusal audit. Staging/database/commit/auth/
corruption failures never become refusal records. Same-ID success/refusal
attempts contend on the same reads and cannot subsequently reverse the outcome.

All exposed callers must use this barrier. Legacy internal instances without
refusal refs retain old behavior; they must not overlap exposed financial
requests. A raw attempt-level insufficient-funds error was demonstrated to race
with an older transaction that later committed after wallet changes. Therefore
HTTP business errors are NOT durable terminal proof and cannot clear a journal.

## Client contract

Dedicated pinned transport allows only the two proposed paid names, exact request
payloads and fixed regional project URL. It captures the user token method and
rechecks identity/session before dispatch, uses a bounded timeout and refuses
redirects. No token logging/storage, client debit or legacy transport change.

Controller explicitly prepares and confirms adoption/care. Adoption validation
and normalization match server rules before persistence. Owner/project journal
stores exact request plus original integer quotedCost (metadata, never sent).
It is saved/checked before dispatch and compared before cleanup. No automatic
purchase/retry on mount; uncertainty blocks new IDs until explicit recovery.
Only validated terminal outcomes clear it. Payment checks include canonical
binding, original quoted amount and exact fractional subtraction/conservation;
the old quoted wallet is not compared because gifts may occur concurrently.
Fresh state follows terminal recovery; historical receipts are never current
wallet/needs. Only explicit original nonduplicate success emits a presentation
event. Callback failure cannot obscure commitment or skip the fresh read.

REFUSED initial client behaviors: invalid 17-character adoption dispatched and
left a pending journal; throwing presentation callback after success falsely
said the cleared journal was retained. Both now have focused regression tests.
No UI is wired. Game completion, attention scheduling and growth remain absent;
this does not turn the demo initializer/reducer into saved account logic.
LocalStorage comparisons are not an atomic cross-tab lock; lost storage and
cross-device recovery remain limitations. Server idempotency remains mandatory.

## Final parent verification — local only

Parent final frozen-source frontend117/117 passed454.398167ms; backend111 runner
entries (110 cases plus fixture load) passed395.785084ms. Both lints exit0;
build815ms,1705modules,
unchanged JS864.10kB/255.89gzip CSS78.45kB/14.60gzip. Existing browser-data and
bundle-size warnings remain. Harness-helper5/5 passed916.115083ms. These final
figures supersede interim unit-suite measurements; unit tests alone are not
HTTP proof. Parent separately passed the actual emulator run below.

Final targeted review correction: blocked refresh/prepare clears quote and
confirmation before notifying after an identity switch, without deleting the
original journal. Read failures give allowlisted sign-in, teacher-update or
not-ready guidance; unexpected no-effect action copy has a safe fallback.
The final parent suites include these corrections and the SDK retry correction
recorded below.

## SDK retry correction

Installed Firestore reuses its raw Transaction object for updateFunction retries.
The UID adapter intentionally permits only one read per attempt identity; handing
it the reusable SDK object caused WALLET_ALREADY_READ after a conflict. Every
paid-service callback now creates a fresh forwarding facade, kept stable within
that attempt. Adapter WeakSet/context protections and engine hashes are unchanged.
Other adapter callers must likewise provide attempt-scoped transaction identity;
the adapter must not be weakened to permit repeated reads within one attempt.

Deterministic real-adapter tests force a mirror gift conflict using the same raw
proxy on retry, covering both handheld view and purchase and preserving duplicate
read refusal. These regressions are included in the final parent suite above.
The guarded harness adds an internal actual-SDK ABORTED-once check after wallet
read for view and purchase. It asserts reused raw identity and distinct facades.
This is synthetic injected retry/auth, not an HTTP hook or deployed evidence.

The SAME guarded ownership verifier retains22 prior groups and adds4 paid HTTP
groups after Settings. It uses6 definition probes, the same5 loopback ports,
demo-only guards, supported ephemeral redacted credentials and cleanup sentinel.
Only the verification entry binds actual UID adapter to synthetic paths with
refusal refs; prior legacy-service checks retain their original dependencies.
Paid clock is trusted fixed Sep16. Explicit internal synthetic teacher setup
resumes inclusive pauses; explicit hunger2 fixture setup permits a meal without
claiming offline deterioration. Checks cover student auth/safe view, unavailable
unmapped wallet, fractional bedtime/replay, actual controller/transport lost
response plus gift/recovery, and immutable no-effect refusal after changed needs.
SDK pet extras and complete wallet metadata are compared for preservation.
An additional fifth group checks the real SDK retry boundary described above.
Paid readiness is unit-tested, not claimed as HTTP-tested: no extra blocked
paid endpoints were added. Parent runs the harness; coder runs no emulators.

Use the existing command/sentinel in
[SETTINGS_HTTP_VERIFICATION.md](../../../verification/yumpals/SETTINGS_HTTP_VERIFICATION.md).
LR012's22-group pass remains historical baseline. Parent's expanded run passed
27 groups = 22 prior + 4 paid HTTP + 1 actual-SDK injected ABORTED group, exit0,
elapsed24635ms, with OWNERSHIP_EMULATOR_CLEANUP_PASS. Artifact directory:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-6ds89E`.
Successful-run artifacts are firebase.json, ownership.firestore.rules,
firestore-debug.log and isolated CLI/cache files; no complete Functions trace
is retained. The separate LR013 sentinel exited1 as intended after six callable
definitions/readiness, with OWNERSHIP_EMULATOR_CLEANUP_PASS and no verification
success marker. Sentinel directory:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-ajlA8s`.
Parent independently confirmed all five ports free after both runs. Parent syntax
checks for all new JS/MJS/CJS and diff check passed. Sentinel cleanup evidence is
separate from the 27 verification groups.
Emulator Auth is not production JWT-signature proof;
deny-all fixture rules are not compatible production rules. Live ownership,
server-authorized shared writers/rules, actual saved handheld UI, game completion
and selective deployment remain release gates. No student activation or live
financial authorization is established by these local results.
