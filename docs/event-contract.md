# Event Tracking Contract

## Goals

The event contract is the canonical interface between Participant Runner, Event Collector and Analytics.

Events must be:

- ordered by client timestamp and ingest timestamp
- idempotent
- versioned
- attributable to a session and test version
- reproducible for analytics

## Required envelope

```ts
interface TrackingEvent {
  schemaVersion: 1;
  eventId: string;
  idempotencyKey: string;
  eventType: EventType;
  timestamp: string;
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  taskId?: string;
  screenId?: string;
  sequence: number;
  metadata?: Record<string, unknown>;
}
```

## Lifecycle events

```text
session_started
session_completed
session_abandoned

task_started
task_success
task_failed
task_give_up
task_timeout
task_abandoned
```

## Navigation events

```text
screen_view
frame_change
back
forward
```

## Interaction events

```text
click
tap
misclick
rage_click
scroll
```

## Question events

```text
question_viewed
question_answered
```

## Coordinate contract

Click/tap events should store normalized coordinates so heatmaps remain valid across viewport sizes.

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

Do not derive heatmaps from raw CSS pixels alone.

## Navigation contract

Frame/screen transitions should carry:

```text
previousScreenId
currentScreenId
navigationSource
```

This is used to reconstruct actual paths and detect detours/backtracking.

## Terminal task rules

A task has exactly one canonical terminal outcome per session:

```text
success_direct
success_indirect
failed
give_up
timeout
abandoned
```

Later duplicated terminal events must not change the canonical result unless an explicit correction workflow is implemented.

## Derived events

`misclick`, `rage_click` and `backtrack` may be derived after ingestion.

Keep raw interaction events immutable. Derived events must record the rule version that produced them.

## Retry and idempotency

Participant Runner should buffer events and upload batches.

Each event needs a stable `eventId` / `idempotencyKey`. Retrying a batch must not increment analytics twice.

## Privacy

Never place free-form PII in event metadata unless a future feature explicitly requires and documents it.
