# YumPals rollout prerequisites

## Paid-care release status — 2026-09-08

Latest user decision supersedes the separate-staging requirement below: proceed through a controlled rollout inside the existing app, with extensive local testing, default-off teacher controls and rollback checkpoints. Leave `yum-donut-staging` unused and billing disabled. A separate project is no longer a release prerequisite. Real-wallet ownership, atomic receipts, regression and access checks remain prerequisites for real charges.

LR011 source update: Admin Settings now contains the dedicated paid teacher control component, connected through a pinned-account transport to two additive Settings callable exports. Its independent frontend gate and server deployment-readiness guard both remain off. This is locally tested source, not a live rollout; paid-pet client integration, real HTTP/identity checks and compatible protected-wallet rules remain open. See `functions/src/yumpals/SETTINGS_CONNECTION.md` and `YUMPALS_LIVE_ROLLOUT_LOG.md`. Do not use the historical five-free-callable instructions below to activate this new flow.

The first in-app integration is a temporary pretend-donut preview in the existing teacher Settings screen. Its visibility toggle is a convenience control using the app's existing teacher UI, not a new security boundary; the same pretend demo is already publicly available by URL. It cannot activate paid cloud care. Real paid teacher operations must retain server-side authorisation.

Separate Firebase project `yum-donut-staging` (YumDonut Staging,356720371643) now exists with user approval. Billing verified disabled. No functions, database, users or app have been deployed/configured there by this setup step. Historical statements below about an unavailable project refer to the earlier verification date. Use explicit staging project IDs; the repository default has not changed. Billing activation requires separate approval.

The five-callable deployment instructions below describe the earlier free-care module, **not** a ready-to-deploy paid handheld. Do not use them to activate the current prototype. Paid-care integration is being built additively and remains disconnected from production exports and wallets. Track current work and gates in `YUMPALS_PRODUCTION_INTEGRATION_LOG.md` and `YUMPALS_PAID_CARE_PLAN.md`.

Before any pilot, complete trusted UID wallet ownership, compatible bank/gifting/Arcade/shop/Teams writers, permanent atomic receipts, persistent time-based handheld care, versioned teacher calendar/settings, safe migration and cloud security verification. A passing local synthetic-wallet test does not satisfy these gates. No production student test purchases are authorised by local readiness work.

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
5. Local emulator verification completed on 2026-09-07: real Auth/Functions/Firestore emulators passed 66 checks in 26,921 ms using isolated checksum-verified Java/Node runtimes. The intentional cleanup-failure test correctly exited 1 without a success marker. See `YUMPALS_SECURITY_VERIFICATION.md`. This supersedes the earlier unavailable-Java blocker, but is not proof of deployed rules or production token-signature validation.
6. Perform a controlled staging smoke test with two different authenticated UIDs, same-name pets, duplicate/reused operation IDs, concurrent feed/pat, disabled settings, invalid existing records, teacher settings, and Auckland DST/day boundaries. Do not use student production records for this test.

## Persistence and rollback notes

Current cloud blocker: no separate YumDonut staging project is accessible. Production rules were inspected read-only and allow global public reads and authenticated writes, including anonymous identities. The candidate in `verification/yumpals/candidate.firestore.rules` excludes only the new pet subtree from those grants and passed non-deploying Google Rules API validation (HTTP 200, no issues). It has NOT been deployed; broader legacy access remains insecure and requires a separately scoped review. Live ruleset `7b40979e-05c0-46de-8631-41bdc54ac695` is unchanged.

The callable handlers use the server clock, authenticated UID, transactions, and a new state/day/audit namespace. State and the corresponding daily record/audit are written together. Earned milestones are stored and are not removed when a teacher changes growth speed; read-only responses do not invent rewards from the current speed. Invalid persisted state/day data fails closed without resetting it. Disabling the feature preserves existing pets and milestones.

For rollback, first set the YumPals config `enabled` value to false and ship the normal app with the cloud build gate off. Do not delete the YumPals namespace or reset existing YumDonut data. Follow the separate baseline rollback procedure in `YUMPALS_CHANGE_LOG.md`; any production rollback remains outside this implementation and requires explicit authorization.
