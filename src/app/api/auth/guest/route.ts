import {
  accessCookieHeader,
  AuthSessionError,
  signInAnonymously,
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
  try {
    const session = await signInAnonymously();
    const secure = new URL(request.url).protocol === "https:";
    return json(
      {
        user: session.user,
        mode: "temporary_researcher",
      },
      201,
      { "set-cookie": accessCookieHeader(session.accessToken, session.expiresIn, secure) },
    );
  } catch (error) {
    if (error instanceof AuthSessionError) {
      return json({ error: error.code }, error.status);
    }
    return json({ error: "auth_unavailable" }, 503);
  }
}
