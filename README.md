# Yum Donut

Yum Donut is a Vite/React classroom recognition app backed by Firestore.

Built by [Carl Rayner](https://www.carlrayner.com/). Read the [YumDonut case study](https://www.carlrayner.com/work/yum-donut/) for the problem, design decisions and experience using it with a classroom team of 20+ over two years.

**Live app:** https://kiwispin.github.io/yum-donut/ (sign-in required).

## Web App

The core Yum Donut app is still a standalone GitHub Pages site.

```bash
npm install
npm run dev
npm run lint
```

The site uses Firebase for sign-in and data. Saved YumPals and student account
setup also use the callable services in `functions/`. Microsoft Teams is optional.

## Publishing changes

Always commit and push the approved source changes, release logs and relevant
rollback tags to GitHub before deployment. Keep `main` current with the approved
production source, and push the working release branch with an upstream. Preserve
any changes already on GitHub when merging. Verify the remote commit IDs.

The current production frontend is built and published with:

```bash
VITE_YUMPALS_PAID_CARE=enabled \
VITE_YUMPALS_SAVED_GAME=enabled \
VITE_YUMPALS_PAID_CONTROLS=enabled npm run build
npx gh-pages -d dist
```

Publish that prepared `dist` directly: `npm run deploy` invokes a fresh build and
can omit these feature flags. Deploy only the changed Firebase callable targets
when backend source changes. Verify the live site and targeted function after
deployment. Compiled files on `gh-pages` do not replace pushing the editable source.

## Optional Teams Integration

The `functions/` folder contains an optional Firebase Functions backend for Microsoft Teams. It lets users give donuts from Teams with messages like:

```text
@YumDonut @Alice @Bob 🍩🍩 great teamwork
```

Teams writes into the same Firestore users and transactions used by the web app, so the existing feed, balances, and leaderboard update live.

See [functions/README.md](functions/README.md) for bot setup, mapping, and deployment notes.

The Teams app manifest template lives in [teams-app-manifest](teams-app-manifest).

## YumPals

YumPals is the live virtual-pet module. Teachers can enable it for students in
Admin Settings → YumPals, or use the session preview with pretend donuts. Saved
pets and care purchases use the deployed callable services. Current source is in
`src/yumpals/` and `functions/src/yumpals/`; the release and speed logs record the
implementation, checks and deployments. `YUMPALS_ROLLOUT.md` retains the original
rollout plan.
