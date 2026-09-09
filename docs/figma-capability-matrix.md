# GWD-04 — Figma V1 Capability Matrix

Canonical provider source: https://developers.figma.com/docs/embeds/embed-api/

This matrix is the release gate for what Builder and Results may claim for the simplified public-prototype V1. A metric is displayable only when the provider emits sufficient evidence and any required deterministic transform has passed.

| Evidence / metric | V1 status | Provider basis | Product rule |
| --- | --- | --- | --- |
| Pointer interactions | Supported | `MOUSE_PRESS_OR_RELEASE` | Preserve provider target/scroller coordinates and handled state. |
| Screen/path transitions | Supported | `PRESENTED_NODE_CHANGED` | Treat presented node as canonical `screen_view`; it can be frame or topmost overlay. |
| Component-state changes | Supported | `NEW_STATE` | Canonical `component_state_changed`. |
| Technical login/password block | Supported operationally | `LOGIN_SCREEN_SHOWN`, `PASSWORD_SCREEN_SHOWN` | Classify as technical access evidence, not usability failure. |
| Backtrack | Supported as derived metric | ordered `screen_view` | Derive from path; never claim a raw Figma `back` event. |
| Standalone scroll count | **Unsupported** | no emitted scroll event | A scroll offset inside a pointer payload is context only; Builder/Results must not show scroll count. |
| Raw back count | **Unsupported** | `NAVIGATE_BACKWARD` is a control message, not emitted evidence | Do not show. |
| Raw forward count | **Unsupported** | `NAVIGATE_FORWARD` is a control message, not emitted evidence | Do not show. |
| Heatmap | Conditional | pointer payload + GWD-05 transform | Hidden until canonical normalized frame coordinates pass GWD-05. |

## UI/analytics gate

Code must use `src/lib/figma/capabilities.ts` (or an equivalent consumer of that contract) rather than assuming a metric is supported from its label alone.

Default displayable Figma V1 metrics before GWD-05:

```text
pointer_interactions
screen_path
component_state_changes
backtrack
```

After GWD-05 proves canonical coordinate normalization, `heatmap` may be added.

These remain hidden in V1 unless the provider capability changes and the source/adapter/tests are updated together:

```text
scroll_count
raw_back_count
raw_forward_count
```

## No-guess rule

A provider control message is not evidence that the participant generated the same semantic event. New Figma events or metrics require an official provider source, adapter mapping, deterministic fixture, and release-gate QA before Builder/Results may expose them.
