# Teams App Manifest

This folder is a template for the Microsoft Teams app package.

After the Microsoft bot registration exists and the Firebase function is deployed:

1. Replace `${MICROSOFT_APP_ID}` in `manifest.template.json` with the Microsoft bot app/client ID.
2. Replace `${FUNCTION_HOSTNAME}` with the deployed Firebase Functions hostname, for example:

   ```text
   us-central1-yum-donut-school.cloudfunctions.net
   ```

3. Add Teams-compatible `color.png` and `outline.png` icons.
4. Zip the manifest and icons, then upload the package to Teams for the pilot class Team.

The bot endpoint for the Microsoft Bot Framework messaging endpoint should be:

```text
https://us-central1-yum-donut-school.cloudfunctions.net/teamsBot
```
