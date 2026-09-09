import {
  accessCookieHeader,
  AuthSessionError,
  signInWithPassword,
} from "../../../../lib/auth/session.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
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
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_body" }, 400);
  }

  try {
    const input = body as Record<string, unknown>;
    const session = await signInWithPassword({ email: input.email, password: input.password });
    const secure = new URL(request.url).protocol === "https:";
    return json(
      { user: session.user },
      200,
      { "set-cookie": accessCookieHeader(session.accessToken, session.expiresIn, secure) },
    );
  } catch (error) {
    if (error instanceof AuthSessionError) {
      return json({ error: error.code }, error.status);
    }
    return json({ error: "auth_unavailable" }, 503);
  }
}
