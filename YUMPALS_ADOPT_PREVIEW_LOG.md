# YumPals adoption preview — 6 November 2026

Owner: "Any chance of users being able to Preview a Yumpal before committing to
one?" Approved: "Yes, build it".

Baseline: `7c81f27` (`main`, live site from `04e0483`; later commits are logs only).
Branch `codex/yumpals-adopt-preview`. Site only; no server change.

## Finding

- Adopting was blind: a plain form (name, kind, glaze, colour) with no picture.
- The kind (Mossbit, Pufflet, Emberoo) only shows once the pal is an adult; egg,
  baby, child and teen look the same for every kind.
- The chosen colour was not shown anywhere on the Donut pal. It was left over from
  the old handheld.

## Changes / disposition

- ACCEPTED — live preview on the adoption form (`YumPalsDonutSaved.jsx` `Adopt`).
  - The real donut handheld sits above the form and updates as students choose:
    the typed name (or "Your pal") on the sticker, the glaze and its card colour,
    and the chosen colour on the sticker.
  - The screen loops egg → baby → child → teen → the chosen kind as an adult. The
    starburst follows the stage, and the label shows "It starts as an egg", "Then a
    baby"… "Grows into Emberoo".
  - Picking a kind jumps straight to its adult.
  - "Try your choices on the donut above. Nothing is spent until you adopt."
    Adopting still costs 5 donuts, as before.
- ACCEPTED — `src/yumpals/adoptPreview.js`: the pure loop (`previewFrame`,
  `PREVIEW_STEPS`, `ADULT_START`), drawn with the real art in daytime so the pal is
  awake.
- ACCEPTED — the colour now shows: the name sticker takes the pal's chosen colour,
  with ink or white text, whichever reads better (`stickerColours` in
  `donutUi.js`). This applies to existing pals too. An invalid colour keeps the
  sticker's yellow.
- ACCEPTED — `DonutDevice.jsx` `preview` mode: the device is `inert` (no focus, taps
  or keys), so the preview can't be played by mistake. Other props are unchanged.
- REFUSED (my test, fixed) — one check in the new unit test asserted nothing useful
  (it would always pass). Removed. The playthrough's adoption check waited for "a
  donut", which the preview already supplies. It now waits for the real adopted
  pal.

## Measured results

- `adoptPreview.test.js` 3/3:
  - The stage order, looping, and the jump to the adult.
  - Three different adults; every frame is 32×16; every caption is at most 22
    characters.
  - Sticker text on dark and light colours; invalid colours ignored.
- Frontend 240/240, lint exit 0, `git diff --check` clean, build exit 0.
- `donut-saved-check.mjs` 14/14 (adopting gives an egg named Sprinkle and spends 5
  donuts), `donut-pal-check.mjs` 28/28, `caption-sizes-check.mjs` 12/12.
- Adoption page at 320, 390 and 1280px:
  - All five stages seen (Hatching! → All grown!).
  - After Name "Sprinkle", Emberoo, Lemon and the blue swatch: the sticker read
    "Sprinkle" in blue with white text, "Grows into Emberoo", "All grown!", and the
    lemon glaze's lilac card (#e2d4ff).
  - The device is inert. No sideways scroll and no page errors.
  - The 390px screenshot was inspected.

## Release

- Not deployed yet. Shown to the owner first. Plan: tag the rollback point, merge to
  `main`, run the tests, push, `npm run deploy`, then check that the live files
  match and that a pal's sticker shows its colour.
