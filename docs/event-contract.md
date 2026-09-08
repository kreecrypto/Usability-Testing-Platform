# Event Tracking Contract

## Contract status

**Canonical contract: v2**

This document is the single engineering contract between Participant Runner, prototype adapters, Event Collector, rule engine and Analytics.

The contract intentionally separates **raw canonical events** from **derived events** so analytics can always be recomputed from immutable primary evidence.

## Core invariants

Events must be:

- attributable to an exact session and published test version
- idempotent
- versioned
- ordered deterministically
- immutable after acceptance
- reproducible for analytics

`time_on_task` and `time_on_screen` are **metrics, not events**.

## Timestamp semantics

Every primary event carries:

- `occurredAt` — when the interaction/lifecycle transition happened at the source, RFC 3339 UTC
- `sequence` — monotonically increasing integer within a session for raw canonical events

After ingestion the collector adds:

- `receivedAt` — server-side timestamp when the event was accepted

Ordering rule for raw events:

1. `sequence`
2. `occurredAt`
3. `receivedAt` only as a diagnostic tiebreaker

Participant input must never be trusted to set `receivedAt`.

## Raw canonical events

Raw means the first normalized, immutable evidence accepted by our platform. Provider-native events may be adapted into these names before persistence.

### Session lifecycle

```text
session_started
session_completed
session_abandoned
session_technical_blocked
```

### Task lifecycle / explicit terminal actions

```text
task_started
task_give_up
task_timeout
task_abandoned
task_technical_blocked
```

### Prototype / interaction evidence

```text
screen_view
pointer_interaction
scroll
```

`scroll` is emitted only when the active prototype provider can supply trustworthy canonical scroll evidence. Provider capability is defined separately in the capability matrix.

### Question evidence

```text
question_viewed
question_answered
```

## Derived events

Derived events are produced after raw ingestion and must never replace or mutate raw evidence.

```text
task_success
task_failed
misclick
rage_click
backtrack
```

Every derived event must include:

- `derivedFromEventIds`
- `ruleVersion`
- `source = rules_engine | analytics`

### Success classification

`task_success` carries one of:

```text
success_direct
success_indirect
```

Direct vs indirect success is determined by a versioned task-success rule, not by a separate client event name.

## Terminal task outcomes

A started task has at most one canonical terminal outcome:

```text
success_direct
success_indirect
failed
give_up
timeout
abandoned
technical_blocked
```

Mapping:

| Outcome | Canonical evidence |
| --- | --- |
| `success_direct` | derived `task_success` |
| `success_indirect` | derived `task_success` |
| `failed` | derived `task_failed` |
| `give_up` | raw `task_give_up` |
| `timeout` | raw `task_timeout` |
| `abandoned` | raw `task_abandoned` |
| `technical_blocked` | raw `task_technical_blocked` |

`technical_blocked` is an operational outcome, not a usability failure. It is excluded from usability-rate denominators.

Once a canonical terminal outcome is assigned, duplicate or later terminal signals must not change it unless an explicit correction workflow is implemented.

## Required raw envelope

```ts
interface RawTrackingEvent {
  schemaVersion: 2;
  eventId: string;
  idempotencyKey: string;
  eventLayer: "raw";
  source: "runner" | "prototype_adapter" | "system";
  eventType: RawEventType;
  occurredAt: string;
  sequence: number;
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  taskId?: string;
  screenId?: string;
  metadata?: Record<string, unknown>;
}
```

The persisted accepted record additionally contains collector-assigned `receivedAt`.

## Pointer / coordinate contract

`pointer_interaction` is the provider-neutral interaction event used as the primary input for heatmaps and misclick analysis.

At minimum, usable coordinate evidence should support normalized coordinates:

```ts
interface PointMetadata {
  x: number;
  y: number;
  normalizedX: number; // 0..1
  normalizedY: number; // 0..1
  viewportWidth: number;
  viewportHeight: number;
  frameWidth?: number;
  frameHeight?: number;
  elementId?: string;
  elementName?: string;
}
```

Provider-specific fields such as Figma handled state, target node, scrolling frame and offset belong in adapter metadata and are finalized by GWD-03/GWD-05.

Do not derive heatmaps from raw browser CSS pixels alone.

## Screen / path contract

`screen_view` is the provider-neutral canonical screen/frame transition event.

It should carry enough metadata to preserve:

```text
previousScreenId
currentScreenId
navigationSource
```

Backtracking is derived from the ordered `screen_view` sequence. `back` / `forward` are therefore not required as universal canonical raw event types.

## Time metrics

There are no `time_on_task` or `time_on_screen` events.

### Task duration

```text
first canonical task terminal occurredAt - task_started.occurredAt
```

### Screen duration

```text
next screen_view.occurredAt - current screen_view.occurredAt
```

For the final screen, use the first relevant task/session terminal timestamp.

Idle-adjusted time, if introduced, must be a separately versioned derived metric and cannot mutate raw timestamps.

## Retry and idempotency

Each raw event needs stable `eventId` and `idempotencyKey` values. Retrying a batch must not create another accepted primary event or increment analytics twice.

The database must enforce uniqueness for the canonical event identity in addition to collector-side checks.

## Privacy

Never place free-form PII in event metadata unless a future feature explicitly requires and documents it.
