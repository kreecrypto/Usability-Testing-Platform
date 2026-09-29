import { AuthSessionError } from "../../../../lib/auth/session.ts";
import { authJson, authError, clearSessionCookies, refreshFromRequest, refreshSession, sameOrigin, setSessionCookies } from "../../../../lib/auth/lifecycle.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return authJson({ error: "invalid_origin" }, 403);
  const token = refreshFromRequest(request);
  if (!token) return authJson({ error: "authentication_required" }, 401);
  const secure = new URL(request.url).protocol === "https:";
  try {
    const session = await refreshSession(token);
    const response = authJson({ user: session.user });
    setSessionCookies(response, session, secure);
    return response;
  } catch (error) {
    const response = authError(error);
    if (error instanceof AuthSessionError && error.status < 500 && error.status !== 429) {
      clearSessionCookies(response, secure);
      return new Response(JSON.stringify({ error: "authentication_required" }), { status: 401, headers: response.headers });
    }
    return response;
  }
}
