# Source publication

The owner requires all approved app changes to be pushed to GitHub. Publishing
only compiled website files is incomplete.

- Keep `main` current with the approved production source. Push the working
  release branch as well, with an upstream, so ongoing work is backed up.
- Commit and push the relevant frontend, Functions source, tests, documentation
  and change logs before publishing a website or deploying a function.
- Push the rollback tags for that release. Preserve existing remote work and
  use ordinary merges and pushes; never force-push to bypass divergence.
- Confirm the remote commit IDs after pushing. Do not report a release as fully
  pushed merely because `gh-pages` contains its compiled assets.
- Keep unrelated parked experiments out of production merges.

`gh-pages` holds the built website. `main` holds its editable production source.
Use the production build flags documented in README.md when publishing YumPals.
