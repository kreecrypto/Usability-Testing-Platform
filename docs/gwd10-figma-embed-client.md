# GWD-10 — Figma Embed API Client ID & Origin

## V1 boundary

The simplified V1 public-prototype embed does not require a Figma OAuth login, client secret, access token, refresh token, or Figma REST metadata.

Live Figma Embed API messages/events are a separate capability. Figma requires:

1. a Figma OAuth app,
2. that app's client ID,
3. the UT Platform site origin registered as an allowed Embed API origin, and
4. `client-id=<app client id>` on the prototype iframe URL.

The client ID is public configuration. The client secret is not needed for the Embed API event channel.

## UT Platform configuration

Set the deployment environment variable:

```text
FIGMA_EMBED_CLIENT_ID=<Figma OAuth app client id>
```

The server page passes this configured public ID to the prototype URL builder. The builder removes any `client-id` supplied in a pasted researcher URL and only inserts the deployment-controlled value.

When `FIGMA_EMBED_CLIENT_ID` is absent, public prototype preview continues to work, but live Embed API event mode is explicitly reported as not configured.

## External account gate

The Figma account owner must create/select the OAuth app and register the deployed UT Platform origin in the app's **Embed API** allowed origins. This is an account-level setting and cannot be proven by repository code alone.

Production origin currently used by UTP:

```text
https://usability-testing-platform.vercel.app
```

Preview origins should only be registered when intentionally required for live event QA; do not use wildcard or guessed origins.

## Security / trust boundary

- Never trust a `client-id` pasted in a prototype URL.
- Never expose or require `FIGMA_CLIENT_SECRET` for the simplified V1 Embed API event path.
- The participant session must not call Figma REST.
- Window message handling must accept Figma Embed API events only from Figma's documented origin and only after the app client ID/origin relationship is configured.

## Completion evidence

Code-side readiness is proven by unit/build tests covering trusted client-ID pinning and basic embed fallback. GWD-10 is only COMPLETE after account-level evidence confirms the Figma app client ID and allowed UT Platform origin are configured and a deployed iframe contains that configured client ID.

Official source: https://developers.figma.com/docs/embeds/embed-api/
