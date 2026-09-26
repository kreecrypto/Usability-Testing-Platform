import test from "node:test";
import assert from "node:assert/strict";
import { parseResultsStudyContext } from "../src/lib/analytics/context.ts";
import { createResultsStore, ResultsStoreError } from "../src/lib/analytics/results-store.ts";
import { buildResultsModel } from "../src/lib/analytics/results.ts";
import { buildUsabilityReport } from "../src/lib/reports/model.ts";

const versionId = "33333333-3333-4333-8333-333333333333";
const testId = "22222222-2222-4222-8222-222222222222";
const row = {
  id: versionId, test_id: testId, version_no: 2, lifecycle_status: "published",
  published_at: "2026-09-26T00:00:00Z", target_provider: "first_party_web",
  target_snapshot: { provider: "first_party_web", sourceUrl: "https://example.test/", environment: "uat", launchMode: "new_tab", snapshotVersion: 1,
    capabilities: { pointer: "Unsupported", path: "Available" } }, funnel_config: null,
};

test("Results reads target capabilities from its persisted exact test version", async () => {
  const called: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input));
    called.push(url.toString());
    if (url.pathname.endsWith("/test_versions")) return Response.json([row]);
    return Response.json([]);
  };
  const store = createResultsStore({ supabaseUrl: "https://example.supabase.co", anonKey: "anon", accessToken: "user", fetchImpl: fetchImpl as typeof fetch });
  const results = await store.read(versionId);
  assert.equal(results.context?.target.provider, "first_party_web");
  assert.equal(results.context?.target.capabilities.pointer, "Unsupported");
  assert.equal(results.context?.testVersionId, versionId);
  assert.equal(results.testId, testId);
  assert.equal(results.overview.completionRate, null);
  assert.ok(called[0].includes("target_snapshot"));
});

test("missing version and malformed identifier fail closed", async () => {
  const store = createResultsStore({ supabaseUrl: "https://example.supabase.co", anonKey: "anon", accessToken: "user",
    fetchImpl: (async () => Response.json([])) as typeof fetch });
  await assert.rejects(store.read("33333333-3333-4333-833333333333"), (e: unknown) => e instanceof ResultsStoreError && e.code === "invalid_test_version");
  await assert.rejects(store.read(versionId), (e: unknown) => e instanceof ResultsStoreError && e.code === "not_found");
});

test("conflicting provider and report context cannot claim authoritative provenance", () => {
  const context = parseResultsStudyContext({ ...row, target_provider: "external_web" });
  assert.equal(context.target.provider, null);
  assert.equal(context.target.snapshotVersion, null);
  assert.deepEqual(context.target.capabilities, {});
  const trueContext = parseResultsStudyContext(row);
  const results = buildResultsModel({ testVersionId: versionId, context: trueContext, events: [], tasks: [] });
  assert.throws(() => buildUsabilityReport({ results, context, findings: [], evidenceByFinding: {}, retests: [] }), /report_results_context_mismatch/);
});

test("Results and Report share capability-aware observations with exact provenance", () => {
  const context = parseResultsStudyContext(row);
  const results = buildResultsModel({ testVersionId: versionId, context, events: [], tasks: [] });
  const pointer = results.metrics.find((metric) => metric.metricKey === "misclickRate" && metric.scope === "overall");
  assert.ok(pointer);
  assert.equal(pointer.availability, "Unsupported");
  assert.equal(pointer.value, null);
  assert.equal(pointer.testVersionId, versionId);
  assert.equal(pointer.targetProvider, "first_party_web");
  assert.equal(pointer.targetSnapshotVersion, 1);
  const report = buildUsabilityReport({ results, context, findings: [], evidenceByFinding: {}, retests: [] });
  assert.deepEqual(report.metrics, results.metrics);
});

test("backtrack is not inferred from pointer-only evidence without trusted screen views", () => {
  const at = "2026-09-26T00:00:00Z";
  const sessionId = "55555555-5555-4555-8555-555555555555";
  const taskId = "44444444-4444-4444-8444-444444444444";
  const common = { schemaVersion: 2 as const, sessionId, participantId: "participant", testId, testVersionId: versionId,
    taskId, occurredAt: at, receivedAt: at };
  const raw = (eventId: string, sequence: number, eventType: "task_started" | "pointer_interaction") => ({
    ...common, eventId, idempotencyKey: eventId, eventLayer: "raw" as const, source: "prototype_adapter" as const,
    eventType, sequence,
  });
  const events = [
    raw("start", 1, "task_started"), raw("pointer-a", 2, "pointer_interaction"), raw("pointer-b", 3, "pointer_interaction"),
    { ...common, eventId: "backtrack", idempotencyKey: "backtrack", eventLayer: "derived" as const,
      source: "rules_engine" as const, eventType: "backtrack" as const, derivedFromEventIds: ["pointer-a", "pointer-b"], ruleVersion: "bad-rule-v1" },
  ];
  const results = buildResultsModel({ testVersionId: versionId, context: parseResultsStudyContext(row), events, tasks: [{ taskId, title: "Test", ordinal: 1, expectedPath: [] }] });
  assert.equal(results.overview.backtrackCount, 0);
  assert.deepEqual(results.paths[0]?.actualPath, []);
  assert.equal(results.paths[0]?.backtrackCount, 0);
});
