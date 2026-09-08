# LR012 — real local HTTP verification, parent-verified

Baseline4ed53a6. Verification assets/docs only; production app, engines, exports,
transport, readiness parameter, rules and environment flags are unchanged. No
emulator was run by the coder. The old run-emulator-verification.mjs is untouched.

## Run (parent only)

All five ports must be free: Firestore8180, Auth9199, Functions5101, hub4401,
logging4501. From the repo root:

```sh
/tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin/node verification/yumpals/run-ownership-verification.mjs
```

Failure/cleanup check (separate run, expected nonzero exit with cleanup PASS and
no verification success marker):

```sh
YUMPALS_OWNERSHIP_SENTINEL=cleanup /tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin/node verification/yumpals/run-ownership-verification.mjs
```

No overlapping runs. The harness owns only its spawned process group and waits
for all five ports to close. The sentinel runs AFTER callable-definition probes,
not merely TCP startup. Success requires OWNERSHIP_VERIFICATION_PASS plus
OWNERSHIP_EMULATOR_CLEANUP_PASS. Startup/assertion/cleanup failures remain nonzero.

## Isolation and actual imported code

The launcher enforces demo-yumpals-ownership and exact 127.0.0.1 endpoints; child
environment is allowlisted without inherited credentials. Both runner and the
verification-only Functions entry use in-memory ephemeral RSA certificates,
never ADC or persisted keys, and refuse OAuth token requests. Entry guard runs
before SDK imports/initialization and requires CLI-owned FUNCTIONS_EMULATOR=true,
the exact hub/Auth/Firestore endpoints, demo project and matching Firebase config.
The runner separately requires Functions5101; any supplied worker Functions-host
override must also match. Discovery's SDK control port is ephemeral and is not
the public Functions port. The source folder admits only
guard.cjs/credential.cjs/index.cjs/package.json, not environment or key files.

The installed CLI's emulator controller uses path.join(projectDir, source), so
the temp config contains a relative source path checked with realpath against
the exact local settings-functions directory. Absolute source was not assumed
safe. NODE_PATH points only at existing functions/node_modules for CLI SDK
discovery; the entry imports dependencies/actual wrapper/paths using createRequire
anchored at functions/package.json. No installs or symlinks are made. The test
package is not a deployment source and its ready:true is only inside guarded
verification. Production YUMPALS_PAID_SETTINGS_READY remains unchanged/defaultfalse.

Four actual onCall definitions are probed through unauthenticated HTTP errors
before checks: the two normal names and two test-only not-ready names. Requests
do not fabricate auth context from their body. The core17 historical checks are
retained; their settings resolver now uses actual config/paidSettings and nested
teacher operation paths, so HTTP uses the same permanent cutover marker and
initial synthetic-a/initial receipt without resets. Fixture server time is fixed
at 2026-09-14T00:00Z, matching the end of the core pause checks.

## Added checks

- Fresh Auth-emulator tokens after synthetic teacher claims; student/anonymous/
  absent/malformed token refusal, forged request-role/UID refusal, not-ready get/
  update and malformed input with unchanged config/marker/audits.
- Actual saved quotes, off/on HTTP changes, original historical receipt replay
  without writes and exact HTTP409 ABORTED SETTINGS_CONFLICT for stale CAS.
- Actual frontend controller and pinned transport with an exact two-URL routing
  adapter that forwards only to fixed loopback Functions, preserving options,
  token and body. No request reaches the external demo URL.
- Successful update is consumed then deliberately dropped AFTER commit; exact
  journal schema has no token/credential fields. Another authenticated teacher
  changes state. Remount performs no auto-submit; explicit same-ID retry keeps
  the original receipt, adds no effect/audit and displays latest state via get.
- Actual409 through transport clears the matching pending journal and reloads
  current state with no receipt for the refused operation.
- Complete wallet, pet, existing paid receipt and ownership audit snapshots stay
  unchanged by Settings. The paid receipt is resolved from the actual core
  purchase operation ID and required to exist, not compared as an absent document.
- Sixteen direct settings/receipt REST read/write denials under local deny-all
  rules for missing/anonymous/student/teacher tokens.

Parent corrected LR012 run passed all 22 groups (17 prior + 5 HTTP) in 20065ms,
exit0, with OWNERSHIP_EMULATOR_CLEANUP_PASS. All five ports were independently
confirmed free. Success directory:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-WI0Eeg`.
The successful directory has no firebase-debug.log; this is not a retained
complete Functions trace. Generated config/rules, Firestore logs and isolated
CLI/cache files remain. Parent's regex key/JWT scan of retained text found no
matches; this limited scan is not proof about unretained output.

The separate cleanup sentinel passed as intended: exit1, “Intentional cleanup
sentinel after readiness”, OWNERSHIP_EMULATOR_CLEANUP_PASS, and no verification
success marker. Retained temporary directory:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-1qmFKb`.
Parent helper tests passed 5/5 in 646.695416ms; syntax and diff checks passed.
The original LR010 17-group run (11258ms) remains historical evidence, distinct
from this expanded run. The coder did not run either emulator invocation.

REFUSED first parent startup: discovery did not inherit the custom
YUMPALS_SETTINGS_HTTP_FIXTURE variable. No callable loaded; the definition probe
correctly refused to accept the CLI's readiness banner. Parent reported cleanup
PASS and all five ports free. Reported log location:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-21R6FJ/firebase-debug.log`.
This is failed-startup/cleanup evidence, not HTTP verification.

Corrected using the installed CLI's required built-in markers, not .env files or
inherited credentials. functionsEmulator.js builds discovery from system env,
emulator env and FIREBASE_CONFIG; node/index.js forwards only that plus a few
selected process variables. getEmulatorEnvs supplies FUNCTIONS_EMULATOR=true and
the hub/Auth/Firestore addresses, but not FUNCTIONS_EMULATOR_HOST. The new test
calls the actual installed discovery/worker environment builders with an in-memory
registry; it starts no emulator and checks missing required fields fail in both.
Four guard/routing/source-resolution tests passed in 776.473125ms; syntax and diff
checks passed. This intermediate result preceded the corrected parent run above.

Pre-rerun logging correction: installed functionsEmulatorRuntime logs named Admin
initialization options through EmulatorLog.toStringCore's JSON.stringify. The
supported ServiceAccountCredential exposes enumerable private-key internals.
A verification-only non-enumerable toJSON hook now returns a fixed redacted label
before either initialization; SDK instance/prototype/private fields remain intact
and getAccessToken still refuses OAuth. No logger monkeypatch, ADC or replacement
credential scheme is used. The actual installed EmulatorLog compact/pretty
serializers and pure Firestore options conversion are covered by a memory-only
test, including a synthetic cached-token field. No PEM/private-key/token survives
serialization, while the SDK still receives its expected certificate fields.
Five local guard/serialization/routing tests passed in 834.501584ms; syntax/diff
checks passed. The first startup failed before certificate generation in the
Functions entry. The corrected parent HTTP/sentinel results are recorded above.

Emulators differ from production and can decode unsigned test JWTs. Malformed
token refusal is NOT JWT signature-authenticity proof. Deny-all fixture rules
are NOT compatible production rules. Production real-login, token validation,
teacher claims, App Check policy, live ownership/rules and selective deployment
remain release gates. No claims of deployed readiness or student activation.
