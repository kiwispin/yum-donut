# LR011 Settings connection — code only, not deployed

The AdminSettings YumPals tab now mounts the dedicated paid teacher component,
not the old free controls. The separate session-only pretend preview is unchanged.
`VITE_YUMPALS_PAID_CONTROLS === 'enabled'` is an independent default-off build gate.
No environment values, rules, claims or live data were changed for this slice.

## Server boundary and deployment guard

Two additive exports are supplied: yumpalsGetPaidSettings and
yumpalsUpdatePaidSettings. Existing Teams/free export names remain unchanged.
Both wrappers require verified-context nonanonymous UID and strict yumpalsAdmin
true BEFORE any readiness information or database access. They then require
defineBoolean YUMPALS_PAID_SETTINGS_READY (default:false) to return strict true.
Denied auth and readiness tests observe zero database transactions.

Readiness is a one-time deployment guard, NOT the pet enable/pause switch and
does NOT stop paid-care operations. After a future reviewed release, keep it true
and use the teacher service's enabled switch to manage inclusive rest periods.
It has not been set true. Until guard/rules/ownership/persistent-client prerequisites
are complete, no student enablement is authorized by this code change.

Trusted refs resolve under yumPalsRoot: config/paidSettings, legacy config/settings,
and config/paidSettings/teachers/{uid}/operations/{id}. The last path is an operation
audit, never a caller-selected document. All core CAS, permanent cutover and
receipt/history rules remain those of teacherSettingsService. Wrapper errors use
allowlisted reason codes and school-friendly copy; unknown errors expose no raw
message or implementation details.

Future deployment must use reviewed selective targets and preserve the live
resetStudentPassword function, which is not represented in this repo. No deploy
command is authorized or executed here. At LR011, real HTTP verification remained
separate from internal tests. LR012 subsequently passed 22 local emulator groups
(17 prior + 5 HTTP) in 20065ms, exit0 with cleanup PASS, including the actual
controller/transport and onCall wrapper using Auth-emulator tokens. See
[SETTINGS_HTTP_VERIFICATION.md](../../../verification/yumpals/SETTINGS_HTTP_VERIFICATION.md)
for the separate sentinel result and retained-artifact limits. This does not prove
production JWT signatures, deployed claims/rules or real AdminSettings login.

## Pinned transport and lifecycle

The paid transport alone uses Firebase's documented callable POST protocol:
https://firebase.google.com/docs/functions/callable-reference
It sends `{data:...}` to the fixed HTTPS us-central1 project endpoint for only the
two allowed names. It captures auth.currentUser, calls that object's getIdToken,
then rechecks object identity, UID, anonymous status and the controller's active
owner/session immediately before fetch. Changing user, sandbox or mount during
token acquisition prevents dispatch. Token acquisition/fetch/JSON have a bounded
timeout, redirects are refused, and tokens are never persisted or logged. Already
sent requests can still commit for the original user; the journal handles that
uncertainty and late UI callbacks are ignored. Legacy Firebase transport is untouched.

The server still verifies ID tokens. This app currently configures no App Check;
this transport adds neither configuration nor an enforcement bypass. Future App
Check enforcement would require a separately reviewed integration.

Only an error-only, non-ok HTTP409, ABORTED response with its own recognized
SETTINGS_CONFLICT reason proves CAS refusal. Mixed result/error, success-status
errors and mismatched statuses stay uncertain. Framework auth failures without
reason details get safe sign-in/access copy, never raw server messages.

App transport is module-stable; the identity getter is memoized by sandbox mode.
Ordinary dashboard snapshots do not remount the controller or reset drafts.
Server reads alone supply the displayed saved On/Off. Unknown state is explicitly
not checked; a save awaiting/losing confirmation is labelled Last confirmed setting.
Every accepted update is followed by a fresh getSettings, because duplicate update
responses describe an earlier operation, not the latest school setting.

## Durable pending save

The controller saves a schema1 project+owner-scoped localStorage journal
synchronously BEFORE dispatch. It contains only owner/project/request, never
funds, credentials or tokens. The exact operation/request survives uncertain
responses and remount/reload. Mount loads current settings but NEVER automatically
replays a write; Retry save is explicit. New edits/double-clicks are locked while
a request remains pending. Accepted receipt clears only an identical journal;
then fresh-read failure permits Refresh without another update. Definite CAS
conflict clears only that same pending request and fetches current settings.
Auth, generic network, corrupt response and uncertain errors retain the request.

Before dispatch and cleanup, storage is compared against the expected serialized
journal. Replacement journals are never overwritten/deleted. Storage failure blocks
dispatch and disables controls with close/reopen instructions. No cross-tab mutex
or cross-device journal exists: sequential controllers are protected, but simultaneous
localStorage check/set is not atomic. Server CAS and operation receipts remain
necessary. Lost storage may lose recovery information; never claim a global lock.

## Local browser fixture and evidence

With the existing Vite server, open:
http://localhost:5173/yum-donut/verification/yumpals/settings-ui.html

It mounts the actual component with synthetic identity, transport and in-memory
journal—no Firebase imports or production request. The prefix is required by the
existing Vite base. Separate test controls offer offline/denied responses, commit
then lost response, held responses, another teacher update, remount and account
switch. Remount keeps pending saves; a full page reload resets the synthetic school.
This is not a user preview feature or deployment artifact. Parent browser review
and real transport integration checks remain independently reported in the central log.

Unit tests cover real wrapper/service transactions and conflicts; pinned delayed
tokens; malformed protocol envelopes; controller lost-response recovery, fresh-read
failure, auth/sandbox/unmount, storage/UUID failures and independent journals.
No old emulator runner changes or emulator executions are part of LR011.

Final local checks: frontend 102/102 tests in 266.209458ms; backend 102/102
entries (101 tests plus fixture load) in 281.75375ms; both lints and diff check
passed. Build passed in 826ms, 1705 modules, JS864.10kB/255.89gzip and
CSS78.45kB/14.60gzip. Existing browser-data age/chunk-size warnings remain.
Fixture HTML and transformed JSX returned HTTP200 on the existing Vite server.
These are local results, not live activation or real HTTP callable evidence.

Parent browser review of the actual component passed: draft On retained Saved
Off until confirmation; normal On/Off saved; lost response showed Last confirmed
and locked new edits; remount preserved pending without automatic retry; another
teacher's change was reflected by the fresh read after retry. Permission denial
cleared the quote and locked Save. Held save/account switch ignored the old
completion and preserved the original account's pending request for explicit
retry. Console errors: 0. At 390px, content width was 390px with no horizontal
overflow; viewport was reset afterward. Existing pretend demo also loaded, its
less-movement setting toggled, and C returned to idle with 25 pretend donuts
unchanged and no errors. This fixture uses in-memory transport, identity and
journal; it does NOT verify real HTTP, AdminSettings login, deployed claims or
production rules. LR012 adds the separate local HTTP evidence linked above;
AdminSettings login and production security remain release checks.

Changed implementation/test paths:

- src/App.jsx (scoped Settings imports, props and mount)
- src/yumpals/YumPalsTeacherSettings.jsx
- src/yumpals/teacherSettingsClient.js and teacherSettingsClient.test.js
- src/yumpals/paidSettingsTransport.js and paidSettingsTransport.test.js
- functions/index.js (two additive exports and default-false parameter)
- functions/src/yumpals/teacherSettingsCallables.js and paidSettingsPaths.js
- functions/test/teacherSettingsCallables.test.js
- verification/yumpals/settings-ui.html and settings-ui.jsx
- functions/src/yumpals/SETTINGS_CONNECTION.md and TEACHER_CONTROLS.md

The central rollout log is parent-owned and was not edited by this coder. No
commit, deployment, claim/rule/environment change or production request was made.
