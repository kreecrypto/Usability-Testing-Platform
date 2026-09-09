# GWD-03 — Figma Embed API Event Adapter

## V1 boundary

Canonical provider documentation: https://developers.figma.com/docs/embeds/embed-api/

Simplified V1 uses the public prototype embed. Live Embed API mode requires the deployment-controlled Figma OAuth app **client ID** plus an allowed embed origin. It does not require a Researcher OAuth login, access-token exchange, client secret in the browser, or Figma REST metadata.

The browser bridge must accept messages only from Figma's documented event origin `https://www.figma.com` and from the expected iframe window. Origin/source filtering is wired by Task 18; this task defines the provider payload normalization contract.

## Documented emitted events

| Figma event | V1 result | Canonical event / signal | Notes |
| --- | --- | --- | --- |
| `MOUSE_PRESS_OR_RELEASE` | tracking | `pointer_interaction` | Preserve `presentedNodeId`, `handled`, target node coordinates, nearest scrolling frame coordinates and offset. Do not synthesize `scroll`. |
| `PRESENTED_NODE_CHANGED` | tracking | `screen_view` | Preserve presented node, `isStoredInHistory`, `stateMappings`. Figma says this can be frame-to-frame or overlay-to-overlay; do not invent a separate overlay event. |
| `NEW_STATE` | tracking | `component_state_changed` | Preserve instance node, previous/current variant IDs, history flag and timed-change flag. |
| `INITIAL_LOAD` | operational | `initial_load` | Used by embed readiness/preflight, not a usability interaction. |
| `REQUEST_CLOSE` | operational | `request_close` | Runner UI signal, not a fabricated usability event. |
| `LOGIN_SCREEN_SHOWN` | operational | `login_screen_shown` | Technical access/preflight signal; never count as usability failure. |
| `PASSWORD_SCREEN_SHOWN` | operational | `password_screen_shown` | Technical access/preflight signal; never count as usability failure. |

No other provider event type is accepted by the adapter. Unknown/undocumented event types fail closed.

## Timestamp and identity boundary

Figma Embed API event payloads do not provide the UTP event envelope. Task 18 supplies the deterministic UTP envelope when the validated `postMessage` is received: `eventId`, `idempotencyKey`, `occurredAt`, `sequence`, session/participant/test/testVersion/task IDs and current/previous screen context.

The adapter sets `source = prototype_adapter` and emits schema version 2 canonical raw events only for provider events that have a defined mapping above.

## Coordinate boundary

GWD-03 preserves Figma's provider-native pointer fields exactly as structured metadata. It does not fabricate normalized heatmap coordinates because the Embed API event does not include target/frame dimensions. GWD-05 owns deterministic normalization when sufficient pinned geometry exists.

A scrolling-frame offset attached to `MOUSE_PRESS_OR_RELEASE` is context for that pointer event. It is not evidence that a standalone scroll action occurred, so Figma V1 does not emit canonical `scroll` from this payload.
