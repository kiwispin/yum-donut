# YumPals care responsiveness — 2026-09-12

Scope: user-approved speed-up only. Baseline22c2727 preserved for rollback. Restored release branch into /Users/crayner/Documents/Code/yum-donut-release because prior temporary checkout no longer exists; original parked branch untouched.

## Accepted implementation

- paidCareService.js: share existing allowlisted handheld projection; optional includeState:true returns committed pet/wallet/config snapshot from the same purchase transaction. No extra reads/writes; debit, receipt and recovery rules unchanged. Old requests/responses unchanged. Duplicate/refused replies deliberately omit snapshot so recovery reads current state, not an old balance.
- paidCareCallables.js: expose optional allowlisted state only on fresh committed purchase.
- paidCareTransport.js: request snapshot without changing journaled operation binding.
- paidCareClient.js: validate snapshot shape/owner/time/config/price/wallet against validated receipt before journal cleanup. Use it immediately instead of clearing quote and blocking on an extra read. Legacy/refused/retry paths remain supported. Never optimistically announce a payment.
- yumpalsSprites.js: same three bites and happy frame, shortened from2530ms to1200ms (52.6% shorter). Shared by Preview and student view; artwork untouched.
- Tests/verification: paidCareSpeed.test.js, updated animation timing assertion, synthetic loopback-only care-speed browser fixture/check. No live student purchases or settings changes.

## Measured results

- Frontend89/89 passed793.74525ms; backend129/129 passed340.085125ms. Frontend/backend lint exit0. Enabled production build821ms/1715modules.
- Controlled120ms/request comparison: old249ms vs new125ms after confirmation; request count2→1. This is NOT a live latency claim.
- Browser simulated300ms response: feeding observed at374ms on390px and356ms on1440px; only initial state + one purchase request. Balance30→28, no duplicate charge, no horizontal overflow, no page errors. Visually inspected mobile screenshot. All three bite levels retained.
- Recovery tests: invalid snapshot retains journal; lost reply then gift/retry shows latest balance without second debit; commit failure cannot return success; concurrent requests debit once; old client envelopes unchanged; no snapshot stored in receipt.

## Refused attempts / corrections

- Old animation test required>=300ms/frame, incompatible with approved faster timing; replaced with>=140ms plus exact1200ms total, retaining every bite/frame assertion.
- Initial new HTTP test fixture omitted Firebase result envelope; corrected fixture, not validation. Fixed fixture clock to a deterministic date; no production logic changed for test failure.
- Browser polling missed brief140ms first frame; replaced polling visibility with mutation-recorded frame sequence so fast frames are measured without slowing the application.
- Full Firestore emulator not rerun: prior temporary Java runtime is absent. Existing backend transaction fixture and actual browser→transport→callable→service synthetic tests passed. Transaction read/write ordering is preserved.

## Rollout

Pending: deploy ONLY yumpalsPurchaseCare backend, preserving old-client compatibility, then exact validated frontend. No bank/gift/auth/settings endpoint changes or infrastructure capacity changes.
