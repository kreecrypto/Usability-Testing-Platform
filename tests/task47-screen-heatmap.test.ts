import assert from "node:assert/strict";
import test from "node:test";

import { buildScreenHeatmap, filterScreenHeatmap } from "../src/lib/analytics/heatmap.ts";
import { buildResultsModel } from "../src/lib/analytics/results.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent, DerivedTrackingEvent } from "../src/lib/tracking/events.ts";

const VERSION = "00000000-0000-4000-8000-000000000047";
const TEST = "00000000-0000-4000-8000-000000000001";
const TASK_A = "00000000-0000-4000-8000-000000000002";
const TASK_B = "00000000-0000-4000-8000-000000000003";
const SESSION_A = "00000000-0000-4000-8000-000000000004";
const SESSION_B = "00000000-0000-4000-8000-000000000005";
const PARTICIPANT_A = "00000000-0000-4000-8000-000000000006";
const PARTICIPANT_B = "00000000-0000-4000-8000-000000000007";

function raw(overrides: Partial<RawTrackingEvent> & Pick<RawTrackingEvent, "eventId" | "eventType" | "sessionId" | "participantId" | "sequence">): AcceptedTrackingEvent<RawTrackingEvent> {
  return {
    schemaVersion: 2,
    idempotencyKey: overrides.eventId,
    eventLayer: "raw",
    source: "runner",
    occurredAt: `2026-09-10T10:00:${String(overrides.sequence).padStart(2, "0")}.000Z`,
    receivedAt: `2026-09-10T10:00:${String(overrides.sequence).padStart(2, "0")}.100Z`,
    testId: TEST,
    testVersionId: VERSION,
    ...overrides,
  } as AcceptedTrackingEvent<RawTrackingEvent>;
}

function success(eventId: string, sessionId: string, participantId: string, taskId: string, rawEventId: string, outcome: "success_direct" | "success_indirect"): AcceptedTrackingEvent<DerivedTrackingEvent> {
  return {
    schemaVersion: 2,
    eventId,
    idempotencyKey: eventId,
    eventLayer: "derived",
    source: "rules_engine",
    eventType: "task_success",
    occurredAt: "2026-09-10T10:01:00.000Z",
    receivedAt: "2026-09-10T10:01:00.100Z",
    sessionId,
    participantId,
    testId: TEST,
    testVersionId: VERSION,
    taskId,
    derivedFromEventIds: [rawEventId],
    ruleVersion: "task-outcome-v1",
    metadata: { outcome },
  };
}

const events: AcceptedTrackingEvent[] = [
  raw({ eventId: "a-session", eventType: "session_started", sessionId: SESSION_A, participantId: PARTICIPANT_A, sequence: 1, metadata: { deviceClass: "desktop" } }),
  raw({ eventId: "a-task", eventType: "task_started", sessionId: SESSION_A, participantId: PARTICIPANT_A, taskId: TASK_A, sequence: 2 }),
  raw({
    eventId: "a-pointer", eventType: "pointer_interaction", sessionId: SESSION_A, participantId: PARTICIPANT_A, taskId: TASK_A, sequence: 3, source: "prototype_adapter", screenId: "10:1",
    metadata: { provider: "figma", canonicalPoint: { transformVersion: "figma-heatmap-v1", geometryVersionId: VERSION, presentedNodeId: "10:1", normalizedX: 0.25, normalizedY: 0.5, frameWidth: 1280, frameHeight: 800 } },
  }),
  success("a-success", SESSION_A, PARTICIPANT_A, TASK_A, "a-pointer", "success_direct"),
  raw({ eventId: "b-session", eventType: "session_started", sessionId: SESSION_B, participantId: PARTICIPANT_B, sequence: 1, metadata: { deviceClass: "mobile" } }),
  raw({ eventId: "b-task", eventType: "task_started", sessionId: SESSION_B, participantId: PARTICIPANT_B, taskId: TASK_B, sequence: 2 }),
  raw({
    eventId: "b-pointer", eventType: "pointer_interaction", sessionId: SESSION_B, participantId: PARTICIPANT_B, taskId: TASK_B, sequence: 3, source: "prototype_adapter", screenId: "20:1",
    metadata: { provider: "figma", canonicalPoint: { transformVersion: "figma-heatmap-v1", geometryVersionId: VERSION, presentedNodeId: "20:1", normalizedX: 0.75, normalizedY: 0.2, frameWidth: 390, frameHeight: 844 } },
  }),
  success("b-success", SESSION_B, PARTICIPANT_B, TASK_B, "b-pointer", "success_indirect"),
  raw({
    eventId: "b-raw-only", eventType: "pointer_interaction", sessionId: SESSION_B, participantId: PARTICIPANT_B, taskId: TASK_B, sequence: 4, source: "prototype_adapter", screenId: "20:1",
    metadata: { provider: "figma", normalizedX: 0.99, normalizedY: 0.99 },
  }),
];

test("builds heatmap only from canonical server geometry and exposes source-backed filter values", () => {
  const dataset = buildScreenHeatmap(VERSION, events);
  assert.equal(dataset.status, "available");
  assert.equal(dataset.rawPointerCount, 3);
  assert.equal(dataset.canonicalPointerCount, 2);
  assert.deepEqual(dataset.filters.taskIds, [TASK_A, TASK_B]);
  assert.deepEqual(dataset.filters.screenIds, ["10:1", "20:1"]);
  assert.deepEqual(dataset.filters.deviceClasses, ["desktop", "mobile"]);
  assert.deepEqual(dataset.filters.outcomes, ["success_direct", "success_indirect"]);
  assert.deepEqual(dataset.points.map((point) => [point.screenId, point.normalizedX, point.normalizedY]), [
    ["10:1", 0.25, 0.5],
    ["20:1", 0.75, 0.2],
  ]);
});

test("filters by exact test version, task, screen, device class and terminal outcome", () => {
  const dataset = buildScreenHeatmap(VERSION, events);
  assert.equal(filterScreenHeatmap(dataset, { testVersionId: VERSION, taskId: TASK_A }).length, 1);
  assert.equal(filterScreenHeatmap(dataset, { screenId: "20:1" }).length, 1);
  assert.equal(filterScreenHeatmap(dataset, { deviceClass: "mobile" }).length, 1);
  assert.equal(filterScreenHeatmap(dataset, { outcome: "success_indirect" }).length, 1);
  assert.equal(filterScreenHeatmap(dataset, { testVersionId: "00000000-0000-4000-8000-000000000999" }).length, 0);
});

test("distinguishes No Data from unsupported geometry and never falls back to raw/CSS-like coordinates", () => {
  const noPointer = buildScreenHeatmap(VERSION, events.filter((event) => event.eventType !== "pointer_interaction"));
  assert.equal(noPointer.status, "no_data");
  assert.equal(noPointer.reason, null);

  const rawOnly = buildScreenHeatmap(VERSION, events.filter((event) => event.eventId === "b-raw-only"));
  assert.equal(rawOnly.status, "unsupported");
  assert.equal(rawOnly.reason, "canonical_geometry_unavailable");
  assert.equal(rawOnly.points.length, 0);
});

test("rejects canonical points whose geometry version is not the exact test version", () => {
  const pointer = events.find((event) => event.eventId === "a-pointer")!;
  const mismatched: AcceptedTrackingEvent = {
    ...pointer,
    metadata: {
      ...pointer.metadata,
      canonicalPoint: { ...((pointer.metadata?.canonicalPoint ?? {}) as Record<string, unknown>), geometryVersionId: "another-version" },
    },
  };
  const dataset = buildScreenHeatmap(VERSION, [mismatched]);
  assert.equal(dataset.status, "unsupported");
  assert.equal(dataset.canonicalPointerCount, 0);
});

test("Results model exposes heatmap availability without changing funnel No Data semantics", () => {
  const results = buildResultsModel({
    testVersionId: VERSION,
    events,
    tasks: [
      { taskId: TASK_A, title: "Task A", ordinal: 1, expectedPath: [] },
      { taskId: TASK_B, title: "Task B", ordinal: 2, expectedPath: [] },
    ],
  });
  assert.equal(results.heatmap.status, "available");
  assert.equal(results.unsupported.heatmap, false);
  assert.equal(results.unsupported.funnel, true);
});
