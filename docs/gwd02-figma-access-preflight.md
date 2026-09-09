# GWD-02 — Public Figma participant-access preflight

## V1 boundary

GWD-02 verifies that the participant can load the imported **public Figma prototype** before the prototype is allowed to proceed to publish.

The simplified V1 path does not require Researcher OAuth authorization, a Figma client secret, OAuth token exchange, Figma access/refresh tokens, or participant Figma REST requests.

Figma's Embed API does require a non-secret OAuth app **client ID** plus an allowed embed origin when UT Platform needs to receive prototype events. The client ID is supplied to the iframe as `client-id`; the corresponding allowed-origin registration is provider configuration owned by the Embed API setup task.

## Provider evidence used by the gate

UT Platform trusts access signals only when the browser message:

- comes from the exact Figma prototype event origin `https://www.figma.com`;
- comes from the currently rendered prototype iframe; and
- has one of the documented event types below.

| Figma event | GWD-02 result | Publish | Usability classification |
| --- | --- | --- | --- |
| `INITIAL_LOAD` | Public participant access confirmed | Allowed | Eligible |
| `LOGIN_SCREEN_SHOWN` | Login/private access required | Blocked | `technical_blocked` |
| `PASSWORD_SCREEN_SHOWN` | Password required | Blocked | `technical_blocked` |
| No conclusive access event before timeout | Access not proven | Blocked | `technical_blocked` |
| Embed API client ID unavailable | Access cannot be proven | Blocked | `technical_blocked` |

A technical/access block is never converted into `task_failed`, and it must not be counted in a usability-failure denominator.

## Fail-closed publish rule

URL syntax validation or a visible iframe alone is not sufficient evidence that an anonymous participant can use the prototype. `publishAllowed` becomes true only after the documented `INITIAL_LOAD` signal is received from the expected iframe and origin.

If the client ID/allowed origin is not configured, the Task 15 public preview can still render, but GWD-02 remains publish-blocked because access has not been proven through the provider event channel.

## Browser/network edge cases

Browser embed-content restrictions, Storage Access API restrictions, network failures, provider load failures, and timeouts are access/technical conditions. V1 must fail closed rather than misclassifying them as participant usability failures.

## Implementation

- `src/lib/figma/access-preflight.ts` — pure access state machine, provider-event validation, client-id URL helper.
- `src/app/figma-poc/PublicFigmaEmbedProof.tsx` — iframe-source/origin verification, timeout, and publish gate UI.
- `src/app/figma-poc/page.tsx` — passes optional `FIGMA_EMBED_CLIENT_ID` to the client proof without exposing a secret.
- `tests/gwd02-figma-access-preflight.test.ts` — regression coverage for public, login, password, timeout, missing-config, and untrusted-message states.

## Source

- Figma Developer Docs — Embed API
- Figma Developer Docs — Security and access
- Figma Developer Docs — Embed a Figma prototype
- Figma Developer Docs — Troubleshooting
