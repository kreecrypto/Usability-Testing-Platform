import { accessTokenFromRequest, publicSupabaseConfig } from "../../../lib/auth/session.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Project = Readonly<{ id: string; workspace_id: string; name: string; updated_at: string }>;
type StudyTest = Readonly<{ id: string; workspace_id: string; project_id: string; title: string; status: string; updated_at: string }>;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) return json({ error: "authentication_required" }, 401);

  let config: ReturnType<typeof publicSupabaseConfig>;
  try { config = publicSupabaseConfig(); }
  catch { return json({ error: "data_service_not_configured" }, 503); }

  const headers = { apikey: config.key, authorization: `Bearer ${accessToken}`, accept: "application/json" };
  const projectsQuery = new URLSearchParams({
    select: "id,workspace_id,name,updated_at",
    status: "eq.active",
    order: "updated_at.desc",
    limit: "5",
  });
  const testsQuery = new URLSearchParams({
    select: "id,workspace_id,project_id,title,status,updated_at",
    status: "neq.archived",
    order: "updated_at.desc",
    limit: "5",
  });

  try {
    const [projectsResponse, testsResponse] = await Promise.all([
      fetch(`${config.url}/rest/v1/projects?${projectsQuery}`, { headers, cache: "no-store" }),
      fetch(`${config.url}/rest/v1/tests?${testsQuery}`, { headers, cache: "no-store" }),
    ]);
    if (projectsResponse.status === 401 || testsResponse.status === 401) return json({ error: "authentication_required" }, 401);
    if (projectsResponse.status === 403 || testsResponse.status === 403) return json({ error: "permission_denied" }, 403);
    if (!projectsResponse.ok || !testsResponse.ok) return json({ error: "data_request_failed" }, 502);
    const [projects, tests] = await Promise.all([
      projectsResponse.json() as Promise<Project[]>,
      testsResponse.json() as Promise<StudyTest[]>,
    ]);
    return json({ projects, tests }, 200);
  } catch {
    return json({ error: "data_request_failed" }, 502);
  }
}
