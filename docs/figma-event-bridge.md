# Task 18 — Figma Interaction Event Bridge

Canonical provider source: https://developers.figma.com/docs/embeds/embed-api/

## Trust boundary

The browser bridge accepts a provider message only when both conditions pass:

1. `event.origin === "https://www.figma.com"` (the origin documented by Figma for emitted Embed API events), and
2. `event.source` is the exact `contentWindow` of the expected prototype iframe.

Origin-only filtering is insufficient because another Figma iframe on the same page could otherwise inject events into the wrong participant session.

## Internal envelope

Figma payloads do not contain the UTP event identity/session envelope. After origin/source validation, the bridge adds:

```text
eventId
idempotencyKey = {sessionId}:figma:{sequence}
occurredAt = bridge receive time
sequence = monotonic per session bridge
sessionId
participantId
testId
testVersionId
taskId
current/previous presented node context
```

The provider payload is then passed to GWD-03. Only its supported mappings may enter the canonical raw-event stream.

## Operational signals

`INITIAL_LOAD`, `REQUEST_CLOSE`, `LOGIN_SCREEN_SHOWN`, and `PASSWORD_SCREEN_SHOWN` are routed to the operational callback. They do not consume the canonical usability-event sequence and are not fabricated as pointer/navigation evidence.

Login/password signals remain technical-access evidence and must not be counted as usability failure.

## Failure behavior

- unexpected origin → ignore
- unexpected iframe source → ignore
- undocumented provider event → ignore/fail closed
- documented event with malformed payload → reject without emitting or consuming sequence
- downstream event sink failure → propagate the failure and do not advance sequence/screen state

This makes a retry retain the same sequence/idempotency slot rather than silently losing an event.

## Integration boundary

The bridge emits canonical `RawTrackingEvent` objects to a caller-provided sink. Task 22/GWD-06/GWD-07 own the authenticated collector, session-bound ingestion token, retry/dedupe and persistence layers. Participant Runner wiring is handled by the later Runner tasks.
