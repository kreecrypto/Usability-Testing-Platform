import { accessTokenFromRequest } from "../../../../lib/auth/session.ts";
import { authJson, authRequest, clearSessionCookies, refreshFromRequest, refreshSession, sameOrigin } from "../../../../lib/auth/lifecycle.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return authJson({ error: "invalid_origin" }, 403);
  let revoked = false;
  try {
    let token = accessTokenFromRequest(request);
    const refresh = refreshFromRequest(request);
    if (!token && refresh) token = (await refreshSession(refresh)).accessToken;
    if (token) await authRequest("logout?scope=local", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    revoked = true;
  } catch { /* Always remove this browser's credentials, even if Auth is offline. */ }
  const response = authJson({ status: "signed_out", revoked });
  clearSessionCookies(response, new URL(request.url).protocol === "https:");
  return response;
}
