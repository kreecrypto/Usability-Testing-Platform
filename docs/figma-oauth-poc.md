# Task 15 — Figma OAuth + Prototype Embed PoC

## Goal

Prove the minimum Figma integration required by Task 15:

1. Start a Figma OAuth authorization flow from the UT Platform.
2. Validate OAuth `state` on callback.
3. Exchange the authorization code server-side and verify the grant against `GET /v1/me`.
4. Embed a prototype on the development deployment using an explicit file key, immutable Figma version ID, and start node ID.

Task 15 is a proof, not the final production integration.

## Routes

- `/figma-poc` — readiness and live proof page.
- `/api/integrations/figma/authorize` — creates a cryptographically random state cookie and redirects to Figma OAuth.
- `/api/integrations/figma/callback` — validates state, exchanges the code, verifies the token, then discards the token.

## Environment contract

```text
FIGMA_CLIENT_ID=
FIGMA_CLIENT_SECRET=
FIGMA_REDIRECT_URI=http://localhost:3000/api/integrations/figma/callback
FIGMA_POC_FILE_KEY=
FIGMA_POC_VERSION_ID=
FIGMA_POC_START_NODE_ID=
```

For a deployed proof, `FIGMA_REDIRECT_URI` must exactly match the callback URI registered in the Figma OAuth app. For the current production/dev proof surface that route is:

```text
https://usability-testing-platform.vercel.app/api/integrations/figma/callback
```

Do not commit client secrets to Git.

## OAuth contract

Authorization starts at `https://www.figma.com/oauth` with:

- `client_id`
- `redirect_uri`
- `scope=current_user:read,file_content:read`
- `state`
- `response_type=code`

The callback exchanges the code at `POST https://api.figma.com/v1/oauth/token` using HTTP Basic authentication and `application/x-www-form-urlencoded`.

The proof verifies the access token against `GET https://api.figma.com/v1/me` and does not persist the access token or refresh token. Persistent encrypted token storage belongs to the production integration, not this proof.

## Embed contract

The PoC iframe is produced through the GWD-01 pinned-version helper and carries:

- `client-id`
- `embed-host=ut-platform-task15`
- `version-id=<FIGMA_POC_VERSION_ID>`
- `node-id=<FIGMA_POC_START_NODE_ID>`
- `starting-point-node-id=<FIGMA_POC_START_NODE_ID>`

A live proof is not accepted when those values are missing. The page must display configuration as `Ready` and render the actual prototype start point.

## Security properties

- OAuth state is generated with 32 random bytes.
- State is stored in an HttpOnly, SameSite=Lax, short-lived cookie.
- Callback state comparison uses a constant-time comparison when lengths match.
- `FIGMA_CLIENT_SECRET` is consumed only by the server route.
- OAuth tokens are not written to client storage, logs, Git, or browser-readable cookies by this PoC.
- Published prototype version semantics reuse GWD-01 instead of reading Figma `latest` again.

## Automated QA

`tests/figma-oauth.test.ts` verifies:

- OAuth authorization URL parameters and least-privilege PoC scopes.
- OAuth state match/mismatch handling.
- Token exchange method, Basic authentication and form body.
- `/v1/me` Bearer verification.
- Pinned prototype URL contains the exact version and start node.

CI workflow:

```text
.github/workflows/task15-figma-oauth-poc.yml
```

## Boundaries

Task 15 intentionally does not implement:

- Task 16 Figma URL parsing.
- GWD-02 participant sharing/access preflight.
- GWD-03 provider event adaptation.
- Persistent OAuth token storage/refresh lifecycle.
- Workspace-level Figma account management.

## Remaining live acceptance gate

Code/build/contract QA can pass without external credentials, but Task 15 must remain IN PROGRESS until all of the following are evidenced on the deployed domain:

1. A Figma OAuth app exists with the deployed callback URI.
2. `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, and `FIGMA_REDIRECT_URI` are configured in Vercel.
3. A real prototype fixture supplies `FIGMA_POC_FILE_KEY`, immutable `FIGMA_POC_VERSION_ID`, and `FIGMA_POC_START_NODE_ID`.
4. `/figma-poc` reports OAuth `Verified` after authorization.
5. The embedded prototype opens at the configured start point on the deployed domain.

Until those five checks pass, the external integration proof is not COMPLETE.
