# Task 15 V1 Simplification Decision

Date: 2026-09-09
Owner: AUTO-W1

## Decision

Task 15 V1 uses a public Figma prototype URL embed only.

Required for V1:
- HTTPS public Figma `/proto/...` URL
- URL validation and normalization to `embed.figma.com`
- preservation of supplied node/start-point query parameters
- deployed iframe preview

Deferred beyond Task 15 V1:
- Researcher OAuth login
- client secret
- OAuth authorization code/token exchange
- persistent Figma access/refresh tokens
- Figma REST metadata/version resolution
- private/org/password/login-required prototype support

Live Figma Embed API event mode is handled separately by GWD-03/GWD-10 and may require a Figma app client ID plus an allowed embed origin. That does not make Researcher OAuth authorization a Task 15 requirement.
