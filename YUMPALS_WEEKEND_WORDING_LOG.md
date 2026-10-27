# YumPals weekend wording — 28 October 2026

Request: review item #2, "pals fade over weekends". In the YumPals review I had called
weekend fading a mismatch with the design. The history shows it was a deliberate
owner decision: `YUMPALS_ONLY_RELEASE_LOG.md`, "2026-09-08 Real elapsed care
timing" — "User approved real offline elapsed time … Weekends count; explicit
calendar rest/holidays/absence/teacher-disabled dates remain frozen." The live
`elapsedCare` engine (`d884c9e`) has no weekend pause, matching that decision. The
older day-based engine (`weekdays()`) and the legacy free-care view (`YumPalsView`)
rest on weekends under their own rules. Behaviour was therefore not changed.

Baseline: `e6a7b52` (`main`, live). Branch `codex/yumpals-weekend-wording`.

## Changes / disposition

- ACCEPTED — `YumPalsHandheldDemo.jsx`: the preview's "Advance local day" notice
  said "Your pal rests on days off." The preview fades needs on weekends like the
  live game, so it now says "Your pal’s needs kept changing overnight."
- ACCEPTED — `src/yumpals/givingCheer.js`: corrected my comment "Weekends rest like
  the rest of YumPals" to say that giving cheers are for school days while care keeps
  running on weekends. Comment only.
- REFUSED — changing weekend fading itself. It reverses an explicit owner decision
  without new evidence, and the owner was not asked to change it.
- Checked and left as is:
  - Live saved-pal text: How to play says "Holiday Mode pauses care without a
    catch-up penalty", which is accurate.
  - Giving cheer: "Giving cheers happen on school days.", which is accurate.
  - Legacy `YumPalsView` weekend text, accurate for its own rules.

## Measured results

- Frontend suite 155/155, lint exit 0. Preview design guard (`surround.test.js`)
  unchanged: the notice is outside the guarded device markup.
- Not deployed; preview-only text, to ship with the next release.
