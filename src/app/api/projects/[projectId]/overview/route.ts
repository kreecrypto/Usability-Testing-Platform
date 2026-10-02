import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { crudErrorResponse, crudForRequest, jsonResponse } from "../../../../../lib/project-test-api.ts";
import { createTestOverviewReader } from "../../../../../lib/test-overview.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };
type VersionRow = { id: string; test_id: string; version_no: number; lifecycle_status: "draft" | "published"; study_mode?: "usability" | "methods" | "mixed" };
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
    if (!project) return jsonResponse({ error: "not_found" }, 404);
    const url = new URL(request.url);
    const page = await crud.pageTests(project.workspace_id, {projectId:project.id,page:Number(url.searchParams.get("page") ?? 1),pageSize:20,search:url.searchParams.get("search") ?? "",status:url.searchParams.get("status") ?? "all"});
    const tests = page.items;

    const headers = { apikey: config.key, authorization: `Bearer ${accessToken}`, accept: "application/json" };
    const findingsQuery = new URLSearchParams({
      select: "id,title,severity,status,test_version_id,updated_at",
      workspace_id: `eq.${project.workspace_id}`,
      project_id: `eq.${project.id}`,
      status: "neq.dismissed",
      order: "updated_at.desc",
      limit: "5",
    });
    const findingsResponse = await fetch(`${config.url}/rest/v1/findings?${findingsQuery}`, { headers, cache: "no-store", signal:AbortSignal.timeout(15000) });
    if (!findingsResponse.ok) return providerError(findingsResponse.status);
    const findings = await findingsResponse.json() as FindingRow[];
    const reader = createTestOverviewReader({url:config.url,key:config.key,token:accessToken});
    const histories = await Promise.all(tests.map(async test => (await reader.versions(test)).map(version => ({...version,test_id:test.id}))));
    const versions = histories.flat() as VersionRow[];
    const latestPublishedByTest = new Map<string, VersionRow>();
    const latestVersionByTest = new Map<string, VersionRow>();
    for (const version of versions) {
      if (!latestVersionByTest.has(version.test_id)) latestVersionByTest.set(version.test_id, version);
      if (version.lifecycle_status === "published" && !latestPublishedByTest.has(version.test_id)) latestPublishedByTest.set(version.test_id, version);
    }
    const findingModes = new Map<string,string>();
    if (findings.length) {
      const modeQuery = new URLSearchParams({workspace_id:`eq.${project.workspace_id}`,id:`in.(${findings.map(item=>item.test_version_id).join(",")})`,select:"id,study_mode"});
      const modeResponse = await fetch(`${config.url}/rest/v1/test_versions?${modeQuery}`,{headers,cache:"no-store",signal:AbortSignal.timeout(15000)});
      if (!modeResponse.ok) return providerError(modeResponse.status);
      for (const version of await modeResponse.json() as Array<{id:string;study_mode:string}>) findingModes.set(version.id,version.study_mode);
    }
    return jsonResponse({
      project,
      tests: tests.map((test) => ({ ...test,
        latestPublishedVersionId: latestPublishedByTest.get(test.id)?.id ?? null,
        latestStudyMode: latestVersionByTest.get(test.id)?.study_mode ?? "usability",
      })),
      findings: findings.map(item=>({...item,studyMode:findingModes.get(item.test_version_id) ?? null})),
      pagination: page.pagination,
    });
  } catch (error) {
    return crudErrorResponse(error);
  }
}
