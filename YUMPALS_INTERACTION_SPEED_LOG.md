# YumPals whole-interaction pass — 4 October 2026

User clarified the objective: the fastest practical student experience, including navigation, clicks and paid care, not isolated timing figures. Personally implemented; no delegation. Baseline `5b4b168`, rollback tag `codex/yumpals-interaction-baseline-20261004`. Prior speed logs reviewed; keep their safeguards and avoid repeating refused changes.

## Findings / intended changes

- A background saved-game read sets the global care lock; feeding can silently do nothing until that unrelated read finishes. Separate care availability from game-specific recovery/loading. Keep all financial and identity guards.
- A verified game result animates for 520ms, during which the next guess is silently ignored even though the server is ready. Allow an explicit next guess to interrupt that cosmetic animation, not an in-flight request.
- Game purchase completion always forces the game screen, even after C or another icon; a late game reveal can overwrite a feeding animation elsewhere. Keep background saves running, but honor the student's latest navigation.
- New game confirmation returns to the room without clear immediate acknowledgement. Show that the game is starting, without claiming an entitlement or result before server confirmation. A submitted guess should say which direction was chosen immediately; it must not fabricate a result.

No backend, prices, artwork, banking/gifting or settings changes planned. Tests will exercise complete handheld journeys with deliberately held requests, rather than treating a lower-level benchmark as proof of good interaction.

## Accepted changes

1. `src/yumpals/YumPalsSavedHandheld.jsx`: separated ordinary care availability from background game loading/recovery; retained identity, wallet, storage, paid-care and game-specific guards. Removed the 520ms cosmetic-animation lock on a subsequent validated game turn. Track navigation intent so late queue/receipt/reveal callbacks cannot take over a different screen. Show immediate game-start/direction acknowledgement without inventing a result. Return from the starting screen if a game purchase is refused. **Accepted**.
2. `src/yumpals/savedGameClient.js`: expose the already-journaled pending direction for immediate acknowledgement; clear it with the validated journal. Request contents, outcome validation and authoritative round progression unchanged. **Accepted**.
3. `src/yumpals/paidCareClient.js`: on unmount, release only this controller's own in-flight queue claim under its existing exclusive lock. Preserve the exact purchase request/ID; a reopened view reconciles idempotently instead of waiting for the 15-second orphan-claim timeout. Do not release another view's claim or operate after an identity switch. Failed handover retains the original journal and recovery timeout. **Accepted**.
4. `paidCareQueue.test.js` and `savedGameClient.test.js`: four new unit regressions for safe same-operation handover, storage-failure preservation, identity-switch isolation and immediate direction acknowledgement without an invented round/result. **Accepted**.
5. `surround.test.js`: narrowly normalize the new waiting/acknowledgement text and game-start conditional; continue exact comparison of device artwork/structure and original device CSS. **Accepted**.
6. `verification/interaction-journey-check.mjs`, `verification/NavigationJourney.jsx` and `verification/care-speed.jsx`: complete phone/desktop journeys using actual frontend transports/controllers and backend services against synthetic data, including deliberately held replies and unmount/reopen. The optional navigation fixture preloads state and proves opening reuses it. No production credentials/data. **Accepted**.
7. `verification/game-response-check.mjs` and `verification/device-response-check.mjs`: wait for the specific animation-frame record before reading its timestamp; allow React up to the existing 250ms responsiveness ceiling to commit the next menu before asserting visibility under 4× CPU throttling. No relaxed financial or correctness assertions. **Accepted**.

## Reproduction and measured results

- Baseline browser run (`/tmp/yumpals-interaction-before.json`): both 390px and 1440px reproduced all three defects—feeding blocked by unrelated game loading, late receipt taking over navigation, and the next guess ignored during the prior reveal animation.
- Claim-handover unit first ran **red**: journal remained `inflight` rather than becoming recoverable. It now passes, with the same operation ID sent twice but only one 2-donut debit (10 → 8).
- Final whole-journey browser run: **10/10 scenarios pass** across 390px and 1440px. Preloaded opening uses one state request; leave/reopen resolves within the test's 2-second bound without the claim timeout; one debit only. Game refusal exits “Starting game…” and makes no debit. Feeding confirmation appears in **25ms / 25ms** despite a held game read; next-guess acknowledgement in **3ms / 3ms**, sampled at requestAnimationFrame. Late replies preserve navigation and the current feed animation. These are controlled local browser measurements, not a guarantee for every device/network.
- Existing 10-second-held-payment browser test: feeding begins **30ms / 35ms**; second care confirmation **18ms / 15ms** (390px / 1440px). Two distinct confirmed actions, two receipts, final wallet 30 → 27, no duplicate debit. All measured surrounding element positions unchanged before/during/after. Empty status surfaces remain visually empty.
- Actual paid-game journey with artificial 300ms request delay: new game ready **333ms**, preloaded game ready **6ms**; validated turns **319–328ms** (includes imposed network delay). Pause/resume makes no request; three turns cost one game purchase. Local acknowledgement does not pretend the server result is already known.
- Four-times CPU slowdown, React StrictMode: meal/lights/refusal local response **52–103ms** across phone/desktop. Controls work during feed; insufficient funds sends zero purchase requests; refused care reconciles safely. Preview controls ready.
- Navigation checks: **320/390/768/1440px pass**, including keyboard/focus/dismissal, eligibility, exact routes, no layout jump or overflow, all-fit/resize and reduced motion. Main navigation unchanged.
- Unit regression suite: **122/122 frontend tests pass**. Backend regression glob: **138/138 pass**; backend code unchanged. Lint and `git diff --check` pass. Build succeeds with all three saved-care/game/control flags enabled. Existing browser-data/chunk-size warnings remain; no unrelated dependency changes.
- Inspected the phone screenshot (`/tmp/yumpals-fast-care-390.png`). CSS SHA-256 remains exactly `79951ab31a95f92e00a633faf983553ecc505a8b79246b7d8c53fc9ff93d64d3`.

## Refused approaches / corrected test failures

- **Refused:** weaken server balance/receipt checks, fabricate game results locally, change prices, add paid hosting capacity, or alter other app modules to claim “instant” completion.
- Initial navigation-fixture attempt was **replaced**, not shipped as proof: placing a React component and `createRoot` in the same edited Vite entry caused hot-refresh self-imports to mount twice. Split the fixture component into its own module; one preloaded request now verified.
- Earlier DOM-mutation timestamps were **not accepted as paint timings**; the final harness records at animation-frame callback instead.
- Existing game timing script occasionally read a missing frame record before RAF; corrected the wait. Slow-CPU script initially checked visibility before React committed it; now explicitly enforces the 250ms bounded render wait. Both pass afterward.
- No repeated attempt to redo prior accepted network/database optimizations. No changes to banking, gifting, sponsorships, identities, school settings, rules, backend functions or device artwork.

## Publication

Frontend build: `index-DUsk2nqf.js`, SHA-256 `3ab08a77491d4197a37de327864b158fb98115c5021d919b28ea9b8babb1bcf5`; unchanged CSS `index-BASmV3CR.css`.

Published from implementation commit `9db55e3` with the prepared build (no unflagged predeploy rebuild). GitHub Pages returned HTTP 200 and references `index-DUsk2nqf.js`; both served JS and CSS SHA-256 hashes exactly match the tested local build. The first check still saw the previous JS during normal publication propagation; the subsequent check confirmed the new bytes. Frontend only—no backend deployment or real student purchases.

Final held-payment browser rerun also passed on both widths (`/tmp/yumpals-interaction-care-final.jsonl`): two operations/receipts, one debit per operation, unchanged layout, final balance 27. Final frontend unit/lint/diff checks passed before the implementation commit.

Rollback source tag remains `codex/yumpals-interaction-baseline-20261004` at `5b4b168`. Rollback would rebuild that source with the same three feature flags and republish the frontend; no data migration to undo.
