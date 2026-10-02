import { accessTokenFromRequest, validateAccessToken } from "../../../../lib/auth/session.ts";
import { authError, authJson, authRequest, sameOrigin } from "../../../../lib/auth/lifecycle.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return authJson({ error: "invalid_origin" }, 403);
  const token = accessTokenFromRequest(request);
  if (!token) return authJson({ error: "authentication_required" }, 401);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return authJson({ error: "invalid_json" }, 400); }
  if (typeof body?.password !== "string" || body.password.length < 8) return authJson({ error: "weak_password" }, 400);
  try {
    await validateAccessToken(token);
    await authRequest("user", { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ password: body.password }) });
    return authJson({ status: "updated" });
  } catch (error) { return authError(error); }
}
