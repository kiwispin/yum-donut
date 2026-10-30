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

- ACCEPTED (owner request, 31 October; sketch approved first) — a retro
  game-manual look for the caption and How to play. Style only: no real magazine
  names, logos or characters.
  - The caption under the donut is a game dialog box: dark, with a double white
    border and pixel lettering. A picked icon gets a yellow ▶ in front ("▶ Clean").
    Long messages wrap inside the box. An empty box keeps its space, so nothing
    jumps.
  - How to play is a manual page:
    - A pink title bar ("How to play", "P.1") with ▶/▼ for closed and open.
    - Five numbered sections in yellow tabs: the buttons, feeding, left or right,
      keeping it well, growing up.
    - Round A, B and C buttons drawn inline.
    - A tilted blue "Pro tip!" box.
  - Only headings and the caption use the pixel font. Explanations stay in the
    normal font for reading.
  - Font: "Press Start 2P" (`@fontsource/press-start-2p` 5.3.0, OFL-1.1, pinned
    exactly), Latin subset only. It is bundled into the site (woff2 12.5 KB, woff
    6.3 KB), so nothing loads from an outside font server.
  - `package-lock.json`: the only change besides the new package is npm dropping
    `"peer": true` markers. No installed version changed.
  - Files: `DonutDevice.jsx` (caption classes, the `HowToPlay` manual layout) and
    `donutPal.css`.
- REFUSED (my error, fixed) — my edit script turned the CSS escape codes for ▶, ▼
  and a non-breaking space into control characters, so the page showed "B6", "a0"
  and "BC". The CSS now holds the real characters. Seen on the test page and fixed
  before any commit.
- Measured:
  - Frontend 197/197, lint exit 0. `donut-saved-check.mjs` 14/14,
    `donut-pal-check.mjs` 28/28.
  - Build exit 0: JS 977.71kB / 291.80kB gzip, CSS 103.35kB / 19.25kB gzip, plus
    the two font files.
  - Checked in the browser pane at desktop width and 375px: "▶ Clean" in the box
    in the pixel font (font loaded). The two-line gift message wraps inside the box.
    No sideways scroll. The whole manual page down to the Pro tip was inspected.

- ACCEPTED (owner feedback, 31 October) — one fixed caption box. Owner: the first
  message of the day was two lines and then everything else one, which was
  jarring.
  - Cause: the box grew to fit each message. Measured before the fix: 47, 65, 84
    or 103px tall (1–4 lines at 320px). The day's visit gift and giving cheer were
    also joined into one long message.
  - Fix: the box is a fixed three-line size like a game dialog box
    (`height: calc(3 * 1.7em + 28px)`, 84px), with the text centred.
  - The day's gifts are now separate messages, queued one after another
    (`giftMessages` in `donutUi.js`).
  - Two messages that needed four lines on a 320px phone were shortened:
    - "… grew into a scruffy adult. Too many care mistakes!" became "… grew up
      scruffy. Too many care mistakes!"
    - "Your pal is sleepy now." after a game became "Time for a nap."
  - `allCaptions()` lists every message the box can show (51, using a 16-letter
    name). `verification/caption-sizes.html`/`.jsx` and `-check.mjs` measure them
    all in the real box.
  - Measured:
    - `caption-sizes-check.mjs` 8/8: one height and no overflow at 320, 360, 390
      and 1280px. At most 3 lines; 320px: 20 one-line, 16 two-line, 15 three-line.
    - A real sequence on the test page (start, hatching, gift, three icon picks):
      the box stayed 84px tall at the same position at 320, 390 and 1280px.
    - Frontend 197/197, lint exit 0. `donut-saved-check.mjs` 14/14,
      `donut-pal-check.mjs` 28/28.

- REFUSED (owner feedback, 31 October) — the fixed three-line box. Owner: "Waayyy
  too much space… almost as big as the Tamagotchi itself." It was 84px tall and
  360px wide for one word. It is replaced by:
- ACCEPTED — a slim one-line caption strip, like an old handheld's text line.
  - Size: 290px wide at most, 36px tall (`height: calc(1.6em + 18px)`), with a 3px
    double border and a 2px outline. One line, never wrapping.
  - Every caption is rewritten as short game-style text of at most 22 characters
    (`MAX_CAPTION` in `donutUi.js`). Examples: "Too full!", "Shh! Asleep.", "Daily
    gift: +1 food", "It hatched!", "Grew up scruffy!", "Cupcake! -1 donut",
    "No signal. Try again.", "A=left B=right C=stop".
  - Every rule refusal reason has its own short line; anything unexpected says
    "Nothing happened.". The longer `REFUSALS` text in the shared rules
    (`donutPal.js`, also on the server) is unchanged, so no server change.
  - When the next game starts by itself, the strip shows the game hint again.
    After a third game the result line is "Sleepy! Lights off?".
  - The full explanations stay in How to play. Screen readers still get the full
    description of the pal from the screen's label.
  - Loading and error text on the no-pal and failed-load screens moved to a plain
    `donut-status-text` line (not the strip).
  - Tests and checks updated for the new wording, plus a test that every caption is
    at most 22 characters. `caption-sizes-check.mjs` now also requires exactly one
    line and no sideways overflow.
  - Measured:
    - `caption-sizes-check.mjs` 12/12: all 47 captions on one line, one strip height,
      no overflow, at 320, 360, 390 and 1280px.
    - A real sequence (start, hatching, gift, three icon picks): the strip stayed
      36px tall at the same position at 320, 390 and 1280px (was 84px).
    - Frontend 198/198, lint exit 0. `donut-saved-check.mjs` 14/14,
      `donut-pal-check.mjs` 28/28. Screenshot inspected: "▶ Clean" in a strip
      narrower than the donut.

- ACCEPTED (owner, 31 October: the slim strip "Looks good") — owner then asked for
  the pal's name to look as purposeful as the other text.
  - The name is now a retro name plate: pixel font at 14px, white on the manual's
    pink (#e64980), a 3px ink border with a hard 3px shadow, and tilted -2° like a
    sticker above the keyring loop.
  - Kept inside the screen (`max-width`), so a long name could wrap rather than
    overflow. Measured, it never needed to. The adoption form heading shares the
    style. `donutPal.css` only.
  - Measured:
    - "Niblet", "Abcdefghijklmnop" and "Mr Rayners Pal 1" (16 letters is the
      longest name allowed) each fit on one line inside the viewport, with no
      sideways scroll, at 320, 390 and 1280px.
    - Screenshots at 390px (Niblet) and 320px (16 letters) inspected.
    - Frontend 198/198, lint exit 0. `donut-saved-check.mjs` 14/14,
      `donut-pal-check.mjs` 28/28, `caption-sizes-check.mjs` 12/12.

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
