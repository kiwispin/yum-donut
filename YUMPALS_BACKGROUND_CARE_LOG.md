# Background care responsiveness — 2026-09-13

Baseline4ae2c8c preserved. Scope: instant local feedback and non-blocking controls, safe background payment/recovery; no backend/account/settings/artwork changes.

## Accepted implementation

- paidCareClient: onQueued fires synchronously only after valid purchase journal is durably stored. Pending payment retains last confirmed pet/balance. Optional automatic recovery retries identical operation at1/3/8s after failures; cancels on dispose and checks current identity. Startup recovers pending journal automatically. No provisional balances/needs or new operation IDs on retry.
- paidCareTransport: identity-object-bound in-memory10s read snapshot; saved view can reuse state already fetched by main-app visibility check, without fetching it again. Purchases invalidate cache. Disabled/other-account access cannot use it.
- Saved UI: return immediately to room and animate meal/snack/pat/etc on queue, not reply. Payment success does not replay animation or force ordinary care back to room. A/C and menus work while pending; another paid action remains blocked. Small Saving/Reconnecting status outside screen, balance updates only after confirmation. Online/focus resumes recovery; fresh snapshot prevents redundant focus reads. Pet stays visible on network interruption.
- Existing full-screen pending message removed. Artwork unchanged; surround regression narrowed to permitted message change while preserving exact device markup/styles. Adoption and paid guessing-game session still require server confirmation before delivery; no invented server outcomes.

## Measurements and rejected attempts

- Browser390px/1440px, deliberately delayed payment reply10000ms: local feeding starts51ms/49ms. During delay A/B/C navigation works, last confirmed30 donuts retained; after reply28 shown, one purchase only. All bite frames recorded, no page errors/overflow.
- Automatic recovery unit test loses committed reply then replays same operation; one debit, no repeated local animation. Controller immediate-event test proves journal precedes local feedback, balance not prematurely reduced, repeat confirm blocked. Cache reuse and account-switch tests passed.
- REFUSED original behaviour: pending confirmation rendered as Purchase needs checking even on ordinary in-flight request. Prior extra-request optimization did not solve responsiveness.
- First browser run found extra focus read. Corrected focus handler to respect fresh preload and active confirmation; repeated run contains only initial state+purchase.
- Final92/92 tests2369.231416ms, lint0, enabled build746ms/1715modules. Clear stale local Saving message when authoritative settlement arrives, so it cannot mask refusal/result. No live purchase used for testing.

## Release

Published37fe8bf frontend-only. Live index-DMH-tq8e.js/index-DGqNAd8A.css downloaded SHA256 exactly match validated build. Existing server-side atomic debit, validation and transaction recording untouched. Previous release recoverable via baseline above.
