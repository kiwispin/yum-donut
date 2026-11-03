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
- charges students for their gifts like the web app: out of the wallet first, then the bank (Mr Rayner's gifts stay free). A student must have signed in to Yum Donut once, so their account is linked, before they can give from Teams;
- writes to the existing Yum Donut Firestore users and transactions collections;
- stores Teams-only mapping, daily fallback, and idempotency metadata under `integrations/teams`.

## Teams Mapping

When users mention the bot, the function records seen Teams users in:

```text
artifacts/yum-donut-school/public/data/integrations/teams/pendingMappings/{mappingKey}
```

The teacher links them in the web app: Admin Settings → Teams lists the pending
Teams users and the existing links, and lets the teacher pick a roster name for
each person, or change or remove a link. The screen calls the teacher-only
`teamsManageLinks` callable (`functions/src/teamsLinkService.js`), which checks the
`yumpalsAdmin` claim, takes the Teams identity from the pending record rather than
the browser, accepts only active roster names, and asks for confirmation before a
second Teams record is linked to the same name. A changed link starts a fresh
document, so a `uid` or `isAdmin` from the previous name never carries over.

The bot keys a sender by their `aadObjectId` but a mentioned user by their Teams
chat `id`, so the same student can appear twice. Link both records to the same
name.

Confirmed mapping documents live in:

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

You can also calculate a mapping key locally:

```bash
node functions/scripts/mappingKey.js "<teams-user-id-or-aad-object-id>"
```

## Required Environment

Set these Firebase secrets before deploying:

```bash
firebase functions:secrets:set MICROSOFT_APP_ID --project yum-donut-school
firebase functions:secrets:set MICROSOFT_APP_PASSWORD --project yum-donut-school
```

`YUM_DONUT_TIME_ZONE` can be set as a normal environment variable if needed. It defaults to `Pacific/Auckland`.

The exported HTTPS function is `teamsBot`. The teacher's linking screen uses the
callable `teamsManageLinks`.
