import { createHash, randomBytes } from "node:crypto";
import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createMethodBuilderStore, MethodBuilderError } from "../../../../../lib/methods/builder-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ testId: string }> };
type InviteRow = { id: string; label: string; status: string; expires_at: string; created_at: string; used_at: string | null };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}
function config(request: Request) {
  const token = accessTokenFromRequest(request);
  if (!token) throw new MethodBuilderError("authentication_required", 401);
  const supabase = publicSupabaseConfig();
  return { token, supabase, builder: createMethodBuilderStore({ supabaseUrl: supabase.url, publicKey: supabase.key, accessToken: token }) };
}
async function query<T>(url: string, token: string, key: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { apikey: key, authorization: `Bearer ${token}`,
    ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) } });
  if (response.status === 401) throw new MethodBuilderError("authentication_required", 401);
  if (response.status === 403) throw new MethodBuilderError("permission_denied", 403);
  if (!response.ok) throw new MethodBuilderError("invite_request_failed", 502);
  const body = await response.text();
  return (body.trim() ? JSON.parse(body) : null) as T;
}
function fail(error: unknown): Response {
  if (error instanceof MethodBuilderError) return json({ error: error.code }, error.status);
  return json({ error: "invite_request_failed" }, 502);
}

export async function GET(request: Request, route: Context): Promise<Response> {
  try {
    const { testId } = await route.params;
    const { token, supabase, builder } = config(request);
    const version = await builder.publishedVersion(testId);
    if (!version) return json({ invites: [] });
    const params = new URLSearchParams({ test_version_id: `eq.${version.id}`, select: "id,label,status,expires_at,created_at,used_at", order: "created_at.desc" });
    const invites = await query<InviteRow[]>(`${supabase.url}/rest/v1/study_invites?${params}`, token, supabase.key);
    return json({ invites, testVersionId: version.id });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request, route: Context): Promise<Response> {
  try {
    const { testId } = await route.params;
    const { token, supabase, builder } = config(request);
    const version = await builder.publishedVersion(testId);
    if (!version) return json({ error: "published_version_required" }, 409);
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "invalid_json" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label || label.length > 160) return json({ error: "invalid_label" }, 400);
    const days = body.expiresInDays === undefined ? 7 : Number(body.expiresInDays);
    if (!Number.isInteger(days) || days < 1 || days > 30) return json({ error: "invalid_expiry" }, 400);
    const raw = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const params = new URLSearchParams({ select: "id,label,status,expires_at,created_at,used_at" });
    const invites = await query<InviteRow[]>(`${supabase.url}/rest/v1/study_invites?${params}`, token, supabase.key, {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({ workspace_id: version.workspace_id, test_version_id: version.id,
        label, token_hash: hash, expires_at: expiresAt }),
    });
    if (!invites[0]) throw new MethodBuilderError("invite_request_failed", 502);
    const link = `${new URL(request.url).origin}/m/${encodeURIComponent(version.id)}#invite=${raw}`;
    return json({ invite: invites[0], link }, 201);
  } catch (error) { return fail(error); }
}

export async function DELETE(request: Request, route: Context): Promise<Response> {
  try {
    const { testId } = await route.params;
    const { token, supabase, builder } = config(request);
    const version = await builder.publishedVersion(testId);
    if (!version) return json({ error: "version_not_found" }, 404);
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "invalid_json" }, 400); }
    const inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";
    if (!/^[0-9a-f-]{36}$/i.test(inviteId)) return json({ error: "invalid_invite_id" }, 400);
    const params = new URLSearchParams({ id: `eq.${inviteId}`, test_version_id: `eq.${version.id}`, status: "eq.pending" });
    await query<unknown>(`${supabase.url}/rest/v1/study_invites?${params}`, token, supabase.key, { method: "DELETE" });
    return json({ revoked: true });
  } catch (error) { return fail(error); }
}
