# Yum Donut Teams Integration

This Firebase Functions app is an optional add-on for Yum Donut. The existing GitHub Pages web app continues to run without it.

## Behaviour

Users mention the bot in Teams:

```text
@YumDonut @Alice @Bob 🍩🍩 great teamwork
```

The function:

- counts donut emojis as the amount per recipient;
- allows multiple mentioned recipients;
- enforces the same 5-donut daily giving limit;
- writes to the existing Yum Donut Firestore users and transactions collections;
- stores Teams-only mapping, daily fallback, and idempotency metadata under `integrations/teams`.

## Teams Mapping

Create mapping documents in:

```text
artifacts/yum-donut-school/public/data/integrations/teams/mappings/{mappingKey}
```

`mappingKey` is the base64url encoding of the stable Teams user id, preferably the user's `aadObjectId`.

Example document:

```json
{
  "yumName": "Alice",
  "teamsUserId": "29:...",
  "teamsAadObjectId": "...",
  "teamsEmail": "alice@example.school",
  "displayName": "Alice Example"
}
```

Map Mr Rayner with `"yumName": "Mr Rayner"` to inherit the admin unlimited-giving behaviour.

## Required Environment

Set these Firebase secrets before deploying:

```bash
firebase functions:secrets:set MICROSOFT_APP_ID --project yum-donut-school
firebase functions:secrets:set MICROSOFT_APP_PASSWORD --project yum-donut-school
```

`YUM_DONUT_TIME_ZONE` can be set as a normal environment variable if needed. It defaults to `Pacific/Auckland`.

The exported HTTPS function is `teamsBot`.
