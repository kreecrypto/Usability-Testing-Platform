import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateAnalytics,
  ANALYTICS_AGGREGATION_VERSION,
} from "../src/lib/analytics/aggregation.ts";
import type {
  AcceptedTrackingEvent,
  DerivedTrackingEvent,
  RawTrackingEvent,
} from "../src/lib/tracking/events.ts";

type AcceptedRawEvent = AcceptedTrackingEvent<RawTrackingEvent>;
type AcceptedDerivedEvent = AcceptedTrackingEvent<DerivedTrackingEvent>;

const baseContext = {
  participantId: "participant-1",
  testId: "test-1",
  testVersionId: "test-version-1",
};

function raw(
  eventId: string,
  sessionId: string,
  sequence: number,
  eventType: RawTrackingEvent["eventType"],
  occurredAt: string,
  options: {
    taskId?: string;
    source?: RawTrackingEvent["source"];
    metadata?: Record<string, unknown>;
  } = {},
): AcceptedRawEvent {
  return {
    schemaVersion: 2,
    eventId,
    idempotencyKey: `idem:${eventId}`,
    eventLayer: "raw",
    source: options.source ?? "runner",
    eventType,
    occurredAt,
    receivedAt: occurredAt,
    sequence,
    sessionId,
    ...baseContext,
    ...(options.taskId ? { taskId: options.taskId } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

function derived(
  eventId: string,
  sessionId: string,
  eventType: DerivedTrackingEvent["eventType"],
  occurredAt: string,
  taskId: string,
  derivedFromEventIds: string[],
  ruleVersion: string,
  metadata?: Record<string, unknown>,
): AcceptedDerivedEvent {
  return {
    schemaVersion: 2,
    eventId,
    idempotencyKey: `idem:${eventId}`,
    eventLayer: "derived",
    source: eventType === "task_success" || eventType === "task_failed"
      ? "rules_engine"
      : "analytics",
    eventType,
    occurredAt,
    receivedAt: occurredAt,
    sessionId,
    ...baseContext,
    taskId,
    derivedFromEventIds,
    ruleVersion,
    ...(metadata ? { metadata } : {}),
  };
}

function fixture(): AcceptedTrackingEvent[] {
  return [
    raw("s1-session-start", "s1", 0, "session_started", "2026-09-09T00:00:00.000Z"),
    raw("s1-task-start", "s1", 1, "task_started", "2026-09-09T00:00:01.000Z", { taskId: "task-1" }),
    raw("s1-pointer-1", "s1", 2, "pointer_interaction", "2026-09-09T00:00:03.000Z", {
      taskId: "task-1",
      source: "prototype_adapter",
      metadata: { providerVersion: "fixture-provider-v1", normalizedX: 0.2, normalizedY: 0.3 },
    }),
    raw("s1-pointer-2", "s1", 3, "pointer_interaction", "2026-09-09T00:00:04.000Z", {
      taskId: "task-1",
      source: "prototype_adapter",
      metadata: { providerVersion: "fixture-provider-v1", normalizedX: 0.4, normalizedY: 0.5 },
    }),
    raw("s1-success-evidence", "s1", 4, "screen_view", "2026-09-09T00:00:11.000Z", {
      taskId: "task-1",
      source: "prototype_adapter",
      metadata: { providerVersion: "fixture-provider-v1", currentScreenId: "success" },
    }),
    derived(
      "s1-success",
      "s1",
      "task_success",
      "2026-09-09T00:00:11.000Z",
      "task-1",
      ["s1-success-evidence"],
      "success-rule-v1",
      { outcome: "success_direct" },
    ),
    derived(
      "s1-misclick",
      "s1",
      "misclick",
      "2026-09-09T00:00:03.000Z",
      "task-1",
      ["s1-pointer-1"],
      "misclick-rule-v1",
    ),
    raw("s1-session-complete", "s1", 5, "session_completed", "2026-09-09T00:00:12.000Z"),

    raw("s2-session-start", "s2", 0, "session_started", "2026-09-09T00:01:00.000Z"),
    raw("s2-task-start", "s2", 1, "task_started", "2026-09-09T00:01:01.000Z", { taskId: "task-1" }),
    raw("s2-pointer", "s2", 2, "pointer_interaction", "2026-09-09T00:01:02.000Z", {
      taskId: "task-1",
      source: "prototype_adapter",
      metadata: { providerVersion: "fixture-provider-v1" },
    }),
    raw("s2-tech", "s2", 3, "task_technical_blocked", "2026-09-09T00:01:03.000Z", { taskId: "task-1" }),
    raw("s2-session-tech", "s2", 4, "session_technical_blocked", "2026-09-09T00:01:04.000Z"),

    raw("s3-session-start", "s3", 0, "session_started", "2026-09-09T00:02:00.000Z"),
    raw("s3-task-start", "s3", 1, "task_started", "2026-09-09T00:02:01.000Z", { taskId: "task-1" }),
    raw("s3-pointer", "s3", 2, "pointer_interaction", "2026-09-09T00:02:02.000Z", {
      taskId: "task-1",
      source: "prototype_adapter",
      metadata: { providerVersion: "fixture-provider-v1" },
    }),
    raw("s3-give-up", "s3", 3, "task_give_up", "2026-09-09T00:02:05.000Z", { taskId: "task-1" }),
    raw("s3-session-complete", "s3", 4, "session_completed", "2026-09-09T00:02:06.000Z"),
  ];
}

test("Task 25 aggregates reproducible task/session metrics and excludes technical blocks", () => {
  const result = aggregateAnalytics(fixture());
  assert.equal(result.aggregationVersion, ANALYTICS_AGGREGATION_VERSION);
  assert.equal(result.taskMetrics.length, 1);
  assert.equal(result.sessions.length, 3);

  const task = result.taskMetrics[0];
  assert.equal(task.started, 3);
  assert.equal(task.eligible, 2);
  assert.equal(task.outcomes.success_direct, 1);
  assert.equal(task.outcomes.give_up, 1);
  assert.equal(task.outcomes.technical_blocked, 1);
  assert.equal(task.completionRate, 50);
  assert.equal(task.giveUpRate, 50);
  assert.equal(task.failureRate, 0);
  assert.deepEqual(task.successfulDuration, {
    sampleSize: 1,
    medianMs: 10000,
    p75Ms: 10000,
    p90Ms: 10000,
  });
  assert.equal(task.eligiblePointerInteractions, 3);
  assert.equal(task.misclicks, 1);
  assert.equal(task.misclickRate, (1 / 3) * 100);

  assert.deepEqual(task.trace.completion.ruleVersions, ["success-rule-v1"]);
  assert.deepEqual(task.trace.misclick.ruleVersions, ["misclick-rule-v1"]);
  assert.deepEqual(task.trace.cohort.schemaVersions, [2]);
  assert.deepEqual(task.trace.cohort.testVersionIds, ["test-version-1"]);
  assert.ok(
    task.trace.misclick.providerEvidence.some(
      (evidence) =>
        evidence.eventId === "s1-pointer-1" &&
        evidence.metadata.providerVersion === "fixture-provider-v1",
    ),
  );

  const blockedSession = result.sessions.find((session) => session.sessionId === "s2");
  assert.ok(blockedSession);
  assert.equal(blockedSession.terminal, "technical_blocked");
  assert.equal(blockedSession.eligibleTaskCount, 0);
  assert.equal(blockedSession.technicalBlockedTaskCount, 1);
});

test("duplicate delivery cannot double-count analytics", () => {
  const events = fixture();
  const duplicate = events.find((event) => event.eventId === "s1-pointer-1");
  assert.ok(duplicate);

  const baseline = aggregateAnalytics(events);
  const retried = aggregateAnalytics([...events, duplicate]);
  assert.deepEqual(retried, baseline);
});

test("first valid terminal evidence wins by canonical raw anchor order", () => {
  const events: AcceptedTrackingEvent[] = [
    raw("s4-start", "s4", 0, "session_started", "2026-09-09T00:03:00.000Z"),
    raw("s4-task-start", "s4", 1, "task_started", "2026-09-09T00:03:01.000Z", { taskId: "task-1" }),
    raw("s4-give-up", "s4", 3, "task_give_up", "2026-09-09T00:03:03.000Z", { taskId: "task-1" }),
    raw("s4-late-success-evidence", "s4", 4, "screen_view", "2026-09-09T00:03:04.000Z", { taskId: "task-1" }),
    derived(
      "s4-late-success",
      "s4",
      "task_success",
      "2026-09-09T00:03:04.000Z",
      "task-1",
      ["s4-late-success-evidence"],
      "success-rule-v1",
      { outcome: "success_direct" },
    ),
  ];

  const task = aggregateAnalytics(events).taskMetrics[0];
  assert.equal(task.outcomes.give_up, 1);
  assert.equal(task.outcomes.success_direct, 0);
  assert.equal(task.completionRate, 0);
  assert.equal(task.giveUpRate, 100);
});

test("derived metrics fail closed when provenance does not resolve to accepted raw evidence", () => {
  const events: AcceptedTrackingEvent[] = [
    raw("s5-start", "s5", 0, "session_started", "2026-09-09T00:04:00.000Z"),
    raw("s5-task-start", "s5", 1, "task_started", "2026-09-09T00:04:01.000Z", { taskId: "task-1" }),
    derived(
      "s5-success",
      "s5",
      "task_success",
      "2026-09-09T00:04:02.000Z",
      "task-1",
      ["missing-raw-event"],
      "success-rule-v1",
      { outcome: "success_direct" },
    ),
  ];

  assert.throws(
    () => aggregateAnalytics(events),
    /references missing evidence missing-raw-event/,
  );
});

test("No Data stays null when every started task is technical blocked", () => {
  const events: AcceptedTrackingEvent[] = [
    raw("s6-start", "s6", 0, "session_started", "2026-09-09T00:05:00.000Z"),
    raw("s6-task-start", "s6", 1, "task_started", "2026-09-09T00:05:01.000Z", { taskId: "task-1" }),
    raw("s6-tech", "s6", 2, "task_technical_blocked", "2026-09-09T00:05:02.000Z", { taskId: "task-1" }),
  ];

  const task = aggregateAnalytics(events).taskMetrics[0];
  assert.equal(task.eligible, 0);
  assert.equal(task.completionRate, null);
  assert.equal(task.failureRate, null);
  assert.equal(task.giveUpRate, null);
  assert.equal(task.misclickRate, null);
  assert.deepEqual(task.successfulDuration, {
    sampleSize: 0,
    medianMs: null,
    p75Ms: null,
    p90Ms: null,
  });
});
