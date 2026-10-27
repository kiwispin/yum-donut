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
  `codex/yumpals-only-release`, plus all 28 local rollback/checkpoint tags.
  Atomic push succeeded. **Accepted**.

## Verification

- Runtime source comparison against the verified live source commit `fa4d866`
  showed no differences in `src`, `functions`, package files, Vite configuration
  or Firebase configuration after merging the upstream documentation change.
- No runtime code was changed for this publication task; existing release test
  results remain recorded in the implementation logs. No repeat test run needed.
- The tracked Functions `.env` contains only the two rollout flag names; no
  credential/key files were found among tracked filenames.
- Verified GitHub's `main` and `codex/yumpals-only-release` both pointed to
  `b0d276dcf71cbf987bfd1063d799717741223a16`, containing the complete release
  history and the source-publication policy. All 28 remote tag IDs matched their
  local tag IDs. The release branch now tracks its GitHub upstream.
- This final verification record is committed and pushed to both source branches
  as a documentation-only follow-up; runtime code still matches the live release.

No force-push, app redeployment or production data change is required.
