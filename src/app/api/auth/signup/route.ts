import {
  accessCookieHeader,
  AuthSessionError,
  signUpWithPassword,
} from "../../../../lib/auth/session.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      ...headers,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
  const input = body as Record<string, unknown>;
  try {
    const result = await signUpWithPassword({ email: input.email, password: input.password });
    if (!result.session) {
      return json({ user: result.user, confirmationRequired: true }, 202);
    }
    const secure = new URL(request.url).protocol === "https:";
    return json(
      { user: result.user, confirmationRequired: false },
      201,
      { "set-cookie": accessCookieHeader(result.session.accessToken, result.session.expiresIn, secure) },
    );
  } catch (error) {
    if (error instanceof AuthSessionError) return json({ error: error.code }, error.status);
    return json({ error: "auth_unavailable" }, 503);
  }
}
