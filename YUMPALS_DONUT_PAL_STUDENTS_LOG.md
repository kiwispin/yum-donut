# YumPals Donut pal — Release 3 (students) — prepared 30 October 2026

Owner: "Go. I think we will tease today with a post in Teams and an image, and then,
as you suggest, roll out on Monday."

Baseline: `b750d54` (`main`, live: Release 2 teacher-only plus the retry fix).
Branch `codex/yumpals-donut-pal-students`. Nothing deployed in this step.

## Changes / disposition

- ACCEPTED — `src/yumpals/donutUi.js`: a guess tapped while the last turn is
  still being revealed now ends that reveal and sends the next guess. Previously it
  was ignored; in the live daytime check one tap was lost after a slow reply.
  After round 5 the score screen still comes first, so there is no sixth guess.
  Test added to `donutUi.test.js`.
- ACCEPTED — `src/yumpals/useSavedVisibility.js` gets a `paused` option.
  - While paused, the minute timer, focus and visibility refreshes are skipped, and
    the last answer is kept, so the YumPals menu item never disappears.
  - `App.jsx` pauses it while the Donut pal is open (YumPals view, donut shown),
    because the donut does its own reads then. The two no longer race on the pal
    record; the race cost 2.7s on one live guess.
  - Elsewhere in the app the background check runs as before (menu item, gift dot,
    and the old data stays current for rollback).
  - The teacher-claim block moved above the hook, since the hook now needs
    `showDonutPal`.
- ACCEPTED — What's New (`PatchNotesModal`):
  - The subtitle is now "Your YumPal has moved into a Donut!"
  - A new top section, "Your pal moved into a Donut!": it hatches from an egg with
    the same name and kind; free care; a cupcake for 1 donut; the attention light;
    growing up; never worse than sick.
  - Removed the old "Spend donuts on food, games and care…" sentence from "Meet
    YumPals!", which contradicts free care. It goes live with Monday's site deploy.
- ACCEPTED — the teaser for today's Teams post (owner posts it; I post nothing):
  - `marketing/donut-pal-teaser.png`: 2400×1350, 1200×675 at 2×, 692 KB.
  - It shows the real handheld with a cracking egg, and "Something's hatching on
    Monday…".
  - Made from `verification/teaser.html`/`.jsx` with
    `verification/teaser-shot.mjs`.
- ACCEPTED — `verification/visibility-pause.html`/`.jsx` and
  `-check.mjs`.

- ACCEPTED (owner request, 31 October) — icon names. Picking an icon with A, or by
  tapping it, names it in the caption line under the donut: Food, Play, Clean,
  Medicine, Lights, Status. The pixel icons alone are not always obvious (a drop
  for Clean, a heart for Status). C clears it, and actions replace it with their
  own message ("Yum!"). `donutUi.js` `pickIcon`, plus a test in `donutUi.test.js`.
  Measured:
  - Frontend 197/197, lint exit 0.
  - `donut-saved-check.mjs` 14/14, `donut-pal-check.mjs` 28/28.
  - On the test page, A three times gave "Clean" under the donut, with the Clean
    icon highlighted (screenshot inspected).

## Measured results

- Frontend 196/196 (195 + 1), lint exit 0. Server 180/180 (no server change).
  `git diff --check` clean.
- `visibility-pause-check.mjs` 4/4:
  - A focus reads again while not paused.
  - Paused: 0 reads on focus or the minute timer, and YumPals stays visible.
  - Unpaused: reads resume.
- `donut-saved-check.mjs` 14/14 and `donut-pal-check.mjs` 28/28 after the guess
  change.
- What's New checked on the dev server (signed-out start screen): the new section is
  on top and the text reads correctly. That dev tab turned out to be signed in from
  an earlier visit, so I only opened What's New there.
- Build exit 0: JS 976.54kB / 291.55kB gzip (+1.1kB), CSS unchanged at 101.49kB.

## Monday plan (each step shown to the owner first)

1. A read-only count before release, in the Firebase console, signed in with the
   owner's personal account. Totals only: pals, pals moved.
2. Server:
   - Tag the rollback point, merge to `main`, run the tests and push.
   - Set `YUMPALS_POCKET_READY=true` in `functions/.env.yum-donut-school`.
   - Deploy only `yumpalsGetPaidCareState` and `yumpalsPurchaseCare`.
   - Check live.
3. Site:
   - Set `VITE_YUMPALS_POCKET=enabled`, then tag, merge, test and push.
   - `npm run deploy`, and confirm the live files match the build.
   - Check live (teacher, plus the What's New entry).
4. The read-only count again one day after release, and after one to two weeks:
   pals moved, Donut pal actions and treats (totals only).

- Rollback:
  - Site: rebuild and publish the tag; students return to the current handheld
    with old data intact.
  - Server: set the parameter back to false and redeploy the two functions.
