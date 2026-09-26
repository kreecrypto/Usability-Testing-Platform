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
