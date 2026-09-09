# Task 15 — Public Figma Prototype Embed PoC (Simplified V1)

## Goal

Prove the smallest Figma integration needed to keep the V1 product loop moving:

1. Researcher pastes a **public Figma prototype URL**.
2. UT Platform validates that the URL is HTTPS, belongs to Figma, and is a `/proto/...` link.
3. UT Platform normalizes the link to `https://embed.figma.com/proto/...`.
4. Existing query parameters are preserved, including `node-id` and `starting-point-node-id` when the source URL provides them.
5. The prototype renders inside the UT Platform development/production domain.

This simplified V1 path intentionally does **not** require Researcher OAuth login, a Figma client secret, OAuth token exchange, or Figma REST metadata.

## Route

- `/figma-poc` — paste, validate, and preview a public Figma prototype.
- `/figma-poc?url=<encoded-public-prototype-url>` — deterministic QA entry that preloads the same public URL contract.

Legacy OAuth proof routes may remain in the repository for future work, but Task 15 V1 does not call or depend on them.

## Public embed contract

Accepted input:

- HTTPS only.
- Host must be `figma.com`, `www.figma.com`, or `embed.figma.com`.
- Path must be a Figma prototype path: `/proto/<file-key>/...`.

Normalization:

- Host becomes `embed.figma.com`.
- Existing prototype query parameters are preserved.
- `embed-host` is overwritten with the UT Platform embed identifier.
- No `client-id` or `version-id` is required to pass Task 15.

Private, organization-only, password-protected, or login-required prototypes are not supported by this simplified path. GWD-02 must classify those access states as unsupported/technical blocked rather than usability failure.

## V1 security boundary

Task 15 has no secret-bearing Figma configuration:

- no `FIGMA_CLIENT_SECRET`
- no authorization code exchange
- no Figma access/refresh token
- no participant Figma REST request
- no browser token storage

The URL parser fails closed for non-Figma hosts, HTTP URLs, design/file URLs, missing prototype file keys, and malformed URLs.

## Versioning boundary

Simplified V1 uses the UT Platform's immutable `test_version` as the release snapshot. The published snapshot stores the exact imported public prototype URL plus its node/start-point configuration. Editing a published test creates a new draft/version; historical sessions resolve the exact stored snapshot.

The stronger GWD-01 Figma REST version-pin implementation remains available in the codebase but is **not a prerequisite** for the simplified public-embed V1 path. Figma REST `version-id` can be reintroduced later if private/API-backed integration becomes a product requirement.

## Future live Embed API events

GWD-03/GWD-10 own the event-capability path. If live Figma Embed API events are enabled, configure only the minimum provider requirement for that mode: a Figma app **client ID** and an allowed UT Platform embed origin. That setup does not make Researcher OAuth authorization/token exchange a V1 requirement.

Unsupported Figma events or metrics must never be invented. The capability matrix remains the authority for what raw evidence is actually emitted.

## Automated QA

`tests/figma-public-embed.test.ts` verifies:

- public prototype URL → `embed.figma.com` normalization;
- node/start-point and other query parameters are preserved;
- the UT Platform `embed-host` is pinned;
- no OAuth client ID or Figma version ID is required;
- non-prototype, non-Figma, and non-HTTPS URLs are rejected.

CI workflow:

```text
.github/workflows/task15-figma-oauth-poc.yml
```

The workflow filename is retained to avoid unnecessary repository churn, but the workflow now gates the public-embed contract.

## Task 15 completion gate

Task 15 is COMPLETE only when:

1. public prototype URL validation/normalization tests pass;
2. the app builds successfully;
3. `/figma-poc` renders the public-embed proof UI on a deployed domain;
4. a real public prototype QA fixture renders through the URL contract with its supplied node/start point;
5. no Figma OAuth secret/token is required by the Task 15 path.

OAuth/private-file integration is deferred and must not block the simplified V1 release path.
