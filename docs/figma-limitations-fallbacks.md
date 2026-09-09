# Task 19 — Figma V1 limitations and fallback rules

## Source boundary

This document applies to the simplified V1 public-prototype architecture.

Canonical provider source:

- https://developers.figma.com/docs/embeds/embed-figma-prototype/
- https://developers.figma.com/docs/embeds/embed-api/

Executable product capability source:

- `src/lib/figma/capabilities.ts` (GWD-04)
- `src/lib/figma/limitations.ts` (Task 19)

Do not add a Figma capability to Builder, Participant Runner, or Results unless the provider emits evidence for it or the platform has a documented deterministic derivation.

## Builder

V1 accepts public Figma prototype URLs. Private, organization-restricted, login-required, and password-protected access is unsupported.

Fallback rules:

1. Block publish when participant access cannot be proven.
2. Ask the researcher to provide a participant-accessible public prototype.
3. Do not start Researcher OAuth or token exchange in simplified V1.
4. Live Embed API event mode remains blocked until a Figma app client ID and allowed UTP origin are configured and verified.
5. Do not promise scroll/raw-back/raw-forward tracking because those emitted user-action events do not exist in the V1 provider capability matrix.

## Participant Runner

`LOGIN_SCREEN_SHOWN` and `PASSWORD_SCREEN_SHOWN` are operational access evidence.

Fallback rules:

1. Stop the affected participant flow with an explicit `technical_blocked` state.
2. Do not count the condition as a usability failure.
3. Do not ask the participant to authorize Figma OAuth.
4. Ignore unsupported/malformed provider messages rather than synthesizing canonical raw events.
5. Preserve source-backed pointer, screen, and component-state evidence only.

## Results

Results must be capability-gated.

Displayable under current V1 evidence:

- pointer interactions
- screen/path evidence
- component-state changes
- backtrack derived from ordered `screen_view`
- heatmap only when GWD-05 canonical coordinate transform evidence is present

Not displayable as raw/provider metrics:

- standalone scroll count
- raw back count
- raw forward count

Fallback rules:

1. Hide unsupported metrics instead of rendering `0` or placeholder values.
2. Keep No Data distinct from zero.
3. If a user asks for an unsupported capability, show the capability reason rather than an inferred result.
4. Never derive a heatmap from browser CSS pixels alone.
5. Keep derived backtrack traceable to ordered canonical `screen_view` evidence.

## Review surface

`/high-fi/figma-limitations` renders the Builder / Participant Runner / Results limitation contract from the same executable source used by tests. It is a review artifact and does not claim that downstream production Builder/Runner/Results tasks are complete.

## QA

`tests/task19-figma-limitations.test.ts` verifies:

- Builder access and live-event configuration blockers;
- Runner technical-block classification;
- unsupported event synthesis is forbidden;
- Results hides scroll/raw-back/raw-forward;
- heatmap fails closed without canonical coordinates;
- every required surface has explicit fallback copy.
