# Saved handheld — LR014, local acceptance only

Baseline e3316d0, preserved by
`checkpoint-before-yumpals-saved-handheld-2026-09-08`.
No production deployment, flags, endpoints, claims, rules or student data changed.

## Connection and presentation

`YumPalsSavedHandheld.jsx` uses the LR013 controller and injected transport. It
does not import the demo reducer, pretend wallet or scenario/clock controls.
Mount, focus and visibility refresh only read saved state; adoption and care
require separate price review and explicit confirmation. Uncertain purchases
keep the original journal and require explicit retry. No local balance debit,
automatic migration, adoption, reset or retry occurs.

Only the current owner/project context can display saved data. Unknown funds
display a dash, not zero. A cached pet is used only to keep a confirmed animation
visible during the subsequent state refresh; it is not a source of current
funds or care needs. Disabled care and unavailable wallets block payments.
Last received server quotes supply time and needs; this screen does not advance
care from the browser clock. Focus/visibility/manual refresh fetch new quotes.

The casing, eight icon controls and A SELECT/B CONFIRM/C CANCEL remain. Food
has seven existing open/close/bite/happy frames; idle feet do not alternate.
Sleeping uses two small Z/Zz states from the trusted Auckland 19:00–07:00
presentation window. Paid lights dim only the matching evening's sleep session;
a daytime purchase schedules lights rather than putting the pet to sleep at noon.
Persisted reduced motion and the OS preference are respected. Saved case and
colour choices affect appearance without rewriting those preferences.

Full needs produce plain-language feedback before payment, not +0-heart copy.
Hover help reserves space so icons do not move under the pointer. Selected icon
pixels use explicit pale ink and discrete pixel transitions, matching the demo.

## App route and incomplete features

`VITE_YUMPALS_PAID_CARE` is a separate default-off deployment gate. If selected,
it suppresses the legacy free-care gate even when both environment options are
set. The saved route requires a matching nonanonymous, nonsandbox identity and
is keyed by UID. Existing bank, gifting, Arcade and other financial handlers were
not edited in LR014. Teacher controls retain their separate existing gate.
The saved school setting controls care/rest; the deployment gate is not a pause
setting or security boundary.

The game cannot be purchased through this screen while saved completion is
unimplemented; Pat remains available. Existing game entitlements are preserved.
No game completion, attention scheduling, new growth policy, purchase-history
screen or saved-preferences endpoint was invented. Full activity completion,
protected shared wallet writers/rules, trusted live ownership and selective
backend/frontend release remain required. This is not a completed live rollout.

## Verification

The separate `verification/yumpals/paid-handheld.html` fixture mounts the actual
component/controller in React StrictMode with an in-memory synthetic transport.
It is visibly labelled as a local test account, is not linked from App, has no
Firebase imports and resets only its own fake records on page reload. This is
not a substitute for the LR013 real-emulator HTTP/payment tests.

The parent-owned `verification/yumpals/run-paid-handheld-browser.mjs` uses an
isolated Playwright browser context, permits only `http://127.0.0.1:5173`
requests, and always closes its browser. Supply installed package/browser paths
through `YUMPALS_PLAYWRIGHT_MODULE` and `YUMPALS_BROWSER_EXECUTABLE`; no dependency
installation or live browser profile is required. With the local Vite server
running, execute the script with Node. Failure captures and successful desktop,
mobile and night PNGs are written to a generated temporary directory.

Final parent results:

- Frontend122/122 passed322.047417ms; root lint and diff check exit0.
- Build844ms,1710modules; JS890.50kB/263.35gzip, CSS80.85kB/15.10gzip.
  Existing browser-data and bundle-size warnings remain.
- Browser16/16 groups passed12833ms; cleanup PASS; no browser errors or attempted
  external requests. Artifacts:
  `/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-saved-browser-5Q8XP6`.
- Verified exact feeding frames and single charge, cancellation/full needs,
  lost/held replies, gift then retry, same-name account switching, focus refresh,
  pause/unavailable funds, unsold unfinished game, night lights, explicit named
  adoption, 390px layout and reduced motion. Parent inspected the visual output.

The central rollout log records refused drafts, the hover-layout correction,
the inherited-colour correction replaced by explicit pixel ink, and measured
interim versus final results. Luna implemented the candidate; the parent
finished review corrections after Luna's usage-limit interruption. No reset was
redeemed. The LR013 backend111-entry and27-group HTTP results remain separate
evidence for the unchanged backend, not a live-browser or production-rules claim.
