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

## Round 2: checked against Bandai's Gen 1 manual

Owner: "why not read the manual?" Round 1 was built from my general knowledge of
the genre, without reading a manual. That was a mistake: the earlier YumPals plan
already linked the official web manual
(`tamagotchi-official.com/manual/toy/original/Original_webmanual.pdf`).

- The PDF is scanned images, and the PDF tool needs software that isn't installed
  here. The embedded page JPEGs were extracted to the scratchpad and read directly:
  - Gen 1: pages 1–2 (Japanese) and page 8 (English).
  - Pages 3–6 and 9–12 cover Gen 2 and Gen 3. Gen 2 has a different higher/lower
    game, so they weren't used, matching the earlier plan.
- No text was copied; only the rules were taken.

What the Gen 1 manual sets out, and what the preview now does:

| Manual (Gen 1) | Round 1 | Now |
|---|---|---|
| Egg hatches about 5 minutes after the clock is set | 1 minute | ACCEPTED: 5 minutes |
| Hearts start empty, so the new pet calls you | started 2/2 | ACCEPTED: 0/0, the light comes on at hatching |
| Feed: Meal or Snack; overfed pets refuse | meal +1 food; snack +1 food +1 happy | ACCEPTED: meal +1 food +1 weight; snack (cupcake) +1 happy +2 weight, refused when happy is full |
| Status: age/weight, discipline, hunger, happy | age, food, happy, donuts | ACCEPTED: page 1 is age and weight (the discipline page is pending your decision) |
| Game: 5 rounds, A left / B right, 3+ matches raises happy, score screen, keeps going until C | one game, no score | ACCEPTED: "misses VS wins" score screen, then the next game starts until C; each game burns 1 weight |
| Medicine: sometimes 2–3 doses | 1 dose | ACCEPTED: 1–3 doses, set from the time it got sick so the server can agree |
| Droppings must be cleaned or it gets sick | sick after 18 awake hours | unchanged: school timing (below) |
| Lights: turn off when it sleeps; it switches them back on when it wakes | yes | unchanged |
| While asleep, only Lights and Status work | Medicine also allowed | ACCEPTED: Lights and Status only |
| Clock: B with nothing selected | none | ACCEPTED: 12-hour clock (Auckland) with AM/PM |
| Sound: hold C and press A | none | ACCEPTED: square-wave beeps (press, a call when the light comes on, a tune on hatching or growing). Off by default for classrooms |
| Good care from the start sets a good growth path; neglected discipline means a bad-mannered adult | growth by care days only | ACCEPTED: care mistakes decide the adult (below) |
| Discipline icon, false calls, discipline meter | not included | NOT ADDED: owner's 6-icon decision; asked again |
| Death or departure, then a new egg | not included | NOT ADDED: owner decision (sick, never dies) |
| Attention icon on screen | amber light on the case | kept: the owner's choice of an attention light |

Also added:

- Care mistakes (counted from child to adult): food or happy left empty for 6
  awake hours, or the pal getting sick.
- A teen stage. Stages: egg → baby → child (2 care days) → teen (4) → adult (7).
- The adult form: at most 4 mistakes gives a well-raised adult, more gives a
  scruffy one. There are three new original scruffy sprites:
  - Mossbit: droopy ears and a messy tuft.
  - Pufflet: a jagged storm cloud with drips.
  - Emberoo: a bent ear and a frazzled tail.

  All scruffy pals have half-lidded eyes.
- The base weight rises with each stage: 5, 10, 20, 30. A pal 15 or more over base
  is "heavy" and refuses treats until games burn the weight off.
- Kept as school adaptations, not from the manual:
  - Slower timers paced for one visit per school day.
  - Sleep pauses needs, and lights left on at night are never a mistake.
  - The nap: after 3 games the pal is sleepy, and Lights gives a 20-minute nap and
    +1 happy, so Lights has a use during the school day.
  - The 3-treats-a-day cap and the donut price.

Round 2 changes / disposition:

- ACCEPTED — everything marked ACCEPTED above, in `donutPal.js`, `donutPalArt.js`
  and `YumPalsDonutPreview.jsx`, plus How to play. The preview storage key is now
  `-v2`, so round-1 saves start a new egg.
- REFUSED (my bug, fixed) — holding C plus A first used a C flag cleared by a timer
  after the pointer was released. In the full playthrough it got stuck "held", so a
  later A key toggled the sound instead of selecting an icon. It now tracks the
  actual pointers down on C, clears them on any pointer release, cancel or window
  blur, and keeps the C key separate. The playthrough's sound checks pass.
- REFUSED (test expectations, not code) — the scruffy unit test needed 7 care days,
  not 6. The playthrough's keyboard check ran with Lights still selected. The
  playthrough's growth check expected a well-raised adult, but it only fed the pal
  each day (no play), so happy sat empty daily and it earned 7 mistakes and a
  scruffy adult. That is the rule working, so the check now confirms the form
  matches the mistake count.
- FINDING — keeping happy above empty takes play, not just meals. Happy drops about
  2 hearts per school day, and a game is won about half the time. A daily visit
  with ~3 games plus the nap keeps it up. Food alone does not.

Round 2 measured results:

- `donutPal.test.js` 12/12. `donutPalArt.test.js` 5/5 (all 10 bodies × 12 faces
  are 16×16; every screen, animation, score and clock frame is 32×16; scruffy
  differs from well-raised).
- Frontend 184/184, lint exit 0, `git diff --check` clean. Build exit 0, with the JS
  bundle unchanged (933.89kB / 276.87kB gzip).
- `donut-pal-check.mjs` 28/28:
  - Hatches hungry and sad with the light on; meals stop at full.
  - The game shows a result and starts the next game by itself; C stops it.
  - Mess and the light, then clean.
  - The treat cost; medicine refused when well.
  - Sickness, then 2 doses to cure.
  - Baby → child → teen → an adult matching its mistakes (scruffy, 7 mistakes).
  - Asleep at night: no feeding, Status still works, lights off.
  - Keyboard A; B with nothing selected shows the clock.
  - Sound starts off, and hold C + A toggles it on and off.
  - Layout at 320, 390 and 1280px; zero page errors.
- The scruffy Mossbit screenshot was inspected at 390px.

## Not done yet (next steps, each needs owner approval)

1. Owner playtest of this preview and any changes to the rules or look.
2. Server rules: free care, growth and the attention light computed on the
   server. Migration of the 13 existing pals, keeping names, species and colours
   (`casing` maps to the glaze). The visit gift and giving cheer carried over.
   Calendar rest days and Holiday Mode keep freezing care.
3. Staged app and server releases with rollback tags, and the design guard tests
   updated deliberately.
