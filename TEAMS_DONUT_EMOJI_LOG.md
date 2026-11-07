# Teams donut emoji diagnostics — 7 November 2026

Request: Alison gave donuts through the Teams bot with a 🍩 at the end of her message,
and the bot replied "Add at least one 🍩 emoji to give donuts." The owner asked why,
then approved adding logging ("Yes, add logging").

Branch: `claude/fervent-payne-13daed`, from `main` `9158bde`.
Rollback tag: `codex/teams-emoji-log-baseline-20261107` (`9158bde`).

## Findings (from the `teamsBot` logs)

- 7 November 03:17Z, Alison: `NO_DONUTS`. The message text Teams sent ends
  "…Thanks for filling in for me this week aubree", and its logged code points end
  there: the text contains no 🍩. The message also had one `text/html` attachment
  (the formatted copy), and the bot's patterns found no donut in it either.
- Three earlier `NO_DONUTS` refusals look the same (text with no 🍩, plus a `text/html`
  copy): 4 November 07:15Z ("… WELCOMEEEE"), 5 November 04:42Z ("YAYYYY …") and
  5 November 07:33Z ("Good job … & …").
- Cause, as far as the logs show: the donut was only in the formatted copy, in a form
  the parser does not recognise. The log did not record the formatted copy, so its
  exact form is unknown.
- Note: `firebase functions:log --lines N` returns different time windows for
  different `N` (5 → newest, 1000 → oldest). Small values reach the newest entries.

## Changes / disposition

- ACCEPTED — `functions/src/teamsBot.js`: on a parse miss the log entry gains `html`,
  one item per `text/html` attachment (at most 3). Each item has its length, up to 20
  tags and up to 20 emoji code points (`\p{Extended_Pictographic}`).
  - Tags: mention tags and attribute-free plain tags (`p`, `span`, `at`, …) are
    skipped. Every tag keeps its attribute names.
  - Values are kept only for emoji-related attributes (`itemtype`, `itemid`, `alt`,
    `title`, `class`, `id`, `aria-label`, `type`, `data-tid`, `data-emoji*`). `src`
    keeps only its host and path, with no query string. Any other value becomes `…`.
  - The words of the message are not added. The existing `text` field, unchanged,
    already logs the text with mentions hidden.
- ACCEPTED — `functions/test/teamsBotDiagnostics.test.js`: a message shaped like
  Alison's, with a mystery emoji in the formatted copy. The bot still replies; the
  log shows the emoji's tag, attributes and code point; no names, message words, URL
  token or other link appear.
- UNCHANGED — what counts as a donut, the replies, giving rules.

## Checks

- `functions`: `npm test` 219 pass, 0 fail (1 new). `npx eslint .` clean.

## Release

Approved with the logging ("Yes, add logging"; the proposal was to redeploy
`teamsBot` only).

- SOURCE PUSHED — merged into `main` as `2a6d769` (ordinary `--no-ff` merge);
  `main` and `claude/fervent-payne-13daed` both at `2a6d769`, rollback tag at
  `9158bde`. Verified with `git ls-remote`. `main` already held other sessions'
  released Functions work (student suspension, Donut pal); no Teams file had changed.
- DEPLOYED — `deploy --only functions:teams:teamsBot`: "Successful update
  operation", "Deploy complete!". An empty POST still returns 500, as before.
- No website change.

Next: when the next `NO_DONUTS` refusal arrives, read its `html` entry, add that
form to `teamsParser.js` with a test, and redeploy `teamsBot`.
