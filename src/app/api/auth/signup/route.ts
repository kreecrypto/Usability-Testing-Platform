import { AuthSessionError, signUpWithPassword } from "../../../../lib/auth/session.ts";
import { authJson, authError, createAuthFlow, sameOrigin, setSessionCookies } from "../../../../lib/auth/lifecycle.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return authJson({ error: "invalid_origin" }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return authJson({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return authJson({ error: "invalid_body" }, 400);
  try {
    if (typeof body.password !== "string" || body.password.length < 8) throw new AuthSessionError("weak_password", 400);
    const url = new URL(request.url);
    const flow = createAuthFlow("signup", body.next, url.protocol === "https:");
    const result = await signUpWithPassword({ email: body.email, password: body.password }, {
      codeChallenge: flow.challenge, redirectTo: `${url.origin}/auth/callback`,
    });
    const response = authJson({ user: result.session?.user, confirmationRequired: !result.session }, result.session ? 201 : 202);
    if (result.session) setSessionCookies(response, result.session, url.protocol === "https:");
    else response.headers.append("set-cookie", flow.cookie);
    return response;
  } catch (error) { return authError(error); }
}
