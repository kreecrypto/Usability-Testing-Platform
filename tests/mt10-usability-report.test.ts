import assert from "node:assert/strict";
import test from "node:test";

import { buildResultsModel } from "../src/lib/analytics/results.ts";
import type { FindingEvidenceRecord, FindingRecord } from "../src/lib/findings/model.ts";
import { buildUsabilityReport, type ReportStudyContext } from "../src/lib/reports/model.ts";
import type { AcceptedTrackingEvent, DerivedTrackingEvent, RawTrackingEvent } from "../src/lib/tracking/events.ts";

type Raw = AcceptedTrackingEvent<RawTrackingEvent>;
type Derived = AcceptedTrackingEvent<DerivedTrackingEvent>;

const testId = "22222222-2222-4222-8222-222222222222";
const versionId = "33333333-3333-4333-8333-333333333333";
const taskId = "44444444-4444-4444-8444-444444444444";

function raw(
  id: string,
  sessionId: string,
  sequence: number,
  eventType: RawTrackingEvent["eventType"],
  at: string,
  options: { taskId?: string; screenId?: string; participantId?: string } = {},
): Raw {
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
    participantId: options.participantId ?? "participant-1",
    testId,
    testVersionId: versionId,
    ...(options.taskId ? { taskId: options.taskId } : {}),
    ...(options.screenId ? { screenId: options.screenId } : {}),
  };
}

function derived(
  id: string,
  sessionId: string,
  eventType: DerivedTrackingEvent["eventType"],
  at: string,
  from: string[],
  metadata?: Record<string, unknown>,
): Derived {
  return {
    schemaVersion: 2,
    eventId: id,
    idempotencyKey: `idem:${id}`,
    eventLayer: "derived",
    source: "rules_engine",
    eventType,
    occurredAt: at,
    receivedAt: at,
    sessionId,
    participantId: "participant-1",
    testId,
    testVersionId: versionId,
    taskId,
    derivedFromEventIds: from,
    ruleVersion: "task-outcome-v1",
    ...(metadata ? { metadata } : {}),
  };
}

function context(pointer: "Available" | "Unsupported" = "Available"): ReportStudyContext {
  return Object.freeze({
    testId,
    testVersionId: versionId,
    versionNo: 1,
    lifecycleStatus: "published",
    publishedAt: "2026-09-25T00:00:00.000Z",
    target: Object.freeze({
      provider: "first_party_web",
      sourceUrl: "https://example.test/",
      environment: "uat",
      launchMode: "same_tab",
      snapshotVersion: 1,
      capabilities: Object.freeze({
        access: "Available",
        screen: "Available",
        path: "Available",
        pointer,
        coordinates: pointer,
      }),
    }),
  });
}

function failedResults() {
  const events: AcceptedTrackingEvent[] = [
    raw("start", "s1", 0, "session_started", "2026-09-25T00:00:00.000Z"),
    raw("task-start", "s1", 1, "task_started", "2026-09-25T00:00:01.000Z", { taskId }),
    raw("screen", "s1", 2, "screen_view", "2026-09-25T00:00:03.000Z", { taskId, screenId: "checkout" }),
    derived("failed", "s1", "task_failed", "2026-09-25T00:00:05.000Z", ["screen"]),
    raw("complete", "s1", 3, "session_completed", "2026-09-25T00:00:06.000Z"),
  ];
  return buildResultsModel({
    testVersionId: versionId,
    events,
    tasks: [{ taskId, title: "Checkout", ordinal: 1, expectedPath: ["checkout"] }],
  });
}

function successResults() {
  const events: AcceptedTrackingEvent[] = [
    raw("start", "s1", 0, "session_started", "2026-09-25T00:00:00.000Z"),
    raw("task-start", "s1", 1, "task_started", "2026-09-25T00:00:01.000Z", { taskId }),
    raw("screen", "s1", 2, "screen_view", "2026-09-25T00:00:11.000Z", { taskId, screenId: "done" }),
    derived("success", "s1", "task_success", "2026-09-25T00:00:11.000Z", ["screen"], { outcome: "success_direct" }),
    raw("complete", "s1", 3, "session_completed", "2026-09-25T00:00:12.000Z"),
  ];
  return buildResultsModel({
    testVersionId: versionId,
    events,
    tasks: [{ taskId, title: "Checkout", ordinal: 1, expectedPath: ["done"] }],
    answers: [{
      id: "answer-seq",
      sessionId: "s1",
      taskId,
      questionKey: "seq",
      answerType: "seq",
      value: { score: 6, scaleVersion: "seq-7-v1" },
      createdAt: "2026-09-25T00:00:11.500Z",
    }],
  });
}

test("MT-10 preserves No Data rather than fabricating numeric zero", () => {
  const events: AcceptedTrackingEvent[] = [
    raw("start-blocked", "blocked", 0, "session_started", "2026-09-25T01:00:00.000Z"),
    raw("task-blocked-start", "blocked", 1, "task_started", "2026-09-25T01:00:01.000Z", { taskId }),
    raw("task-blocked", "blocked", 2, "task_technical_blocked", "2026-09-25T01:00:02.000Z", { taskId }),
  ];
  const results = buildResultsModel({
    testVersionId: versionId,
    events,
    tasks: [{ taskId, title: "Checkout", ordinal: 1, expectedPath: [] }],
  });
  const report = buildUsabilityReport({
    results,
    context: context(),
    findings: [],
    evidenceByFinding: {},
    retests: [],
    generatedAt: "2026-09-25T02:00:00.000Z",
  });

  const completion = report.metrics.find((item) => item.scope === "overall" && item.metricKey === "completionRate");
  assert.ok(completion);
  assert.equal(completion.value, null);
  assert.equal(completion.availability, "No Data");
  assert.equal(completion.denominator, 0);
  assert.equal(completion.technicalBlockedCount, 1);
});

test("MT-10 keeps a proven numeric zero Available when denominator exists", () => {
  const report = buildUsabilityReport({
    results: failedResults(),
    context: context(),
    findings: [],
    evidenceByFinding: {},
    retests: [],
  });
  const completion = report.metrics.find((item) => item.scope === "overall" && item.metricKey === "completionRate");
  assert.ok(completion);
  assert.equal(completion.value, 0);
  assert.equal(completion.denominator, 1);
  assert.equal(completion.availability, "Available");
  assert.ok(completion.evidenceRefs.length > 0);
});

test("MT-10 capability gate marks unsupported pointer metrics Unsupported instead of zero", () => {
  const report = buildUsabilityReport({
    results: failedResults(),
    context: context("Unsupported"),
    findings: [],
    evidenceByFinding: {},
    retests: [],
  });
  const misclick = report.metrics.find((item) => item.scope === "overall" && item.metricKey === "misclickRate");
  assert.ok(misclick);
  assert.equal(misclick.value, null);
  assert.equal(misclick.availability, "Unsupported");
  assert.equal(misclick.denominator, 0);
});

test("MT-10 composes researcher-authored Finding with Evidence Bundle and does not auto-create findings", () => {
  const results = successResults();
  const finding: FindingRecord = Object.freeze({
    id: "55555555-5555-4555-8555-555555555555",
    workspaceId: "11111111-1111-4111-8111-111111111111",
    projectId: "66666666-6666-4666-8666-666666666666",
    testVersionId: versionId,
    taskId,
    screenId: "done",
    title: "Checkout action is unclear",
    problem: "Participant hesitated before confirming checkout.",
    description: null,
    researcherInterpretation: "The final action may not communicate commitment clearly.",
    recommendation: "Test a clearer confirmation label in the next draft.",
    severity: "high",
    status: "open",
    metricSnapshot: Object.freeze({
      metricKey: "completionRate",
      value: 100,
      sampleSize: 1,
      technicalBlockedCount: 0,
      testVersionId: versionId,
      aggregationVersion: "task25-v1",
      ruleVersions: Object.freeze(["task-outcome-v1"]),
      sourceEventIds: Object.freeze(["screen", "success"]),
    }),
    createdAt: "2026-09-25T00:10:00.000Z",
    updatedAt: "2026-09-25T00:10:00.000Z",
  });
  const evidence: FindingEvidenceRecord = Object.freeze({
    id: "77777777-7777-4777-8777-777777777777",
    findingId: finding.id,
    type: "session",
    sessionId: "88888888-8888-4888-8888-888888888888",
    eventId: null,
    answerId: null,
    note: "Representative session",
    payload: Object.freeze({}),
    createdAt: "2026-09-25T00:11:00.000Z",
  });

  const withoutFinding = buildUsabilityReport({
    results,
    context: context(),
    findings: [],
    evidenceByFinding: {},
    retests: [],
  });
  assert.equal(withoutFinding.findings.length, 0);

  const report = buildUsabilityReport({
    results,
    context: context(),
    findings: [finding],
    evidenceByFinding: { [finding.id]: [evidence] },
    retests: [],
  });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].finding.researcherInterpretation, finding.researcherInterpretation);
  assert.equal(report.findings[0].finding.recommendation, finding.recommendation);
  assert.equal(report.findings[0].evidence.length, 1);
  assert.ok(report.findings[0].evidenceRefs.includes("screen"));
  assert.ok(report.findings[0].evidenceRefs.includes(evidence.id));
});

test("MT-10 exposes Median/P75/P90 and rejects cross-version finding synthesis", () => {
  const results = successResults();
  const report = buildUsabilityReport({
    results,
    context: context(),
    findings: [],
    evidenceByFinding: {},
    retests: [],
  });
  const keys = report.metrics.filter((item) => item.scope === "overall").map((item) => item.metricKey);
  assert.ok(keys.includes("medianSuccessfulDurationMs"));
  assert.ok(keys.includes("p75SuccessfulDurationMs"));
  assert.ok(keys.includes("p90SuccessfulDurationMs"));

  const wrongFinding = {
    id: "99999999-9999-4999-8999-999999999999",
    workspaceId: "11111111-1111-4111-8111-111111111111",
    projectId: "66666666-6666-4666-8666-666666666666",
    testVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    taskId,
    screenId: null,
    title: "Wrong version",
    problem: "Wrong version",
    description: null,
    researcherInterpretation: null,
    recommendation: null,
    severity: "medium",
    status: "open",
    metricSnapshot: {
      metricKey: "completionRate",
      value: 100,
      sampleSize: 1,
      technicalBlockedCount: 0,
      testVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      aggregationVersion: "task25-v1",
      ruleVersions: [],
      sourceEventIds: [],
    },
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
  } as const;

  assert.throws(() => buildUsabilityReport({
    results,
    context: context(),
    findings: [wrongFinding],
    evidenceByFinding: {},
    retests: [],
  }), /report_finding_version_mismatch/);
});
