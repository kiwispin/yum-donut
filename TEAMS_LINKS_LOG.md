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

## Release — not yet

Waiting for the owner's approval. When approved:

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
