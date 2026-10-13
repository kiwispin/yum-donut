# Student login setup repair — 14 October 2026

## Baseline and scope

Baseline commit: `71f5fb7`; rollback tag: `codex/account-setup-baseline-20261014`.

Confirmed defect: Admin Settings → Roster → Add wrote only the roster document. It did not create a Firebase Authentication login. Password reset called a separate, untracked legacy function, and could only change passwords for accounts it already found. This left roster entries such as Kate and Lauren without sign-ins.

Scope: make Admin Add create a sign-in and roster entry together; let the existing password key create a sign-in for a roster-only student or reset that student's existing password. Keep their saved profile and donuts untouched. No password is stored in Firestore or logs.

## Accepted changes

- `functions/src/studentAccountService.js`: teacher-claim-only callable service; validates exact roster membership, bounded name/password input and non-anonymous teacher identity. Uses the same hashed sign-in email as the web login and checks the old email format for existing accounts. Matches existing users to exact profile/display names and trusted UID links; ambiguous names, conflicting accounts and missing Auth for a UID-linked wallet fail closed. Admin Auth creates/resets the password; new roster entries use Firestore array operations, retaining other entries and removing a matching removal marker. Does not change or create profile/wallet documents. **Accepted**.
- `functions/index.js`: exports only the targeted `yumpalsManageStudentAccount` callable in `us-central1`. **Accepted**.
- `src/App.jsx`: Add prompts the teacher to set an initial password and invokes the callable; the roster key prompts to set/reset a password and creates the missing Auth record for existing roster-only students. Password length is 6–128. These real-account actions are blocked in sandbox mode. **Accepted**.
- `functions/test/studentAccountService.test.js`: synthetic checks for Add, roster-only Kate/Lauren, exact account linking, legacy alias collision, login-email compatibility, unclaimed wallet preservation, deleted linked Auth, roster membership, teacher access and password bounds. **Accepted**.
- `src/yumpals/releaseScope.test.js`: specifically allows only the two approved roster/account handler changes while keeping the prior unrelated-handler guards. **Accepted**.

## Verification results

- Account-service synthetic suite: **8 passed, 0 failed**. Covers parity with the sign-in email generator for Kate, Lauren, Lara/Lara C, and Mr Rayner. No live credentials/accounts or passwords used.
- Frontend suite: **124 passed, 0 failed**.
- Full backend suite plus account service: **147 passed, 0 failed**.
- Frontend and Functions lint passed. Production-flag frontend build passed with existing dependency-age and large-chunk notices.
- Read-only Firebase inventory confirms existing `resetStudentPassword` v2 and other deployed functions remain present. New callable has not yet been deployed.
- No individual Kate/Lauren passwords have been set by this work. Once live, in Admin Settings → Roster, use the key button for each name and enter the password you want to give them. The success message confirms account creation or password change.

## Refused / safeguards

- Refused creating replacement Auth users for public records already linked to a UID whose Auth record is missing; that could detach preserved donuts. The callable instead asks for administrator recovery.
- Refused matching by display name alone when an existing profile disagrees, and refused guessing among two matching Auth accounts. Exact UID/profile checks resolve same-name and legacy email collisions.
- No default/shared student password, plaintext password persistence, wallet/profile migration, donations, bank/gift changes, or unrelated function deployment.

## Release

Implementation commit: `1840b80`. Targeted deployment of `functions:teams:yumpalsManageStudentAccount` completed successfully to project `yum-donut-school`, region `us-central1`, Node.js 22. Read-only Functions inventory lists the new callable and still lists `resetStudentPassword` and `teamsBot`; no existing function was removed.

Frontend deployed to GitHub Pages. Live page now references `index-iur3WECL.js` (SHA-256 `cee921714f33b06d51b322180138678fcb551c252acb259639f93c9a72d0f6d4`) and `index-BASmV3CR.css` (SHA-256 `79951ab31a95f92e00a633faf983553ecc505a8b79246b7d8c53fc9ff93d64d3`); both match the local production build byte for byte, and the JS contains the new callable wiring. A direct unauthenticated request to the callable was rejected as `PERMISSION_DENIED`; no real student account was touched during verification.

The Cloud CLI reported the existing `firebase-functions` SDK as outdated; it was not changed. Existing dependency-age and bundle-size build notices remain.
