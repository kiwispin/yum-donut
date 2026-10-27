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
