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
