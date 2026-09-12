# YumPals queued paid-care log — 2026-09-13

Scope: YumPals-only queued paid care. Backend, bank/gift flows, device artwork, navigation, and infrastructure were left unchanged. Work was performed on `codex/yumpals-only-release` from baseline commit `37ba393` (`Record verified background-care rollout`). No commit or deployment was made.

## Accepted implementation

- Replaced the single local pending record with a version-2 durable journal containing the authoritative basis snapshot, ordered care entries, exact quoted integer costs, reservations, and `queued`/`inflight`/`uncertain` phases.
- Ordinary meal, snack, pat, clean, medicine, bedtime, and reminder confirmations persist under a short cross-tab Web Lock before network dispatch. Network calls are serialized outside the lock. Reservations project wallet balance, daily cap, needs, bedtime, attention, and game state without rounding or optimistic authoritative-state display.
- Operation IDs use a persisted random per-account/project namespace plus a locked monotonic sequence. Reloads, tabs, and retries reuse the exact journaled ID; a failed namespace/sequence write fails closed before dispatch.
- Commit/refusal replies are validated and reconciled against the response snapshot or a fresh read. Tails are fully rebased after every resolved head; stale price/config or no-longer-valid care is released with child-safe copy. An uncertain head retains its reservation and blocks later dispatch. Account/session changes never finalize or emit an old result.
- Legacy version-1 single-pending records migrate in place to the version-2 uncertain-head form. Missing lock support, corrupt journals, conflicting storage, and invalid IDs fail closed.
- The saved handheld accepts ordinary care while an earlier request is delayed, shows authoritative versus projected donuts, keeps a fixed-height queue/status area below the device, and serializes local animations. Recovery/remount never replays the success animation. Adoption and the guessing game remain excluded while ordinary care is queued and explain why.

## Measured validation

- `node --test --test-concurrency=1 src/yumpals/*.test.js`: **105/105 passed** in 3.51s.
- `npm run lint`: **exit 0**. The existing stale `baseline-browser-mapping` and `caniuse-lite` advisories remain non-blocking.
- `npm run build`: **exit 0**, 1,715 modules transformed. Existing large-chunk warning remains non-blocking.
- `node --test --test-concurrency=1 src/yumpals/paidCareQueue.test.js`: **13/13 passed**, including delayed second confirmation, local funds/cap reservation, refusal/rebase, lost reply, reload, account switch, duplicate click, same-account tabs, config change, v1 migration, missing lock, lock-wait session switch, and adoption/game exclusion.
- Loopback-only Playwright run: `node verification/care-speed-check.mjs 5175` against this release checkout’s Vite preview. At 390px and 1440px, the first purchase was delayed 10 seconds; the second ordinary confirmation completed in 22ms (under 250ms). Each width produced exactly two unique purchase IDs, two non-duplicate `COMMITTED` outcomes (meal amount 2, clean amount 1), two matching durable receipts, and wallet 30→27. No page errors or horizontal overflow occurred.
- The browser harness recorded identical document coordinates before queueing, during the delayed queue, and after completion for the device, hint, queue status, metadata, sync copy, and utilities at both widths. It also preserved all feed food levels `3`, `2`, `1`, and `0`.

## Independent parent acceptance

- Parent independently reran the frontend suite: **105/105 passed** in 2.64s, with lint exit 0.
- Parent independently reran the browser harness: at 390px, first-care animation was 44ms and second confirmation 24ms; at 1440px, first-care animation was 52ms and second confirmation 23ms. Both widths produced exactly two unique non-duplicate committed receipts, wallet 30→27, identical captured layout bounds, no page errors, and no horizontal overflow.
- Parent acceptance is recorded. Enabled build/release preparation is in progress; deployment has not been verified.

## Refused or corrected attempts

- The old UUID callback-injection test was refused as obsolete because operation IDs must be generated durably by the controller. It was replaced with a genuine persisted-namespace write failure test, which proves no request is sent.
- The removed unexpected-refusal coverage was restored as a fresh `NO_EFFECT` refusal test: the server state changes before dispatch, the client fresh-reads it, releases the reservation, and reports that no donuts were spent.
- Old speed fixtures that lacked a lock provider and counted namespace/sequence metadata as the journal were adapted to the v2 contract; no equivalent behavior assertion was dropped.
- An initial strict browser request-count assertion observed a legitimate focus-triggered fresh-state read. The harness keeps a bounded read budget (at most two initial/focus reads and no per-purchase read on the snapshot path) instead of hiding the call. The final release run observed one initial read plus the two purchases.
- Initial layout checks exposed app-surround CSS that hid an empty status paragraph and let completion copy move the lower controls. A scoped status override and fixed-height status/sync areas were added; the final bounds were stable.

## Blockers and final disposition

No implementation blockers remain. The browser check used synthetic loopback data only; no live student, bank, gift, settings, backend, or production data was touched. The earlier worker handoff correctly recorded deployment as out of scope at that point; parent acceptance and deployment are now verified. Source commit: `ceda1b3`; baseline rollback: `37ba393`; gh-pages publish succeeded. Live [YumPals deployment](https://kiwispin.github.io/yum-donut/) serves the exact built assets: `index-BDFCOyH2.js` SHA-256 `b45c7fbf3e59247d6999865d897d794808dea067ed300b0c957f7e96ad362ab8` and `index-i05BbEuS.css` SHA-256 `4dc2f70272a9aa4af7a3a651b79d09f73408cc6ec0e0282926fbd3f6569254f3`. Final disposition: parent accepted and deployed verification passed.
