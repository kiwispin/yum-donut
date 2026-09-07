# YumPals security verification

This is a local emulator staging harness only. It is not cloud staging: no accessible cloud `demo-yumpals-stage` project exists, and the production project is `yum-donut-school`. The harness refuses any project other than `demo-yumpals-stage`, uses only loopback endpoints, does not load production credentials, and does not deploy or write live data.

## Files in this verification scope

- [`firebase.yumpals-emulator.json`](firebase.yumpals-emulator.json) — candidate local emulator configuration.
- [`verification/yumpals/candidate.firestore.rules`](verification/yumpals/candidate.firestore.rules) — candidate scoped rules.
- [`verification/yumpals/baseline.firestore.rules`](verification/yumpals/baseline.firestore.rules) — read-only production baseline fixture.
- [`verification/yumpals/firebase.baseline.json`](verification/yumpals/firebase.baseline.json) — baseline-phase config with paths relative to its own directory.
- [`verification/yumpals/functions-entry.js`](verification/yumpals/functions-entry.js) — local-only Functions wrapper.
- [`verification/yumpals/package.json`](verification/yumpals/package.json) — source metadata for the emulator; it adds no dependencies.
- [`verification/yumpals/run-emulator-verification.mjs`](verification/yumpals/run-emulator-verification.mjs) — REST/Auth/Admin/callable harness.

No application, UI, backend source, production `firebase.json`, package manifest/lockfile, or central YumPals log is changed by this verification work.

## Runtime and command

The parent-provided, checksum-verified runtimes and downloaded Firestore emulator are used in place. There is no install or dependency upgrade. Run this only after any manually booted emulator process has been stopped; the runner owns both phases and refuses occupied ports.

```sh
PATH=/tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin:/tmp/yumpals-java.aAqx58/jdk-21.0.12.1+1-jre/Contents/Home/bin:$PATH \
FIREBASE_CLI_BIN=/usr/local/bin/firebase \
/tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin/node \
verification/yumpals/run-emulator-verification.mjs
```

The runner starts and stops the Auth, Firestore, and Functions emulators twice, on these fixed local ports:

| Service | Port |
| --- | ---: |
| Firestore | 8180 |
| Auth | 9199 |
| Functions | 5101 |
| Emulator hub | 4401 |
| Emulator logging | 4501 |
| Emulator UI | disabled |

All REST and callable URLs are hard-coded to `127.0.0.1`. The runner also sets `GCLOUD_PROJECT`/`GCP_PROJECT` to `demo-yumpals-stage` and verifies every config port before boot.

After TCP readiness, it probes `yumpalsGetState` and waits for the exported callable to return the expected unauthenticated response. A listening Functions port alone is not treated as proof that the five definitions loaded.

The cleanup path does not return from `finally` and cannot turn a failed phase into a success. A deterministic, emulator-free nonzero-exit sentinel can be checked with:

```sh
YUMPALS_VERIFICATION_SENTINEL=1 \
/tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin/node \
verification/yumpals/run-emulator-verification.mjs
```

This must print `YUMPALS_SECURITY_VERIFICATION_FAIL` and exit nonzero; it does not bind ports or contact any service.

To exercise cleanup after the emulator and callable are ready, use the separate sentinel below. It intentionally throws inside the managed work callback, so a nonzero exit is expected and no PASS line is valid. The parent should confirm ports 8180, 9199, 5101, 4401, and 4501 are free afterward:

```sh
YUMPALS_VERIFICATION_SENTINEL=cleanup \
PATH=/tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin:/tmp/yumpals-java.aAqx58/jdk-21.0.12.1+1-jre/Contents/Home/bin:$PATH \
/tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin/node \
verification/yumpals/run-emulator-verification.mjs
```

If the parent is doing a manual candidate review, the equivalent candidate boot is:

```sh
PATH=/tmp/yumpals-java.aAqx58/node-v22.23.2-darwin-arm64/bin:/tmp/yumpals-java.aAqx58/jdk-21.0.12.1+1-jre/Contents/Home/bin:$PATH \
firebase emulators:start --config firebase.yumpals-emulator.json \
  --project demo-yumpals-stage --only auth,firestore,functions
```

Do not run that command while the harness is running. After the entry-point host guard was tightened, a previously running manual process should be stopped and restarted once before relying on the new guard.

## Functions isolation

The deployed repository entry point remains [`functions/index.js`](functions/index.js), whose configured Firebase codebase is `teams`. The current production inventory has `teamsBot` and the existing password-reset export; it has no deployed YumPals functions.

The emulator config instead points to `verification/yumpals`, whose entry point exports only these five real handlers:

- `yumpalsGetState`
- `yumpalsAdopt`
- `yumpalsCare`
- `yumpalsUpdatePet`
- `yumpalsUpdateSettings`

The wrapper uses the same `onCall` wrapper and `us-central1` region as the real export and imports `createYumPalsHandlers` from the existing Functions source. It contains no stub business logic and never imports the Teams entry point or declares Teams secrets. Its `createRequire` resolves the already-installed `functions/node_modules`; it does not install packages or require a symlink. Before `admin.initializeApp`, it fails closed unless the project is `demo-yumpals-stage`, `FIRESTORE_EMULATOR_HOST` is loopback port 8180, and `FIREBASE_AUTH_EMULATOR_HOST` is loopback port 9199.

This wrapper is a verification-only entry point. It is not a deployment target and does not change the deployed Functions inventory.

## Rule fixtures

The read-only production snapshot supplied for this review is stored as a semantically exact normalized fixture in [`verification/yumpals/baseline.firestore.rules`](verification/yumpals/baseline.firestore.rules). Whitespace and presentation are normalized; this is not a byte-for-byte source reproduction:

```text
rules_version='2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read: if true; } match /{document=**} { allow write: if request.auth != null; } } }
```

Reference: production release `projects/yum-donut-school/releases/cloud.firestore`, ruleset `7b40979e-05c0-46de-8631-41bdc54ac695`, updated 2025-12-19. The fixture is a baseline reference, not a security claim.

The candidate fixture is a partition, not a global deny. It preserves the baseline public-read/authenticated-write permissions for:

- non-`artifacts` root documents and descendants;
- the `artifacts/{appId}` root document;
- every `artifacts/{appId}/{section}/**` branch except the exact `appId == 'yum-donut-school'` and `section == 'yumpals'` branch.

The candidate therefore denies direct client reads and writes throughout `artifacts/yum-donut-school/yumpals/**` without a broad allow overlapping that branch. Callable Admin SDK writes bypass client rules as intended; callable authorization is separately checked by the five handlers.

## What the runner measures

Phase 1 boots the baseline fixture and uses Firestore REST to prove locally that an authenticated write and unauthenticated read are allowed in the YumPals path and a nested legacy path. This deliberately demonstrates the insecure baseline behavior only inside the disposable emulator.

Phase 2 boots the candidate fixture and uses the Auth emulator REST API to create teacher, student A, student B, corrupt-state, and anonymous accounts. The teacher receives `yumpalsAdmin: true` only through the local Admin SDK, then obtains a refreshed local Auth ID token. Tokens and passwords are never printed.

The candidate phase exercises measured callable behavior for:

- missing, anonymous, student-forged-admin, malformed-token, forged-admin, and real teacher-admin requests;
- two same-name pets owned by different UIDs;
- trusted server Auckland date versus a spoofed client date;
- concurrent feed/pat, concurrent duplicate operation IDs, atomic daily state, and exact audit counts;
- disabled-setting preservation and no care/audit write while disabled;
- settings visibility and admin visibility;
- corrupted persisted state failing closed without a repair/reset write;
- direct Firestore REST read/write denial for unauthenticated, anonymous, and student principals throughout the new namespace;
- public reads/authenticated writes preserved for artifact root documents, nested legacy documents/leaves, and non-artifact root documents.

The emulator must compile both rule fixtures as part of startup. A compile failure, wrong project, wrong port, Functions boot failure, unexpected status, or failed callable invariant makes the command fail. The final line is `YUMPALS_SECURITY_VERIFICATION_PASS checks=... elapsedMs=...`; no such line should be recorded until the parent runs the command and retains its measured output.

The Auth emulator is not a production token-signature verifier. If its local behavior accepts the deliberately forged JWT, the runner records that as an emulator limitation and does not treat it as production Auth evidence; the malformed-token check remains required, and the real server-side `yumpalsAdmin` claim check is exercised with a token issued after the local Admin SDK claim seed.

## Parent-run measured evidence

Parent-reported full real run: exit 0, `checks=66`, `elapsedMs=26921` (approximately 27 seconds). Direct protected Firestore REST requests returned 403, allowed outside-subtree requests returned 200, and concurrency/audit, admin gating, disabled preservation, and corruption checks succeeded. The forged JWT was accepted by the Auth emulator and recorded as the documented local emulator limitation; it is not a production Auth signature result.

Parent-reported cleanup sentinel: expected exit 1 with the exact deterministic cleanup error, no PASS marker, and ports 8180, 9199, 5101, 4401, and 4501 closed afterward. This confirms a failure thrown inside managed work survives `finally` cleanup.

Parent-reported regression evidence: frontend/YumPals tests 9/9 in 104.33 ms, Functions/Teams tests 23/23 in 107.47 ms, both lint commands passed, production build passed in 823 ms with `index-CEim1V1d.js` at 802.58 kB / 236.41 kB gzip, and `git diff --check` passed. The emulator’s warning that the isolated fixture package has no local `firebase-functions` dependency is harmless: the wrapper resolves the existing installed Functions dependencies through `createRequire`; no install or symlink was needed. These are parent measurements for review, not deployment or production acceptance.

## Scope boundary and follow-up

This verifies a local demo emulator stage, not cloud staging, production rules, production Auth claims, deployment, or live data. It does not mutate `yum-donut-school` and does not assign live teacher claims. Parent review should retain the command output, distinguish baseline results from candidate results, and keep deployment blocked until the candidate is independently reviewed against the live ruleset and a real authorized staging project exists.
