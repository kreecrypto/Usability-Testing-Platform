import {
  accessTokenFromRequest,
  publicSupabaseConfig,
} from "../../../lib/auth/session.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

function configFor(request: Request) {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) return null;
  const config = publicSupabaseConfig();
  return { accessToken, config };
}

export async function GET(request: Request): Promise<Response> {
  let auth;
  try { auth = configFor(request); } catch { return json({ error: "data_service_not_configured" }, 503); }
  if (!auth) return json({ error: "authentication_required" }, 401);
  try {
    const response = await fetch(
      `${auth.config.url}/rest/v1/workspaces?select=id,name,slug,created_at&order=created_at.asc`,
      { headers: { apikey: auth.config.key, authorization: `Bearer ${auth.accessToken}`, accept: "application/json" }, cache: "no-store" },
    );
    if (response.status === 401) return json({ error: "authentication_required" }, 401);
    if (response.status === 403) return json({ error: "permission_denied" }, 403);
    if (!response.ok) return json({ error: "data_request_failed" }, 502);
    return json({ workspaces: await response.json() }, 200);
  } catch { return json({ error: "data_request_failed" }, 502); }
}

export async function POST(request: Request): Promise<Response> {
  let auth;
  try { auth = configFor(request); } catch { return json({ error: "data_service_not_configured" }, 503); }
  if (!auth) return json({ error: "authentication_required" }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim() : null;
  if (!name) return json({ error: "workspace_name_required" }, 400);
  try {
    const response = await fetch(`${auth.config.url}/rest/v1/rpc/create_owned_workspace`, {
      method: "POST",
      headers: { apikey: auth.config.key, authorization: `Bearer ${auth.accessToken}`, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ p_name: name, p_slug: slug || null }),
      cache: "no-store",
    });
    if (response.status === 401) return json({ error: "authentication_required" }, 401);
    if (response.status === 403) return json({ error: "permission_denied" }, 403);
    if (response.status === 409) return json({ error: "workspace_slug_conflict" }, 409);
    if (!response.ok) return json({ error: "workspace_create_failed" }, 502);
    const workspaceId = await response.json();
    return json({ workspaceId }, 201);
  } catch { return json({ error: "workspace_create_failed" }, 502); }
}
