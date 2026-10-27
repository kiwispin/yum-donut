# Phone Jobs button — 27 October 2026

Found while verifying the one-line navigation live: on phones, the bottom bar's
Jobs button opened a blank page. It set the view to `bounties`, but the Jobs page
renders for `jobs` (the top menu already used `jobs`). Introduced in `a4f5182`.

Baseline: `a87f4d0`, preserved by `codex/phone-jobs-button-baseline-20261027`.

## Changes / disposition

- ACCEPTED — App.jsx bottom bar: Jobs now opens and highlights `jobs`. One line;
  no other routes, styling, data or backend changes. Cross-checked that every
  `setView` target in App.jsx has a matching rendered page.

## Measured results

- Frontend suite: 124/124 passed. Lint exit 0 (existing stale
  `baseline-browser-mapping` warning only). `git diff --check` clean.
- Production build exit 0 with the `.env.production` YumPals flags. CSS
  `index-D3draj83.css` unchanged from the previous release.
- RELEASE VERIFIED — source `06dc90d` published with `npm run deploy` as `gh-pages`
  commit `ef908f3`. Live after ~45s: live `index.html` byte-identical to the tested
  build; JS `index-tUJ36xRq.js` (MD5 `90813e65ac60cb33d188986b6f73b19c`) and CSS
  `index-D3draj83.css` (MD5 `cfce9999846912632f40bb3f9b53bb76`) match locally.
  Signed in by the owner at 375px: bottom-bar Jobs opens the Jobs page, the Jobs
  icon and top-menu More are highlighted, zero console errors. Nothing was posted
  or changed. Rollback: rebuild and publish `codex/phone-jobs-button-baseline-20261027`.
