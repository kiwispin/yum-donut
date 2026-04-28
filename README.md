# Yum Donut

Yum Donut is a Vite/React classroom recognition app backed by Firestore.

## Web App

The core Yum Donut app is still a standalone GitHub Pages site.

```bash
npm install
npm run dev
npm run lint
npm run build
npm run deploy
```

The webpage does not require Microsoft Teams or Firebase Functions to run.

## Optional Teams Integration

The `functions/` folder contains an optional Firebase Functions backend for Microsoft Teams. It lets users give donuts from Teams with messages like:

```text
@YumDonut @Alice @Bob 🍩🍩 great teamwork
```

Teams writes into the same Firestore users and transactions used by the web app, so the existing feed, balances, and leaderboard update live.

See [functions/README.md](functions/README.md) for bot setup, mapping, and deployment notes.

The Teams app manifest template lives in [teams-app-manifest](teams-app-manifest).
