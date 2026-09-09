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

export async function GET(request: Request): Promise<Response> {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) return json({ error: "authentication_required" }, 401);

  let config;
  try {
    config = publicSupabaseConfig();
  } catch {
    return json({ error: "data_service_not_configured" }, 503);
  }

  try {
    // Task21 RLS is the authorization boundary. The client does not submit a user
    // ID or role claim; PostgREST resolves auth.uid() from this user JWT.
    const response = await fetch(
      `${config.url}/rest/v1/workspaces?select=id,name,slug,created_at&order=created_at.asc`,
      {
        headers: {
          apikey: config.key,
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (response.status === 401) return json({ error: "authentication_required" }, 401);
    if (response.status === 403) return json({ error: "permission_denied" }, 403);
    if (!response.ok) return json({ error: "data_request_failed" }, 502);
    const workspaces = await response.json();
    return json({ workspaces }, 200);
  } catch {
    return json({ error: "data_request_failed" }, 502);
  }
}
