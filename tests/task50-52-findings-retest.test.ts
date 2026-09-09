import assert from "node:assert/strict";
import test from "node:test";

import { compareRetestMetric, normalizeMetricSnapshot } from "../src/lib/findings/model.ts";
import { createFindingsStore } from "../src/lib/findings/store.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const versionId = "33333333-3333-4333-8333-333333333333";
const findingId = "44444444-4444-4444-8444-444444444444";
const sessionId = "55555555-5555-4555-8555-555555555555";

function metric(testVersionId: string, value: number | null, sampleSize: number, blocked: number) {
  return {
    metricKey: "completionRate",
    value,
    sampleSize,
    technicalBlockedCount: blocked,
    testVersionId,
    aggregationVersion: "task25-v1",
    ruleVersions: ["success-rule-v1"],
    sourceEventIds: ["event-1", "event-2"],
  };
}

test("Task 50 metric snapshot remains version-traceable and preserves No Data", () => {
  const snapshot = normalizeMetricSnapshot(metric(versionId, null, 0, 2), versionId);
  assert.equal(snapshot.metricKey, "completionRate");
  assert.equal(snapshot.value, null);
  assert.equal(snapshot.sampleSize, 0);
  assert.equal(snapshot.technicalBlockedCount, 2);
  assert.deepEqual(snapshot.ruleVersions, ["success-rule-v1"]);
  assert.throws(() => normalizeMetricSnapshot(metric("66666666-6666-4666-8666-666666666666", 50, 10, 0), versionId), /metric_snapshot_version_mismatch/);
});

test("Task 52 computes absolute and relative delta without claiming significance", () => {
  const retestVersion = "77777777-7777-4777-8777-777777777777";
  const comparison = compareRetestMetric({
    baselineVersionId: versionId,
    retestVersionId: retestVersion,
    before: metric(versionId, 50, 20, 2),
    after: metric(retestVersion, 65, 24, 1),
  });
  assert.equal(comparison.absoluteDelta, 15);
  assert.equal(comparison.relativeDeltaPercent, 30);
  assert.equal(comparison.baseline.sampleSize, 20);
  assert.equal(comparison.retest.sampleSize, 24);
  assert.equal(comparison.baseline.technicalBlockedCount, 2);
  assert.equal(comparison.retest.technicalBlockedCount, 1);
  assert.equal(comparison.statisticalSignificance, null);
});

test("Task 52 relative delta is not fabricated for zero or missing baseline", () => {
  const retestVersion = "77777777-7777-4777-8777-777777777777";
  const zero = compareRetestMetric({ baselineVersionId: versionId, retestVersionId: retestVersion, before: metric(versionId, 0, 10, 0), after: metric(retestVersion, 5, 10, 0) });
  assert.equal(zero.absoluteDelta, 5);
  assert.equal(zero.relativeDeltaPercent, null);
  const missing = compareRetestMetric({ baselineVersionId: versionId, retestVersionId: retestVersion, before: metric(versionId, null, 0, 3), after: metric(retestVersion, 5, 10, 0) });
  assert.equal(missing.absoluteDelta, null);
  assert.equal(missing.relativeDeltaPercent, null);
});

test("Task 51 path evidence insert carries finding workspace scope", async () => {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const findingRow = {
    id: findingId,
    workspace_id: workspaceId,
    project_id: projectId,
    test_version_id: versionId,
    task_id: null,
    screen_id: null,
    title: "Checkout detour",
    problem: "Participants detour before completion",
    description: null,
    severity: "high",
    status: "open",
    metric_snapshot: metric(versionId, 50, 20, 2),
    created_at: "2026-09-09T00:00:00Z",
    updated_at: "2026-09-09T00:00:00Z",
  };
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); requests.push({ url, init });
    if (url.includes("/rest/v1/findings?")) return new Response(JSON.stringify([findingRow]), { status: 200 });
    if (url.includes("/rest/v1/finding_evidence?")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify([{
        id: "88888888-8888-4888-8888-888888888888",
        workspace_id: body.workspace_id,
        finding_id: body.finding_id,
        evidence_type: body.evidence_type,
        session_id: body.session_id,
        event_id: null,
        answer_id: null,
        note: null,
        evidence_payload: body.evidence_payload,
        created_at: "2026-09-09T00:01:00Z",
      }]), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  }) as typeof fetch;

  const store = createFindingsStore({ supabaseUrl: "https://example.supabase.co", anonKey: "publishable", accessToken: "user-jwt", fetchImpl });
  const evidence = await store.linkEvidence(findingId, { type: "path", sessionId, payload: { expectedPath: ["A", "B"], actualPath: ["A", "X", "B"], detourCount: 1 } });
  assert.equal(evidence.type, "path");
  assert.equal(evidence.sessionId, sessionId);
  const insert = requests.find((request) => request.url.includes("/rest/v1/finding_evidence?"));
  assert.ok(insert);
  const body = JSON.parse(String(insert.init?.body));
  assert.equal(body.workspace_id, workspaceId);
  assert.equal(body.finding_id, findingId);
  assert.equal(body.evidence_type, "path");
});

test("Task 51 heatmap/path evidence fails closed without canonical payload", async () => {
  const findingRow = {
    id: findingId, workspace_id: workspaceId, project_id: projectId, test_version_id: versionId,
    task_id: null, screen_id: null, title: "Issue", problem: "Problem", description: null,
    severity: "medium", status: "open", metric_snapshot: metric(versionId, 50, 10, 0),
    created_at: "2026-09-09T00:00:00Z", updated_at: "2026-09-09T00:00:00Z",
  };
  const fetchImpl = (async () => new Response(JSON.stringify([findingRow]), { status: 200 })) as typeof fetch;
  const store = createFindingsStore({ supabaseUrl: "https://example.supabase.co", anonKey: "publishable", accessToken: "user-jwt", fetchImpl });
  await assert.rejects(() => store.linkEvidence(findingId, { type: "heatmap", sessionId, payload: {} }), /heatmap_evidence_requires_session_payload/);
});
