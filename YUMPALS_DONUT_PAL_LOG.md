# YumPals Donut pal preview — 29 October 2026

Owner request: make YumPals "the spirit and functionality that a Tamagotchi has.
Simple, fun", and make it look close to the real pocket-pet devices. Owner
decisions:

- Free care, with donuts for extras. This reverses September's paid care, for the
  new design only.
- Neglect means sick and slower growth, never death.
- 6 icons (Food, Play, Clean, Medicine, Lights, Status) plus an attention light.
- Case: Donut pal. The owner first picked Pocket pebble, then changed to the donut
  as more on-brand.

Genre conventions are used freely: a pocket-sized shell, a green-grey dot-matrix
screen, icon rows above and below, three round A/B/C buttons, a keychain loop and
minimal text. The device shape, icons and characters are original YumPals art. No
Bandai egg silhouette, icons, characters or branding.

Baseline: `df439c8` (`main`, live). Branch `codex/yumpals-donut-pal`. Preview only:
nothing is imported by the live app, and there are no server or database changes.

## What was built

- `src/yumpals/donutPal.js`: pure care rules (no React, no server) that the server
  can reuse later.
  - Needs: Food and Happy, 0–4 hearts each.
  - Messes: up to 3.
  - States: sick, sleepy, napping, lights.
  - Growth stages: egg → baby → child → adult.
  - Real time on Auckland time. The pal catches up minute by minute (at most 14
    days), with night/day cached per hour.
- `src/yumpals/donutPalArt.js`: original 16×16 sprites on a 32×16 two-tone screen.
  - Stages: an egg with sprinkle dots, a bean-shaped baby, a sprouting child, and
    one adult per existing species (Mossbit with leaf ears, Pufflet the cloud,
    Emberoo the long-eared hopper with a tail).
  - Faces: idle, blink, eating, happy, sad, sick, sleeping, looking left and right.
  - Props: mess, meal bowl, cupcake, hearts, Z, sick cloud, medicine, arrows.
  - A small font, six 8×8 icons, and all screen layouts and animations.
- `src/yumpals/YumPalsDonutPreview.jsx` + `donutPal.css`: the device.
  - Case: a glazed donut with sprinkles, a gloss highlight and a keychain loop.
  - Screen: set in the hole with a dough rim, icons printed on the glass, and dot
    gaps on the matrix.
  - An amber attention light that blinks, and three cream A/B/C buttons.
  - Only the pal's name above the device and a one-line caption below it.
  - How to play, then a dashed "Preview only" tool box: +1 hour, +6 hours, next
    morning, pretend donuts, a new egg per species, and glaze colour.
- Test page `verification/donut-pal.html` and playthrough
  `verification/donut-pal-check.mjs`.

## Rules (preview)

- Controls:
  - A moves through the icons, B uses one, and C goes back.
  - Tapping an icon selects it, and tapping it again uses it.
  - Keys: A or →/↓, B or Enter/Space, C or Esc/Backspace.
- Food:
  - A meal is free and gives +1 food; a full pal shakes its head.
  - A cupcake treat costs 1 donut and gives +1 food and +1 happy, up to 3 a day.
  - Treats are refused when the pal is sick or full, or when you have no donuts.
- Play: 5 rounds of left or right; win 3 to give +1 happy. 3 games in a row make
  the pal sleepy.
- Lights:
  - When sleepy, Lights gives a 20-minute nap and +1 happy.
  - Night is 9pm–7am, when the pal sleeps and Lights only switches the screen dark.
    Leaving the lights on has no penalty.
- Clean removes every mess. Medicine cures in one dose and is refused when the pal
  is well.
- Timers (awake time only; sleep pauses them):
  - −1 food every 6h, −1 happy every 7h, and a mess every 8h.
  - The pal gets sick after a mess sits for 18 awake hours, or after 18 awake hours
    with no food.
- Sickness: a sick pal won't play or eat treats, and its care doesn't count. It
  never gets worse than sick.
- Growth:
  - A care day is a day you fed, played or cleaned while your pal was well.
  - At 7am the pal grows: baby → child after 2 care days, child → adult after 5.
  - A sick pal waits to grow.
- The attention light comes on when the pal is sick, hungry, sad, messy, or sleepy
  and not napping. At night only sickness turns it on.

## Changes / disposition

- ACCEPTED — all files above (new only). Existing YumPals, the old preview, the
  guarded markup and CSS are untouched.
- REFUSED (my first timings) — food −1/4h, happy −1/5h, a mess every 6h, sick after
  6 hours of mess or 12 hours with no food. A test showed a mess appearing around
  3pm made the pal sick by 9pm, so a student who visited every day would still
  find it sick most mornings. Retuned for one visit per school day (about 14 awake
  hours apart) to the rules above. Now each visit has a couple of hearts and a mess
  to deal with, and only a skipped day causes sickness.
- REFUSED (my design) — a mini-donut snack priced in donuts read as "donut costs
  donut". The snack is now a cupcake, and the donut is only the price and wallet
  symbol.
- REFUSED (my design) — sickness from too many treats. Spending donuts to make your
  pal ill feels bad, so treats stop at 3 a day instead.
- REFUSED (visual, first pass):
  - The screen covered most of the glaze, and the light sat on the outer edge, then
    vanished under the bezel.
  - Fixed: the screen width went from 62% to 58%, the dough rim and hole edge are
    wider, the light moved to the right-hand ring, and the sprinkles sit only on the
    visible ring.
- REFUSED (visual) — lights off showed the inverted scene, which was heavy and
  noisy. Now it shows a dark screen with one glowing Z.
- FIXED — "Pip is a adult" → "an adult" (screen-reader description).

## Measured results

- New unit tests: `donutPal.test.js` 10/10 (rules, timings, night, snack cap,
  game/nap, sickness and cure, growth, a 14-day catch-up in under 250ms, measured
  9ms) and `donutPalArt.test.js` 4/4 (every stage × face is 16×16; every screen and
  animation frame is exactly 32×16).
- Full frontend suite 181/181 (167 + 14 new). Lint exit 0. `git diff --check`
  clean. Build exit 0: the JS bundle is unchanged at 933.89kB / 276.87kB gzip,
  because the preview isn't in the app. CSS is 96.07kB, up 0.5kB, because Tailwind
  scans the new source files for class names. That matters only if this ships.
- `donut-pal-check.mjs` playthrough, 21/21:
  - Hatches.
  - Meals stop at full and cost nothing.
  - Game result.
  - A mess appears, the light comes on, and Clean clears it.
  - A cupcake costs 1 pretend donut.
  - Medicine is refused when well.
  - Neglect brings sickness; a sick pal refuses play, and one dose cures it.
  - Baby → child → adult.
  - Asleep at night with no feeding, and lights off.
  - Keyboard A.
  - Layout at 320, 390 and 1280px: no sideways scroll, buttons at least 40px, icon
    targets at least 32px tall, and the screen 147–184px wide (4.6–5.8px per dot).
  - Zero page errors.
- Screenshots inspected at 320 and 390px (baby, adult Mossbit, food menu, status,
  lights out).

## Not done yet (next steps, each needs owner approval)

1. Owner playtest of this preview and any changes to the rules or look.
2. Server rules: free care, growth and the attention light computed on the
   server. Migration of the 13 existing pals, keeping names, species and colours
   (`casing` maps to the glaze). The visit gift and giving cheer carried over.
   Calendar rest days and Holiday Mode keep freezing care.
3. Staged app and server releases with rollback tags, and the design guard tests
   updated deliberately.
