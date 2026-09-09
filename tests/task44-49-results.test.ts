import assert from "node:assert/strict";
import test from "node:test";

import { buildResultsModel } from "../src/lib/analytics/results.ts";
import type { AcceptedTrackingEvent, DerivedTrackingEvent, RawTrackingEvent } from "../src/lib/tracking/events.ts";

type Raw = AcceptedTrackingEvent<RawTrackingEvent>;
type Derived = AcceptedTrackingEvent<DerivedTrackingEvent>;

const context = { participantId: "p1", testId: "test-1", testVersionId: "version-1" };

function raw(id: string, sessionId: string, sequence: number, eventType: RawTrackingEvent["eventType"], at: string, options: { taskId?: string; screenId?: string; participantId?: string; metadata?: Record<string, unknown> } = {}): Raw {
  return {
    schemaVersion: 2,
    eventId: id,
    idempotencyKey: `idem:${id}`,
    eventLayer: "raw",
    source: eventType === "screen_view" || eventType === "pointer_interaction" ? "prototype_adapter" : "runner",
    eventType,
    occurredAt: at,
    receivedAt: at,
    sequence,
    sessionId,
    ...context,
    participantId: options.participantId ?? context.participantId,
    ...(options.taskId ? { taskId: options.taskId } : {}),
    ...(options.screenId ? { screenId: options.screenId } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

function derived(id: string, sessionId: string, eventType: DerivedTrackingEvent["eventType"], at: string, taskId: string, from: string[], options: { participantId?: string; metadata?: Record<string, unknown>; ruleVersion?: string } = {}): Derived {
  return {
    schemaVersion: 2,
    eventId: id,
    idempotencyKey: `idem:${id}`,
    eventLayer: "derived",
    source: eventType === "task_success" || eventType === "task_failed" ? "rules_engine" : "analytics",
    eventType,
    occurredAt: at,
    receivedAt: at,
    sessionId,
    ...context,
    participantId: options.participantId ?? context.participantId,
    taskId,
    derivedFromEventIds: from,
    ruleVersion: options.ruleVersion ?? `${eventType}-v1`,
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

function fixture(): AcceptedTrackingEvent[] {
  return [
    raw("s1-start", "s1", 0, "session_started", "2026-09-09T00:00:00.000Z"),
    raw("s1-task", "s1", 1, "task_started", "2026-09-09T00:00:01.000Z", { taskId: "task-1" }),
    raw("s1-a", "s1", 2, "screen_view", "2026-09-09T00:00:02.000Z", { taskId: "task-1", screenId: "A" }),
    raw("s1-pointer", "s1", 3, "pointer_interaction", "2026-09-09T00:00:03.000Z", { taskId: "task-1" }),
    derived("s1-misclick", "s1", "misclick", "2026-09-09T00:00:03.000Z", "task-1", ["s1-pointer"]),
    raw("s1-detour", "s1", 4, "screen_view", "2026-09-09T00:00:04.000Z", { taskId: "task-1", screenId: "X" }),
    raw("s1-a2", "s1", 5, "screen_view", "2026-09-09T00:00:05.000Z", { taskId: "task-1", screenId: "A" }),
    derived("s1-back", "s1", "backtrack", "2026-09-09T00:00:05.000Z", "task-1", ["s1-a", "s1-detour", "s1-a2"]),
    raw("s1-b", "s1", 6, "screen_view", "2026-09-09T00:00:11.000Z", { taskId: "task-1", screenId: "B" }),
    derived("s1-success", "s1", "task_success", "2026-09-09T00:00:11.000Z", "task-1", ["s1-b"], { metadata: { outcome: "success_direct" } }),
    derived("s1-rage", "s1", "rage_click", "2026-09-09T00:00:03.000Z", "task-1", ["s1-pointer"]),
    raw("s1-complete", "s1", 7, "session_completed", "2026-09-09T00:00:12.000Z"),

    raw("s2-start", "s2", 0, "session_started", "2026-09-09T00:01:00.000Z", { participantId: "p2" }),
    raw("s2-task", "s2", 1, "task_started", "2026-09-09T00:01:01.000Z", { taskId: "task-1", participantId: "p2" }),
    raw("s2-tech", "s2", 2, "task_technical_blocked", "2026-09-09T00:01:02.000Z", { taskId: "task-1", participantId: "p2" }),
    raw("s2-end", "s2", 3, "session_technical_blocked", "2026-09-09T00:01:03.000Z", { participantId: "p2" }),

    raw("s3-start", "s3", 0, "session_started", "2026-09-09T00:02:00.000Z", { participantId: "p3" }),
    raw("s3-task", "s3", 1, "task_started", "2026-09-09T00:02:01.000Z", { taskId: "task-1", participantId: "p3" }),
    raw("s3-give", "s3", 2, "task_give_up", "2026-09-09T00:02:05.000Z", { taskId: "task-1", participantId: "p3" }),
    raw("s3-end", "s3", 3, "session_completed", "2026-09-09T00:02:06.000Z", { participantId: "p3" }),
  ];
}

test("Tasks 44/45 overview and task metrics reproduce canonical eligible evidence", () => {
  const results = buildResultsModel({
    testVersionId: "version-1",
    events: fixture(),
    tasks: [{ taskId: "task-1", title: "Checkout", ordinal: 1, expectedPath: ["A", "B"] }],
    answers: [{ id: "a1", sessionId: "s1", taskId: "task-1", questionKey: "seq", answerType: "seq", value: { score: 6, scaleVersion: "seq-7-v1" }, createdAt: "2026-09-09T00:00:11.500Z" }],
  });

  assert.equal(results.overview.participantCount, 3);
  assert.equal(results.overview.sessionCount, 3);
  assert.equal(results.overview.eligibleTaskCount, 2);
  assert.equal(results.overview.technicalBlockedTaskCount, 1);
  assert.equal(results.overview.completionRate, 50);
  assert.equal(results.overview.giveUpRate, 50);
  assert.equal(results.overview.medianSuccessfulDurationMs, 10000);
  assert.equal(results.overview.successfulDurationSampleSize, 1);
  assert.equal(results.overview.misclickCount, 1);
  assert.equal(results.overview.rageClickCount, 1);
  assert.equal(results.overview.backtrackCount, 1);

  const task = results.taskDetails[0];
  assert.equal(task.eligible, 2);
  assert.equal(task.technicalBlockedCount, 1);
  assert.equal(task.completionRate, 50);
  assert.equal(task.successfulDuration.medianMs, 10000);
  assert.equal(task.seqSampleSize, 1);
  assert.deepEqual(task.seqResponses.map((response) => [response.value, response.scaleVersion]), [[6, "seq-7-v1"]]);
});

test("Task 46 path analysis uses ordered canonical screen_view and separate derived backtrack evidence", () => {
  const results = buildResultsModel({
    testVersionId: "version-1",
    events: fixture(),
    tasks: [{ taskId: "task-1", title: "Checkout", ordinal: 1, expectedPath: ["A", "B"] }],
  });
  const path = results.paths.find((item) => item.sessionId === "s1");
  assert.ok(path);
  assert.deepEqual(path.expectedPath, ["A", "B"]);
  assert.deepEqual(path.actualPath, ["A", "X", "A", "B"]);
  assert.equal(path.expectedPathMatch, false);
  assert.equal(path.detourCount, 1);
  assert.equal(path.repeatedScreenCount, 1);
  assert.equal(path.backtrackCount, 1);
  assert.equal(path.terminalOutcome, "success_direct");
});

test("Task 49 timeline preserves event and feedback detail without fabricating unsupported heatmap/funnel", () => {
  const results = buildResultsModel({
    testVersionId: "version-1",
    events: fixture(),
    tasks: [{ taskId: "task-1", title: "Checkout", ordinal: 1, expectedPath: ["A", "B"] }],
    answers: [{ id: "feedback-1", sessionId: "s1", taskId: "task-1", questionKey: "open_feedback", answerType: "text", value: "Clear", createdAt: "2026-09-09T00:00:11.700Z" }],
  });
  const session = results.sessions.find((item) => item.sessionId === "s1");
  assert.ok(session);
  assert.equal(session.taskOutcomes["task-1"], "success_direct");
  assert.ok(session.timeline.some((item) => item.kind === "feedback" && item.eventType === "open_feedback"));
  assert.equal(results.unsupported.heatmap, true);
  assert.equal(results.unsupported.funnel, true);
});

test("No Data stays null when the only task session is technical blocked", () => {
  const events: AcceptedTrackingEvent[] = [
    raw("b-start", "blocked", 0, "session_started", "2026-09-09T01:00:00.000Z"),
    raw("b-task", "blocked", 1, "task_started", "2026-09-09T01:00:01.000Z", { taskId: "task-1" }),
    raw("b-tech", "blocked", 2, "task_technical_blocked", "2026-09-09T01:00:02.000Z", { taskId: "task-1" }),
  ];
  const results = buildResultsModel({ testVersionId: "version-1", events, tasks: [{ taskId: "task-1", title: "Task", ordinal: 1, expectedPath: [] }] });
  assert.equal(results.overview.eligibleTaskCount, 0);
  assert.equal(results.overview.completionRate, null);
  assert.equal(results.overview.giveUpRate, null);
  assert.equal(results.overview.medianSuccessfulDurationMs, null);
  assert.equal(results.taskDetails[0].completionRate, null);
});
