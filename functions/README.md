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

The teacher links people in the web app: Admin Settings → Teams. Each time the bot
gets a message or event in the Team it saves the Team's details in
`integrations/teams` (`teamReference`, `functions/src/teamsRoster.js`). The screen's
teacher-only `teamsManageLinks` callable (`functions/src/teamsLinkService.js`) then
reads the Team's current members through the bot. It needs the bot's Microsoft
secrets for this. Every member is listed once with their real name and email.
Bot records for anyone not in the Team (people who left, test accounts) are shown
apart, with Remove.

The callable checks the `yumpalsAdmin` claim and accepts only active roster names.
It takes Teams identities from Teams (or, before the Team is known, from the bot's
pending record), never from the browser. It asks for confirmation before two
people share a name. The bot looks up a giver by their `aadObjectId` but a mentioned
person by their Teams `id`, so linking a member writes a mapping under both keys.
A changed link starts a fresh document, so a `uid` or `isAdmin` from the previous
name never carries over.

The saved Team details sit in publicly writable data, so they are checked before
each use. The service address must be a Microsoft Teams host, and the tenant must
match `MICROSOFT_APP_TENANT_ID`, so the bot's token is never sent anywhere else.

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
callable `teamsManageLinks`, which also uses the three `MICROSOFT_APP_*` secrets.
