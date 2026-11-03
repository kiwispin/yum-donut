# Teams links screen — 3 November 2026

Request: add a teacher-only screen for linking students' Microsoft Teams accounts to
their Yum Donut names. Until now each link was a Firestore document made by hand in
the console. The first real paid-giving test failed with "I could not match Aaishah
to the Yum Donut roster" because Aaishah's Teams account had no mapping.

Branch: `claude/fervent-payne-13daed`, from `main` `218a774`.
Rollback tag: `codex/teams-links-baseline-20261103` (`218a774`).

## Findings before the change

- Firestore rules: the production rules (`verification/yumpals/baseline.firestore.rules`)
  let any signed-in user, anonymous ones included, write anywhere under
  `artifacts/yum-donut-school/public/data`, which includes the Teams mappings. The
  rules give no teacher-only protection, so client writes would not be safe.
  Writes therefore go through a callable with server-side checks. The rules are
  unchanged.
- A Teams mapping is also a spending key: since paid giving, whoever holds a
  mapping to a name can spend that student's donuts. A mistaken link is a wallet
  problem, not just a display one.
- The bot keys a sender by `aadObjectId` (`activity.from`) but a mentioned user by
  the mention's `id`, so one student can appear as two pending records. Both must
  be linked to the same name for them to give and receive.

## Changes / disposition

- ACCEPTED — `functions/src/teamsLinkService.js`: teacher-only callable with three
  actions. The checks follow `studentAccountService.js`: the `yumpalsAdmin` claim
  must be present and anonymous sign-in is refused. The request must have exactly
  the expected fields.
  - `list` returns the active roster, the existing links and the pending Teams
    users who are not linked yet. Each link shows whether its name is still on the
    roster and whether the student has an account (needed to give).
  - `link` runs in one transaction. The name must be an exact active roster name.
    The Teams user must have been seen by the bot (a pending record) or already be
    linked. The Teams id, display name and email come from that stored record, never
    from the browser. If another Teams record is already linked to the same name,
    the request is refused unless the teacher confirmed (`alsoLinked: true`).
    Changing a link to a different name writes a fresh document, so a hand-made
    `uid` or `isAdmin` for the old name cannot carry over. Relinking to the same name
    keeps the existing fields and refreshes the Teams details.
  - `unlink` deletes the mapping. The pending record stays, so the person returns to
    the waiting list.
- ACCEPTED — `functions/index.js`: exports `teamsManageLinks` (`us-central1`).
- ACCEPTED — `src/TeamsLinksPanel.jsx` and a new Teams tab in Admin Settings
  (`src/App.jsx`: import, one callable reference, the tab button and its panel; no
  existing handler changed). The panel lists "Waiting to be linked" and "Linked".
  It suggests a roster name only when the Teams name matches exactly one student
  (`src/teamsLinks.js`). It confirms before a second link to the same name and
  before removing a link. It marks links whose student is no longer on the roster,
  and students who cannot give yet because they have never signed in. It is
  disabled in sandbox mode. Admin Settings is already shown only to Mr Rayner; the
  server enforces the claim regardless.
- ACCEPTED — `functions/README.md` (Teams Mapping) describes the screen and the
  two-records point.
- UNCHANGED — the bot, parser, giving rules, pending-record writer, Firestore rules,
  Teams manifest and `.env.production` flags.

## Checks

- `functions`: `npm test` 199 pass, 0 fail (9 new in
  `test/teamsLinkService.test.js`). The new tests cover: teacher-only access
  (student, anonymous and signed-out callers change nothing); the list contents;
  linking from the stored identity, followed by a real `giveDonutsFromTeams` gift
  reaching the linked student; the confirmation for a second record; a changed link
  dropping the old `uid`/`isAdmin`; relinking keeping a hand-made `uid`; unlink
  returning the person to pending; roster and seen-user checks; and malformed
  requests refused with nothing written. `npx eslint .` clean.
- Web: `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js` 233
  pass, 0 fail (3 new in `src/teamsLinks.test.js`; `releaseScope.test.js` still
  passes). `npx eslint .` clean (existing `baseline-browser-mapping` notice only).
  `npm run build` (loads `.env.production`) passes with the existing large-chunk
  notice.
- Preview: the panel was rendered on its own with fake data, at desktop and phone
  widths. Checked: linking, the second-record confirmation, changing a link and the
  status badges. No live data was read or written.
- Not exercised: the deployed callable, the real Admin Settings modal signed in as
  the teacher, and real Teams records.

## Release — 3 November 2026

The owner approved the release ("Release it").

- SOURCE PUSHED — `e3f6b9b` merged into `main` as `b3eb2a7` with an ordinary
  `--no-ff` merge; `main` and `claude/fervent-payne-13daed` both at `b3eb2a7` on
  GitHub, rollback tag `codex/teams-links-baseline-20261103` at `218a774`. Verified
  with `git ls-remote`.
- FUNCTION CREATED, NOT YET CALLABLE — `deploy --only functions:teams:teamsManageLinks`
  built and started the function (`teams:teamsManageLinks(us-central1)`, revision
  `teamsmanagelinks-00001-ren`, state ACTIVE). The last step, granting `allUsers` the
  `roles/run.invoker` role on Cloud Run service `teamsmanagelinks`, failed: the
  signed-in account lacks `run.services.setIamPolicy` (HTTP 403). An unauthenticated
  POST to the function returns a bare 403 from Cloud Run, whereas
  `yumpalsManageStudentAccount` reaches its own teacher check. Every callable here
  carries this invoker grant; the teacher check is done inside the function.
- WEBSITE HELD — not published until the function is callable, so the teacher
  never sees a broken Teams tab.
- Fix (owner): Google Cloud console → Cloud Run → `teamsmanagelinks` → Security →
  "Allow public access" (or Permissions → add principal `allUsers`, role Cloud Run
  Invoker). Alternatively give the deploying account Cloud Functions Admin and rerun
  the deploy.
- PUBLIC ACCESS GRANTED (owner) — in the Cloud Run console, Security → Allow public
  access, viewed the diff and deployed a new revision serving immediately. Same
  code; only access changed. An unauthenticated POST now returns the function's own
  `PERMISSION_DENIED` "Only the signed-in teacher can link Teams accounts.", and the
  CORS preflight from `https://kiwispin.github.io` returns 204. `functions:list`
  shows `teamsManageLinks` (v2 callable, us-central1) alongside `teamsBot`.
  The next Firebase deploy of this function will replace the console-made revision.
- WEBSITE PUBLISHED — `npm run deploy` from `main` `0e54de2` (production flags from
  `.env.production`). `gh-pages` `99f9bf5` → `d3cb974`, an ordinary push. The live
  page references `index-stihcS47.js` (SHA-256 `b126bcd18e8f87554613ac30026b47f2f3bd5bd722df83a8f25e38aea7094e9f`)
  and `index-wKdY67Gh.css` (SHA-256 `ee044178c7b4535232a2a753a1856dfa6acf7735cd6423869039234f5242ceac`);
  both match the local build byte for byte, and the JS contains `teamsManageLinks`.
- NOT VERIFIED — the Teams tab signed in as the teacher against live data, and a
  successful Teams gift after linking.

Plan as approved:

1. Merge this branch into `main` with an ordinary merge and push `main`, the branch
   and the rollback tag; confirm the remote IDs with `git ls-remote`.
2. Deploy only the new callable:
   `npx --yes firebase-tools@15.34.1 deploy --only functions:teams:teamsManageLinks --project yum-donut-school --non-interactive`.
   `teamsBot` is unchanged and does not need redeploying.
3. Publish the website from `main` with `npm run deploy` (production flags from
   `.env.production`).
4. In Admin Settings → Teams, link Aaishah (both records if she appears twice), then
   retry the test gift.

Rollback: redeploy the site from `codex/teams-links-baseline-20261103`. The callable
can stay or be deleted with
`npx --yes firebase-tools@15.34.1 functions:delete teamsManageLinks --region us-central1 --project yum-donut-school`;
links it made are ordinary mapping documents and keep working.

Note: another agent may be working in the main checkout. This work is in its own
worktree and touches none of its files.

# Team member list — 3 November 2026

Request: after the first release, the owner found that the screen showed only 9
people out of the whole Team. It still listed Chenuthi and Seoyeon, who have left
the Team and are no longer on the roster. It had a stray "AppValidation", and showed
"S" for Amelia S. The owner asked to "build it": read the real member list from
Teams. They also said the Yum Donut roster is the source of truth for names.

Branch: `claude/fervent-payne-13daed`, from `main` `180fcc3`.
Rollback tag: `codex/teams-roster-baseline-20261103` (`180fcc3`).

## Cause (from the code; reading the production data was refused)

- The screen listed only Teams users the bot had recorded: someone who wrote
  `@YumDonut`, or someone @mentioned in such a message. Nobody else could appear.
- Records are never removed, so people who left (Chenuthi, Seoyeon) and test
  accounts (AppValidation) stayed listed.
- The new Teams client splits a mention of "Amelia S" into "Amelia" and "S" for the
  same person. The bot stored each piece as her name, and the last one ("S") stuck.
  Gifts were unaffected because recipients are de-duplicated by id.

## Changes / disposition

- ACCEPTED — `functions/src/teamsRoster.js`: the bot saves its Team's details
  (`teamReference`: service address, team id, tenant, team name) on each Teams
  activity. `createTeamsRoster` reads the Team's members page by page, or one member,
  through the bot (`continueConversationAsync` + `TeamsInfo`). The saved details are
  in publicly writable data, so they are checked on every use: https only, a
  Microsoft Teams service host, no user/port, and the tenant must equal
  `MICROSOFT_APP_TENANT_ID`. Errors are caught inside the call, so the adapter's
  `onTurnError` never posts its apology in the Team channel.
- ACCEPTED — `functions/src/teamsBot.js`: remembers the Team before handling each
  turn. A failure is logged and never blocks a gift or reply.
- ACCEPTED — `functions/src/teamsParser.js`: split mention pieces for one person
  become one recipient named from the distinct pieces ("Amelia S").
- ACCEPTED — `functions/src/teamsLinkService.js`:
  - `list` returns `team` (`ok`/`unknown`/`error`), `people` (one row per current
    member: real name, email, linked name, whether both ids are linked, on roster, has
    an account) and `records` (bot records not belonging to any member).
  - `link` with a `personId` re-reads the member from Teams. It writes the mapping
    under both keys (Entra id for giving, Teams id for mentions) with Teams' own
    name, email and ids. Linking someone else to a name that is taken still needs
    confirmation; the same person's other key does not.
  - `unlink` with a `personId` removes both keys. The new `forget` removes a
    record's link and the bot's record (for people not in the Team).
  - The `mappingKey` actions remain as a fallback until the bot has seen the Team.
- ACCEPTED — `functions/index.js`: `teamsManageLinks` now declares the three
  `MICROSOFT_APP_*` secrets and gets the roster reader; `botbuilder` still loads
  lazily.
- ACCEPTED — `src/TeamsLinksPanel.jsx`:
  - With a known Team: "Showing everyone in <Team>: X of N linked", then "Waiting to
    be linked", "Linked" and "Not in the Team" (Remove, Remove all).
  - Older one-way links show "Fix link".
  - Before the Team is known: a notice to write `@YumDonut hello` once, plus the old
    record view with Dismiss.
  - Name suggestions skip names already linked. `src/teamsLinks.js` now also
    matches "First L" by surname initial (Amelia Smith → Amelia S).
- UNCHANGED — giving rules, mapping-key format, existing links (they keep working;
  the teacher's hand-made link shows "Fix link"), Firestore rules, Teams manifest.

## Checks

- `functions`: `npm test` 210 pass, 0 fail. `test/teamsLinkService.test.js` has 12
  tests: Team list, both-key link with real gifts in both directions, fix a half
  link, confirm a shared name, change, remove, forget a leaver, Teams down, Team
  unknown fallback, teacher-only, malformed. `test/teamsRoster.test.js` has 8 new
  tests: trusted hosts, remembering the Team, ignoring non-team activity, a failed
  save still lets the bot reply, paging, a leaver reads as nobody, no channel
  apology on error, tampered reference refused before any token is used, and split
  mentions. `npx eslint .` clean.
- Web: 233 pass, 0 fail. `npx eslint .` clean; `npm run build` passes.
- Preview with fake data (desktop and phone): Team view, Remove all, Fix link,
  Team-unknown view.
- Not exercised: the real Teams member API (`getPagedTeamMembers`) for this Team,
  the real Admin Settings tab, and whether mention ids match member ids in this
  tenant. They do in Microsoft's documentation, and the tests assume so. If not,
  current members would appear under "Not in the Team".

## Release — 4 November 2026

The owner approved the release ("Release it").

- SOURCE PUSHED — `2d057fa` merged into `main` as `be2c972` with an ordinary
  `--no-ff` merge; `main` and `claude/fervent-payne-13daed` both at `be2c972`,
  rollback tag `codex/teams-roster-baseline-20261103` at `180fcc3`. Verified with
  `git ls-remote`.
- DEPLOYED — `deploy --only functions:teams:teamsBot,functions:teams:teamsManageLinks`:
  "Successful update operation" for both, "Deploy complete!". No IAM error this
  time; the public access the owner granted is kept. An unauthenticated POST to
  `teamsManageLinks` returns its own `PERMISSION_DENIED` teacher message, and the
  CORS preflight from `https://kiwispin.github.io` returns 204. An empty POST to
  `teamsBot` returns 500, as before this release (the Bot Framework rejects a body
  with no activity).
- WEBSITE PUBLISHED — `npm run deploy` from `main` `be2c972`; `gh-pages`
  `d3cb974` → `0051638` (ordinary push). Live `index-Dd-OMJfH.js` (SHA-256
  `4f68ca4616f10e88354fac0bcac0a9ed26610912219cc2f4604cd49249b75249`) and
  `index-DEVqN6yu.css` (SHA-256 `132ced4e36e29bc6d072d144603441d49b1990d1d29581c25cb98aff53648b3b`)
  match the local build byte for byte; the JS contains the new screen.
- VERIFIED BY THE OWNER — after one `@YumDonut` message in the Team, Admin Settings →
  Teams "Shows the whole Team", so the bot saved the Team and `teamsManageLinks`
  read the real member list.
- Still not exercised: a successful paid gift in Teams between two linked students.

Plan as approved:

1. Merge into `main` (ordinary) and push `main`, the branch and the rollback tag.
2. Deploy both changed functions:
   `npx --yes firebase-tools@15.34.1 deploy --only functions:teams:teamsBot,functions:teams:teamsManageLinks --project yum-donut-school --non-interactive`.
   `teamsManageLinks` gains secrets, so Cloud Run access may need checking again
   (the console grant from the first release should carry over).
3. `npm run deploy` from `main`.
4. In the Team, write `@YumDonut hello` once, then open Admin Settings → Teams and
   press Refresh.

Rollback: redeploy `teamsBot` and `teamsManageLinks` and the site from
`codex/teams-roster-baseline-20261103`. Links made in between are ordinary mapping
documents and keep working.
