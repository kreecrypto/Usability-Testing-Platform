# GWD-10 — Figma Embed API Client ID & Origin

## V1 boundary

Basic public prototype embed does not require a Figma OAuth login, client secret, access token, refresh token, or Figma REST metadata.

Live Figma Embed API messages/events are a separate capability. Per Figma's Embed API documentation, it requires:

1. a Figma OAuth app,
2. that app's client ID,
3. the UT Platform site origin registered as an allowed Embed API origin, and
4. `client-id=<app client id>` on the embedded prototype URL.

The client ID is public configuration. The client secret is not needed for this Embed API event channel.

## UT Platform configuration

Set:

```text
FIGMA_EMBED_CLIENT_ID=<Figma OAuth app client id>
```

GWD-02 already reads this value server-side, attaches it to the normalized Figma embed URL for access preflight, verifies messages come from Figma's documented origin, and blocks publish when Embed API configuration is absent.

GWD-10 adds a trust boundary before that step: any `client-id` pasted in a researcher prototype URL is stripped. The only client ID used by the access/event path is the deployment-controlled value.

When `FIGMA_EMBED_CLIENT_ID` is absent, basic public prototype preview remains available, while pre-publish live access/event proof remains technical-blocked.

## External account gate

The Figma account owner must create/select the OAuth app and add the deployed UT Platform origin under the app's **Embed API** allowed origins.

Current production origin:

```text
https://usability-testing-platform.vercel.app
```

Do not add wildcard or guessed preview origins. Add a preview origin only when live event QA explicitly requires that exact origin.

## Security boundary

- Never trust `client-id` from a pasted prototype URL.
- Never require or expose `FIGMA_CLIENT_SECRET` for simplified V1 Embed API events.
- Participant sessions do not call Figma REST.
- Accept Embed API messages only from Figma's documented event origin.

## Completion evidence

Repository readiness: tests/build prove untrusted client IDs are stripped, GWD-02 adds only the configured ID, and public embed fallback still works.

Account-level completion additionally requires evidence that the Figma app has the UTP allowed origin and that the deployed iframe uses that app's client ID.

Official source: https://developers.figma.com/docs/embeds/embed-api/
