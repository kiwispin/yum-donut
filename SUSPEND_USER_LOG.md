# Suspend a student — 5 November 2026

Request: a way to suspend a student who is having a break from the Team, as well as
Add and Delete, "so they don't lose everything, before they might resume". The owner
approved the plan ("Yes, build it"): Suspend in place of the bin, a Suspended list
with Restore, suspended students kept out, their pal paused, no permanent Delete.

Finding: the bin never deleted anything. It moved the name from `names` to
`removed_names` on the roster document; donuts, bank, trophies, looks, pal and
sign-in all stayed. But there was no list to restore from, a still-signed-in student
could keep using the app, and their pal kept fading.

Branch: `codex/suspend-user`, from `main` `5ca0646` (the Teams links release).

## Changes / disposition

- ACCEPTED — new teacher-only callable `yumpalsSuspendStudent`
  (`functions/src/studentSuspensionService.js`), `{ action: 'suspend' | 'restore',
  name }`:
  - Suspend: switches off the student's Firebase sign-in account and revokes its
    refresh tokens, opens a break in `artifacts/yum-donut-school/yumpals/main/breaks/{uid}`
    (`periods: [{ from, to: null }]`), and moves the name off the roster
    (`names` → `removed_names`, plus `suspended_names`).
  - Restore: closes the break, switches sign-in back on (same password), and puts
    the name back.
  - Every step is safe to repeat, so a retry finishes a half-done change. Refuses
    non-teachers, the teacher's own account, names not on the roster, and bad input.
    A student with no sign-in account only moves on the roster.
- ACCEPTED — the pal pauses: `pocketService` reads the student's breaks and adds them
  to the frozen time Holiday Mode already uses, for that student only. A malformed
  break history fails closed with `CORRUPT_BREAKS` (added to the known reasons).
  The old paid-care service is unchanged.
- ACCEPTED — `yumpalsManageStudentAccount`: Add and the key button refuse a suspended
  name and point to Restore, so a student isn't half brought back.
- ACCEPTED — Settings → Roster: the bin is now Suspend (⏸) with a confirmation saying
  what is kept; a Suspended list with Restore; the 19 students removed before this
  change sit in a folded "Removed earlier" list with Restore. Reset to Default keeps
  suspended students suspended.
- ACCEPTED — a suspended or removed student who is still signed in sees "You're on a
  break from the Team" and a Sign out button. The read-only sandbox is exempt, since
  its test student ("Alice") is on the removed-earlier list.
- ACCEPTED — `releaseScope.test.js` names `handleRemoveUser` as an approved change.
- NOT CHANGED — no permanent Delete; Firestore rules; the Teams bot, Leaderboard,
  Give and Feed already ignore names off the roster.

## Checks

- App: `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js` 233 pass,
  0 fail. `npx eslint .` clean. `vite build` succeeds.
- Functions: `node --test` 218 pass, 0 fail (7 new: 6 in
  `studentSuspensionService.test.js`, 1 in `studentAccountService.test.js`; plus a pal
  break test in `pocketService.test.js`). `npx eslint .` clean.
- Browser, local dev server, read-only sandbox (nothing saved): as the teacher, the
  Roster shows Students (25), a Suspend button on hover, and "Removed earlier (19)"
  folded. Clicking Suspend in the sandbox shows "Switch to your live teacher account
  before suspending a student." and sends no request. Before the sandbox exemption,
  the sandbox student saw the break screen as designed.
- Not exercised: the callable against real Firebase (no emulator here: no Java or
  Firebase CLI), a real suspend and restore, the Suspended list with someone in it,
  and a suspended student's pal resting.

## Release plan

Functions first, then the website, because the website calls the new function.
Deploy (by the owner, as for the Teams releases):

```
npx --yes firebase-tools@15.34.1 deploy --only functions:teams:yumpalsSuspendStudent,functions:teams:yumpalsManageStudentAccount,functions:teams:yumpalsGetPaidCareState,functions:teams:yumpalsPurchaseCare --project yum-donut-school --non-interactive
```

Then publish the website. First live check: suspend and restore a test student.

## Release — 5 November 2026

The owner approved the release ("Yes, release").

- SOURCE — `333f45e` on `codex/suspend-user`, merged to `main` as `b6372a8`;
  rollback tag `codex/suspend-user-baseline-20261105` at `5ca0646`. Remote IDs
  verified.
- FUNCTIONS — my deploy was blocked by this session's permissions, so the owner ran
  `deploy --only functions:teams:yumpalsSuspendStudent,functions:teams:yumpalsManageStudentAccount,functions:teams:yumpalsGetPaidCareState,functions:teams:yumpalsPurchaseCare`.
  The three existing functions updated; `yumpalsSuspendStudent` was created, but
  granting it public invoke failed ("Unable to set the invoker for the IAM policy"):
  the deploying account (k1w1cjr@gmail.com) could not change Cloud Run IAM, as with
  `teamsManageLinks` on 3 November. `functions:list` showed all four (v2 callable,
  us-central1); an unsigned POST to the new one returned Cloud Run's bare 403.
- ACCESS — the owner gave k1w1cjr@gmail.com Cloud Run Admin from the project's school
  master account and redeployed (which skipped the unchanged function), then set
  Cloud Run → `yumpalssuspendstudent` → Security → Allow public access. An unsigned
  POST now returns the function's own `PERMISSION_DENIED` "Only the signed-in teacher
  can suspend or restore students.", and the CORS preflight from
  `https://kiwispin.github.io` returns 204. The teacher check inside the function is
  what protects it, as for every other callable.
- WEBSITE — published after the function was callable: `npm run build` and `gh-pages`
  from `main` `b6372a8` as `99f9bf5` → `5801d7f`, live after ~45s. Byte-identical to
  the build:
  - `index.html` (MD5 `a8bb15cee0150ec06a0a603358c3abcb`).
  - JS `index-Cp4vtSa2.js` (`b6642701f606c1daa5b7f02a708d1481`), containing
    `yumpalsSuspendStudent`, "on a break from the Team" and "Removed earlier".
  - CSS `index-DBOHlzyJ.css` (`0470cdeb3a784dd3d3e0dd9cd780a26c`).
- Rollback: rebuild and publish `codex/suspend-user-baseline-20261105`; redeploy
  `yumpalsManageStudentAccount`, `yumpalsGetPaidCareState` and `yumpalsPurchaseCare`
  from it. `yumpalsSuspendStudent` is then unused and can be left or deleted.
- NOT YET SEEN LIVE — a real suspend and restore signed in as the teacher, the break
  screen for a real suspended student, and a suspended student's pal resting.
  Suggested first check: suspend and restore Alice.
