import {
  AuthSessionError,
  signInWithPassword,
} from "../../../../lib/auth/session.ts";

import { authRequest, sameOrigin, setSessionCookies } from "../../../../lib/auth/lifecycle.ts";

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
  if (!sameOrigin(request)) return json({ error: "invalid_origin" }, 403);
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
    if (typeof input.expectedUserId === "string" && input.expectedUserId !== session.user.id) {
      await authRequest("logout?scope=local", { method: "POST", headers: { authorization: `Bearer ${session.accessToken}` } }).catch(() => undefined);
      return json({ error: "account_mismatch" }, 409);
    }
    const response = json({ user: session.user }, 200);
    setSessionCookies(response, session, new URL(request.url).protocol === "https:");
    return response;
  } catch (error) {
    if (error instanceof AuthSessionError) {
      return json({ error: error.code }, error.status);
    }
    return json({ error: "auth_unavailable" }, 503);
  }
}
