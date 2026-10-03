# YumPals device responsiveness — 4 October 2026

Scope: improve the existing YumPals saved handheld and preview, without changing the device artwork, economic rules, other app modules or backend. The user explicitly instructed this agent to do the work itself; no delegation used. Baseline `5793e53` is preserved by `codex/yumpals-responsiveness-baseline-20261004`.

## Baseline evidence

Read the earlier speed/queue logs first. The 1.2-second, three-bite animation and existing durable care queue are retained; shortening animations again or removing payment checks is not the fix.

New synthetic browser audit at 390/1440px held purchase replies until explicitly released:

- Meal animation already started in 60/48ms, but keyboard B during it was ignored. Hearts still showed 0/4 after a locally reserved meal that should display 2/4.
- Bedtime was locally queued in 51/46ms, but the lights did not respond until the server returned.
- Insufficient funds sent no purchase (correct) but opened an indefinite “Care is being checked” confirmation (incorrect).
- Preview disabled A, B and C during ordinary care animation.
- Source inspection: animation state updaters mutated an external queue (unsafe with React StrictMode replay); background reads erased in-progress confirmations; saved-game choices unconditionally re-read a result already present in their validated receipt.

## Modifications / disposition

- ACCEPTED after targeted checks — `YumPalsSavedHandheld.jsx`: ordinary care displays the existing durable reservation immediately for needs/bedtime/attention; actual saved money stays authoritative and pending care stays identified below. Refused care reverts to server state. Adoption/game effects still require confirmation. Keyboard and pointer controls interrupt cosmetic animation instead of discarding input. New care replaces stale animation rather than accumulating a presentation backlog; frame updaters are pure and reject stale timer callbacks. Failed local validation stays in the choices screen with its actual explanation. Unchanged pixel grids are memoized; device artwork/animation sequences unchanged.
- ACCEPTED after targeted checks — `YumPalsHandheldDemo.jsx`: remove ordinary-care animation lockouts for all three buttons and icon navigation; cancel cosmetic timers when navigating. Keep the brief game-result reveal lock (and always allow C). Memoize unchanged pixel grids. Prices, gameplay and art unchanged.
- ACCEPTED after targeted checks — `paidCareClient.js`: coalesce overlapping refreshes, preserve still-valid price confirmations, withdraw changed-config confirmations, and reject late reads that would overwrite newer reservations/receipts. Reuse verified recent same-session state immediately while refreshing in the background. No relaxation of server authority, persistent journal, ownership or duplicate-charge validation.
- ACCEPTED after targeted checks — `paidCareTransport.js`: retain a maximum-one-minute, memory-only, same-user snapshot for immediate reopening, with background refresh after ten seconds. Remember only controller-validated settled state; purchase/cache generations stop old reads replacing it. No tokens or new persistent balances stored.
- ACCEPTED after targeted checks — `savedGameClient.js` / `savedGameProtocol.js`: advance normal rounds directly from already-validated server receipts, eliminating the unconditional second read and intermediate whole-pet refreshes. Same-instance pause/resume reuses its known game immediately; explicit refresh, duplicates, stale rounds and recovery still read current server state. Guesses still need server results; none are fabricated locally.
- Verification changes: `device-response-check.mjs` reproduces the above interaction failures and now asserts correct behaviour, including refused-care reconciliation, StrictMode, and 4× CPU slowdown. `care-speed.jsx` adds optional StrictMode to its synthetic fixture. Unit tests add background-read races, cache expiry/reopening, confirmation invalidation, one-request game progression/resume and invalid-result recovery. Existing historical-artwork tests normalize only the explicitly approved input-lock and progress-copy changes; all remaining markup and device stylesheet comparisons remain exact.

## Refused approaches / corrected attempts

- REFUSED: more animation shortening, invented payment success, removing durable journals, modifying bank/gifting or unrelated menus, backend/infrastructure expansion.
- Old whole-markup tests initially rejected the intentional preview `disabled` changes and saved confirmation copy. Added narrow normalizations, retaining the historical artwork/structure/CSS assertions. No styling assertion removed.

## Measurements

- Initial corrected browser run, ordinary CPU: meal/lights local response 25–27ms; keyboard confirmation during feeding now works, Food shows 2/4 immediately, lights respond before the blocked server, insufficient funds never opens a false-checking screen, preview controls stay enabled.
- StrictMode plus 4× CPU slowdown: local responses 164–206ms across 390/1440px, every interaction regression passed, including rollback to actual 0/4 needs and no debit after refused care. These are controlled test measurements, not live-network latency claims.
- Existing 10-second delayed-payment browser suite passed at both widths: first animation 56/53ms at 390/1440px; second confirmation 24/17ms. Two unique committed receipts, wallet 30→27, no duplicate charges, all food stages, unchanged layout bounds before/during/after save, no horizontal overflow/page errors. Mobile screenshot visually inspected; artwork unchanged.
- Controlled saved-game test with 120ms/request: round ready in 122ms using one request rather than two; same-instance resume makes zero requests. Completion state equals backend fixture state.
- Final full frontend suite: **112/112 passed**, 2704.217416ms. Lint exit 0; whitespace diff check clean. Historical artwork/stylesheet and unrelated app-handler preservation tests passed.
- Enabled production build: **1.00s / 1715 modules**. JS `index-D8z7rpYB.js`, SHA-256 `000c33382b6617ece503c2dab18be71fa65d176960d196affe072261615c205f`. CSS remains byte-identical to baseline: `index-BASmV3CR.css`, SHA-256 `79951ab31a95f92e00a633faf983553ecc505a8b79246b7d8c53fc9ff93d64d3`. Existing dependency-age/bundle advisories unchanged.
- RELEASE VERIFIED: source `27726c4` published to the existing GitHub Pages site. Live HTML now references `index-D8z7rpYB.js` and `index-BASmV3CR.css`; both downloaded assets match the tested SHA-256 values above. Both admin preview and saved student handheld ship in this build. No backend deployment. Tests used synthetic local accounts only, never student purchases or settings changes. Baseline rollback tag retained.
