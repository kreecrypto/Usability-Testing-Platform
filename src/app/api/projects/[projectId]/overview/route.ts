import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { crudErrorResponse, crudForRequest, jsonResponse } from "../../../../../lib/project-test-api.ts";
import type { TestRow } from "../../../../../lib/project-test-crud.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };
type VersionRow = { id: string; test_id: string; version_no: number };
type FindingRow = { id: string; title: string; severity: string; status: string; test_version_id: string; updated_at: string };

function providerError(status: number): Response {
  if (status === 401) return jsonResponse({ error: "authentication_required" }, 401);
  if (status === 403) return jsonResponse({ error: "permission_denied" }, 403);
  return jsonResponse({ error: "data_request_failed" }, 502);
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) return jsonResponse({ error: "authentication_required" }, 401);

  let config: ReturnType<typeof publicSupabaseConfig>;
  try { config = publicSupabaseConfig(); }
  catch { return jsonResponse({ error: "data_service_not_configured" }, 503); }

  try {
    const { projectId } = await context.params;
    const crud = crudForRequest(request);
    const project = await crud.getProject(projectId);
    if (!project || project.status === "archived") return jsonResponse({ error: "not_found" }, 404);
    const tests: TestRow[] = (await crud.listTests(project.workspace_id, project.id))
      .filter((test) => test.status !== "archived");

    const headers = { apikey: config.key, authorization: `Bearer ${accessToken}`, accept: "application/json" };
    const findingsQuery = new URLSearchParams({
      select: "id,title,severity,status,test_version_id,updated_at",
      workspace_id: `eq.${project.workspace_id}`,
      project_id: `eq.${project.id}`,
      status: "neq.dismissed",
      order: "updated_at.desc",
      limit: "5",
    });
    const versionsQuery = new URLSearchParams({
      select: "id,test_id,version_no",
      workspace_id: `eq.${project.workspace_id}`,
      test_id: `in.(${tests.map((test) => test.id).join(",")})`,
      lifecycle_status: "eq.published",
      order: "version_no.desc",
    });
    const [findingsResponse, versionsResponse] = await Promise.all([
      fetch(`${config.url}/rest/v1/findings?${findingsQuery}`, { headers, cache: "no-store" }),
      tests.length > 0
        ? fetch(`${config.url}/rest/v1/test_versions?${versionsQuery}`, { headers, cache: "no-store" })
        : Promise.resolve(Response.json([])),
    ]);
    if (!findingsResponse.ok) return providerError(findingsResponse.status);
    if (!versionsResponse.ok) return providerError(versionsResponse.status);

    const [findings, versions] = await Promise.all([
      findingsResponse.json() as Promise<FindingRow[]>,
      versionsResponse.json() as Promise<VersionRow[]>,
    ]);
    const latestVersionByTest = new Map<string, VersionRow>();
    for (const version of versions) {
      if (!latestVersionByTest.has(version.test_id)) latestVersionByTest.set(version.test_id, version);
    }
    return jsonResponse({
      project,
      tests: tests.map((test) => ({ ...test, latestPublishedVersionId: latestVersionByTest.get(test.id)?.id ?? null })),
      findings,
    });
  } catch (error) {
    return crudErrorResponse(error);
  }
}
