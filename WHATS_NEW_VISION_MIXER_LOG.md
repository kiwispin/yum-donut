# What's New: Vision Mixer — 27 October 2026

Request: announce Vision Mixer in What's New, using the wording the owner approved.
What's New had been left unchanged in both Vision Mixer releases (noted as "Not
done" in `VISION_MIXER_LOG.md`).

Baseline: `4a1b44c`, preserved by `codex/whats-new-vision-mixer-baseline-20261027`.

## Changes / disposition

- ACCEPTED — `PatchNotesModal` in `src/App.jsx`: the subtitle "A little pal. A new
  daily adventure." became "New in the Arcade: run the gallery." A new top section,
  "New in the Arcade: Vision Mixer" (red `Gamepad2` icon, already imported), uses
  the approved two paragraphs. The YumPals section is kept below it, separated by
  a top border. No other text, layout or behaviour changed.

## Measured results

- Frontend suite (`src/*.test.js src/yumpals/*.test.js src/arcade/*.test.js`):
  137/137 passed in 9.27s. Lint exit 0 (existing stale `baseline-browser-mapping`
  warning only). `git diff --check` clean.
- Production build exit 0, 1719 modules, 2.05s. JS `index-C6XKeTMn.js` 925.56kB /
  273.80kB gzip; CSS `index-p6o1Gwbm.css` 94.32kB / 17.29kB gzip.
