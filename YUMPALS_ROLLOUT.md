# YumPals rollout prerequisites

YumPals is implemented as an additive, review-gated module. This branch has not been deployed, has not written live data, and has not changed the existing Teams export/configuration or broad Firestore rules.

## Current review mode

- The production/cloud feature gate is OFF unless `VITE_YUMPALS_CLOUD=enabled` is explicitly supplied at build time.
- The normal app does not make YumPals callable requests while that gate is off.
- Cloud requests additionally require a non-anonymous signed-in account, a current Firebase UID matching the app user, and one of the five allow-listed callable names: `yumpalsGetState`, `yumpalsAdopt`, `yumpalsCare`, `yumpalsUpdatePet`, or `yumpalsUpdateSettings`.
- The standalone browser demo is available at the relative path `/yum-donut/?yumpals=demo` while the local Vite server is running; use the port printed by that server (the parent review server is currently `http://127.0.0.1:5173/yum-donut/?yumpals=demo`). It is temporary local state: refresh resets it and it performs no pet/account database operations. The app's normal module startup may still initialize its existing Firebase/auth wiring.

## Required cloud setup before enabling the gate

1. Deploy the five YumPals functions additively after parent review. This repository's `firebase.json` names the Functions codebase `teams`; use the verified selective form `functions:teams:yumpalsGetState,functions:teams:yumpalsAdopt,functions:teams:yumpalsCare,functions:teams:yumpalsUpdatePet,functions:teams:yumpalsUpdateSettings` with an explicitly selected Firebase project. Do not use the broad `functions:teams` target because it includes the existing Teams export as well. No deployment was run for this implementation.
2. Assign the custom Auth claim `yumpalsAdmin: true` only to the reviewed teacher/admin UIDs. The callable checks this claim; display names and client-supplied admin or UID fields are not authorization inputs. Refresh the teacher's ID token after a claim change.
3. Review and deploy scoped rules for the new namespace before enabling the flag. The intended namespace is `artifacts/yum-donut-school/yumpals/main`, with `config/settings`, its `config/settings/audit` subcollection, and per-UID `users/{uid}` data below it. No repository-wide rules file exists in this project, so this prerequisite must be completed against the project's real rules without replacing existing rules.
4. Check every existing overlapping match before rollout. Firestore `allow` rules are ORed, so adding a narrow deny-style rule does not override a broader existing allow. Confirm that direct client access to authoritative YumPals documents is denied or limited to the reviewed read surface; all state changes must remain callable-backed. Verify that the callable's Admin SDK writes cannot be reached by anonymous callers and that the custom claim is enforced server-side.
5. Run the Firebase Functions/Firestore emulator and security-rule tests in an environment with Java and the emulator artifacts installed. This workspace did not have a Java runtime or cached emulator, so the included strict optimistic-retry fake is offline handler evidence only, not proof of deployed rules or production security.
6. Perform a controlled staging smoke test with two different authenticated UIDs, same-name pets, duplicate/reused operation IDs, concurrent feed/pat, disabled settings, invalid existing records, teacher settings, and Auckland DST/day boundaries. Do not use student production records for this test.

## Persistence and rollback notes

The callable handlers use the server clock, authenticated UID, transactions, and a new state/day/audit namespace. State and the corresponding daily record/audit are written together. Earned milestones are stored and are not removed when a teacher changes growth speed; read-only responses do not invent rewards from the current speed. Invalid persisted state/day data fails closed without resetting it. Disabling the feature preserves existing pets and milestones.

For rollback, first set the YumPals config `enabled` value to false and ship the normal app with the cloud build gate off. Do not delete the YumPals namespace or reset existing YumDonut data. Follow the separate baseline rollback procedure in `YUMPALS_CHANGE_LOG.md`; any production rollback remains outside this implementation and requires explicit authorization.
