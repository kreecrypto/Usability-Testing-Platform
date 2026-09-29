import { authJson, authError, authRequest, createAuthFlow, sameOrigin } from "../../../../lib/auth/lifecycle.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return authJson({ error: "invalid_origin" }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return authJson({ error: "invalid_json" }, 400); }
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) return authJson({ error: "invalid_email" }, 400);
  try {
    const url = new URL(request.url);
    const flow = createAuthFlow("recovery", "/projects", url.protocol === "https:");
    await authRequest(`recover?redirect_to=${encodeURIComponent(`${url.origin}/auth/callback`)}`, {
      method: "POST", body: JSON.stringify({ email, code_challenge: flow.challenge, code_challenge_method: "s256" }),
    });
    const response = authJson({ status: "requested" });
    response.headers.append("set-cookie", flow.cookie);
    return response;
  } catch (error) { return authError(error); }
}
