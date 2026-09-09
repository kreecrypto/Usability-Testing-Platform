import {
  accessTokenFromRequest,
  AuthSessionError,
  validateAccessToken,
} from "../../../../lib/auth/session.ts";

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
  try {
    const user = await validateAccessToken(accessToken);
    return json({ user }, 200);
  } catch (error) {
    if (error instanceof AuthSessionError) {
      return json({ error: error.code }, error.status);
    }
    return json({ error: "auth_unavailable" }, 503);
  }
}
