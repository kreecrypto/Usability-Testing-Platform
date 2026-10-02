import { findingContextForRequest, findingsError, findingsForRequest, findingsJson, readObject } from "../../../lib/findings/api.ts";
import { accessTokenFromRequest, publicSupabaseConfig } from "../../../lib/auth/session.ts";
import { createResultsStore, ResultsStoreError } from "../../../lib/analytics/results-store.ts";
import { metricSnapshotFromObservation } from "../../../lib/findings/snapshot.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readObject(request);
    const findingId = typeof body.findingId === "string" ? body.findingId : "";
    const scope = await findingContextForRequest(request).finding(findingId);
    if (body.originalTestVersionId !== scope.testVersionId) {
      return findingsJson({ error: "original_version_must_match_finding" }, 409);
    }
    const retestVersionId = typeof body.retestTestVersionId === "string" ? body.retestTestVersionId : "";
    const accessToken = accessTokenFromRequest(request);
    if (!accessToken) return findingsJson({ error: "authentication_required" }, 401);
    const config = publicSupabaseConfig();
    const resultsStore = createResultsStore({ supabaseUrl: config.url, anonKey: config.key, accessToken });
    const [beforeResults, afterResults, findings] = await Promise.all([
      resultsStore.read(scope.testVersionId),
      resultsStore.read(retestVersionId),
      findingsForRequest(request).listFindings(scope.testVersionId),
    ]);
    const finding = findings.find((item) => item.id === findingId);
    if (!finding) return findingsJson({ error: "finding_not_found" }, 404);
    if (!beforeResults.testId || beforeResults.testId !== afterResults.testId) {
      return findingsJson({ error: "retest_must_use_same_test" }, 409);
    }
    if (beforeResults.context?.lifecycleStatus !== "published" || afterResults.context?.lifecycleStatus !== "published") {
      return findingsJson({ error: "retest_versions_must_be_published" }, 409);
    }
    const before = beforeResults.metrics.find((item) => item.metricKey === finding.metricSnapshot.metricKey && item.taskId === finding.taskId);
    const after = afterResults.metrics.find((item) => item.metricKey === finding.metricSnapshot.metricKey && item.taskId === finding.taskId);
    if (!before || !after) return findingsJson({ error: "retest_metric_unavailable" }, 409);
    const retest = await findingsForRequest(request).createRetest({
      ...body,
      workspaceId: scope.workspaceId,
      findingId,
      beforeMetrics: metricSnapshotFromObservation(before),
      afterMetrics: metricSnapshotFromObservation(after),
    });
    return findingsJson({ retest }, 201);
  } catch (error) {
    if (error instanceof ResultsStoreError) return findingsJson({ error: error.code }, error.status);
    return findingsError(error);
  }
}
