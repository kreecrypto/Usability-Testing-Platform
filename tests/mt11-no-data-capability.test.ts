import test from "node:test";
import assert from "node:assert/strict";
import { buildResultsModel } from "../src/lib/analytics/results.ts";
import { buildUsabilityReport } from "../src/lib/reports/model.ts";
import { capabilityAvailability, observationFor, presentMetric } from "../src/lib/analytics/presentation.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent } from "../src/lib/tracking/events.ts";

const testId = "22222222-2222-4222-8222-222222222222";
const testVersionId = "33333333-3333-4333-8333-333333333333";
const taskId = "44444444-4444-4444-8444-444444444444";
const sessionId = "55555555-5555-4555-8555-555555555555";
const participantId = "66666666-6666-4666-8666-666666666666";
const at = "2026-09-26T00:00:00Z";
function raw(eventId: string, eventType: RawTrackingEvent["eventType"], sequence: number): AcceptedTrackingEvent<RawTrackingEvent> {
  return { schemaVersion: 2, eventId, idempotencyKey: eventId, eventLayer: "raw", source: eventType === "pointer_interaction" ? "prototype_adapter" : "runner",
    eventType, sequence, sessionId, participantId, testId, testVersionId, taskId, occurredAt: at, receivedAt: at,
    ...(eventType === "pointer_interaction" ? { screenId: "screen-1" } : {}) };
}

test("explicit target No Data blocks a computable zero and its visualization capability", () => {
  const results = buildResultsModel({ testVersionId, tasks: [{ taskId, title: "Task", ordinal: 1, expectedPath: [] }],
    context: { testId, testVersionId, versionNo: 1, lifecycleStatus: "published", publishedAt: at,
      target: { provider: "first_party_web", sourceUrl: "https://example.test", environment: "uat", launchMode: "new_tab", snapshotVersion: 1,
        capabilities: { pointer: "No Data", coordinates: "Available" } } },
    events: [raw("session", "session_started", 1), raw("task", "task_started", 2), raw("pointer", "pointer_interaction", 3), raw("giveup", "task_give_up", 4)] });
  const observation = observationFor(results, "misclickRate");
  assert.ok(observation);
  assert.equal(observation.value, 0);
  assert.equal(observation.denominator, 1);
  assert.equal(observation.availability, "No Data");
  assert.equal(presentMetric(observation, (value) => `${value}%`).value, "ยังไม่มีข้อมูล");
  assert.equal(capabilityAvailability(results, "pointer", "coordinates"), "No Data");
  const report = buildUsabilityReport({ results, context: results.context!, findings: [], evidenceByFinding: {}, retests: [] });
  assert.equal(report.evidenceExplorer.heatmapStatus, "No Data");
});
