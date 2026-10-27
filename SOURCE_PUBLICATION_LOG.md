# Source publication — 27 October 2026

The owner confirmed that all approved source changes must always be pushed to
GitHub, including when publishing the website. The prior deployments updated
`gh-pages`, but the editable release branch remained local.

## Accepted changes

- Merged GitHub's `main` into the complete release branch, preserving the newer
  author/case-study README links. GitHub had one documentation-only commit since
  the common ancestor. No runtime source conflict or change resulted. **Accepted**.
- Added `AGENTS.md` with the standing requirement to push production source,
  the working release branch, logs and relevant rollback tags before deployment;
  verify remote commit IDs and keep unrelated parked experiments out of main.
  **Accepted**.
- Updated README with the actual production source/publication workflow and
  required YumPals build flags. Corrected the outdated rollout status. **Accepted**.
- Publish the complete release source to `main` and
  `codex/yumpals-only-release`, plus its rollback tags. **Pending push**.

## Verification

- Runtime source comparison against the verified live source commit `fa4d866`
  showed no differences in `src`, `functions`, package files, Vite configuration
  or Firebase configuration after merging the upstream documentation change.
- No runtime code was changed for this publication task; existing release test
  results remain recorded in the implementation logs. No repeat test run needed.
- The tracked Functions `.env` contains only the two rollout flag names; no
  credential/key files were found among tracked filenames.
- Remote branch and rollback-tag verification is pending.

No force-push, app redeployment or production data change is required.
