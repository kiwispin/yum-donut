# What's New: giving cheer — 28 October 2026

Request: announce giving cheer in What's New, using the wording the owner approved.
What's New had been left unchanged in both giving cheer releases.

Baseline: `b4fcc22`, preserved by `codex/whats-new-giving-cheer-baseline-20261028`.

## Changes / disposition

- ACCEPTED — `PatchNotesModal` in `src/App.jsx`:
  - The subtitle "New in the Arcade: run the gallery." became "Give a donut, cheer up
    your pal."
  - A new top section, "Giving cheers up your pal" (pink `Heart` icon, already
    imported), uses the approved paragraph.
  - The Vision Mixer and YumPals sections are kept below it, each now separated by a
    top border.
  - No other text, layout or behaviour changed. The approved draft's 💝 emoji is
    shown as the `Heart` icon, matching the other sections' icons.

## Measured results

- Frontend suite (`src/*.test.js src/yumpals/*.test.js src/arcade/*.test.js`):
  150/150 passed in 9.73s. Lint exit 0 (existing stale `baseline-browser-mapping`
  warning only). `git diff --check` clean.
- Production build exit 0, 1720 modules. JS `index-CTJhEgNs.js` 928.68kB / 275.04kB
  gzip; CSS `index-CxnTlWCp.css` unchanged.
- RELEASE VERIFIED — source `d2cdeec` is on `main` and `codex/yumpals-only-release`,
  with the rollback tag pushed atomically and the remote IDs verified. It was
  published with `npm run deploy` as `gh-pages` commit `0d5cf96`, live after ~45s.
  Live `index.html` is byte-identical to the build; JS `index-CTJhEgNs.js` (MD5
  `66456a9bd0082af8a1d505706d7c23e6`) and CSS `index-CxnTlWCp.css` (MD5
  `8ea2d0f5c760ff0f16a7d631d6423a56`) match locally.
- Signed in as the owner, What's New opens with "Give a donut, cheer up your pal.",
  then "Giving cheers up your pal", "New in the Arcade: Vision Mixer" and "Meet
  YumPals!". The screenshot was inspected, and the panel was closed with "Got it!".
- Rollback: rebuild and publish `codex/whats-new-giving-cheer-baseline-20261028`.
