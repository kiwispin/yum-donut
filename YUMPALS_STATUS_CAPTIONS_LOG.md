# YumPals Status page names — 6 November 2026

Owner: "On the Status screen, the first one makes sense? What does the second and
third screen mean? What am I looking at?" Then approved: "Yes, add them".

Baseline: `8e426e6` (`main`; live site from `56febe2`, and later commits are logs
only). Branch `codex/yumpals-status-captions`. Site only; no server change.

## Finding

- Status has 4 pages: age and weight, food, happy, and the student's donuts.
- Only page 1 has words on it ("AGE"). Pages 2 and 3 show a small pixel icon (a
  bowl or a smiley) above 4 hearts. At handheld size the bowl looks like a blob,
  and the two heart rows look the same, so you can't tell which meter you're
  reading. Page 4 shows a donut and a number.
- The caption strip under the donut was empty on every Status page.

## Changes / disposition

- ACCEPTED — `donutUi.js` `statusCaption(pal, page, { donuts, ms })` names each
  page with its value: "Age 9 days, weight 21" ("1 day" for one), "Food: 1 of 4",
  "Happy: 3 of 4", "Donuts: 16".
  - If the age line would go over the 22-character caption limit (from 100 days),
    it shortens to "Age 120, weight 99".
  - The value is worked out each time the screen is drawn, not stored when the
    page opens, so it stays current (food dropping, new donuts).
- ACCEPTED — `useDonutUi.js` returns `caption`: the Status caption while Status is
  open, otherwise the latest message, as before. Both handhelds use it
  (`YumPalsDonutSaved.jsx`, `YumPalsDonutPreview.jsx`). Leaving Status clears the
  caption, as before.
- ACCEPTED — `allCaptions()` includes the longest Status captions, so the caption
  size check covers them.
- ACCEPTED — How to play, step 5: "Status shows its age and weight, how full and
  how happy it is (filled hearts), and your donuts."
- ACCEPTED — `verification/donut-saved-check.mjs` now steps through all four Status
  pages after the meal and the treat, checks each caption, and checks that B on
  the last page goes back.
- KEPT — the pixel screen is unchanged. The words are in the caption, like the icon
  names added earlier.
- REFUSED (my test, removed before running) — a second unit test only checked that
  Status opened on page 0, not the caption, so it would have passed without this
  change. The playthrough check covers the caption the handheld really shows.
- Cleaned up — the browser checks write screenshots to the repo root when
  `SCREENSHOT_DIR` is unset. Those stray PNGs were deleted, not committed.

## Measured results

- New unit test: each page's caption, the singular "1 day", the shortened age line
  past 99 days, and an egg ("Age 0 days, weight 0").
- Frontend 241/241 (was 240), lint exit 0, `git diff --check` clean, build exit 0.
- Longest Status captions: "Age 99 days, weight 99" (22), "Age 9999, weight 99"
  (19), "Happy: 4 of 4" (13), "Donuts: 99999" (13).
- `caption-sizes-check.mjs` 12/12 (every caption one line, nothing spills).
  `donut-pal-check.mjs` 28/28. `donut-saved-check.mjs` 15/15 (new step: "Age 0
  days, weight 8 | Food: 2 of 4 | Happy: 1 of 4 | Donuts: 4", and B leaves).
- In the pane at 375px: the egg's pages read "Age 0 days, weight 0", "Food: 0 of
  4", "Happy: 0 of 4", "Donuts: 5", then empty after leaving. Screenshots of all four
  pages of a hatched pal were inspected.

## Release

- Not yet released. To be shown to the owner first.
