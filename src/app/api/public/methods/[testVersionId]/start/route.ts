import { createHash } from "node:crypto";
import { createMethodRunnerStore, MethodRunnerError } from "../../../../../../lib/methods/runner-store.ts";
import { runnerServerConfig } from "../../../../../../lib/runner/public-session.ts";
import { mintRunnerSessionProof } from "../../../../../../lib/runner/session-proof.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ testVersionId: string }> };
type StartRow = { eligible: boolean; participant_id: string | null; session_id: string | null; test_id: string; test_version_id: string };
const TTL_SECONDS = 12 * 60 * 60;

function json(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store", ...(headers ?? {}) } });
}

export async function POST(request: Request, route: Context): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
  if (body.accepted !== true) return json({ error: "consent_required" }, 400);
  const token = typeof body.inviteToken === "string" ? body.inviteToken : "";
  if (token && !/^[A-Za-z0-9_-]{43}$/.test(token)) return json({ error: "invalid_invite" }, 400);
  const answers = body.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers) ||
    Object.values(answers).some((answer) => typeof answer !== "string")) return json({ error: "invalid_screener_answers" }, 400);
  try {
    const { testVersionId } = await route.params;
    const config = runnerServerConfig();
    const store = createMethodRunnerStore({ supabaseUrl: config.supabaseUrl, secretKey: config.secretKey });
    const snapshot = await store.snapshot(testVersionId);
    if (snapshot.inviteOnly && !token) return json({ error: "invite_required" }, 400);
    const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/start_method_participant_session`, {
      method: "POST", cache: "no-store",
      headers: { apikey: config.secretKey, authorization: `Bearer ${config.secretKey}`, "content-type": "application/json" },
      body: JSON.stringify({ p_test_version_id: testVersionId,
        p_token_hash: token ? createHash("sha256").update(token).digest("hex") : null,
        p_answers: answers, p_consent_version: "utp-privacy-v1",
        p_locale: typeof body.locale === "string" ? body.locale.slice(0, 32) : null }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      const code = data.message === "invite_unavailable" ? "invite_unavailable" : "session_start_failed";
      return json({ error: code }, code === "invite_unavailable" ? 409 : 502);
    }
    const rows = await response.json() as StartRow[];
    const session = rows[0];
    if (!session) return json({ error: "session_start_failed" }, 502);
    if (!session.eligible) return json({ eligible: false }, 200);
    if (!session.session_id || !session.participant_id || session.test_version_id !== testVersionId) return json({ error: "session_start_failed" }, 502);
    const proof = mintRunnerSessionProof({ signingKey: config.signingKey,
      sessionId: session.session_id, participantId: session.participant_id,
      testId: session.test_id, testVersionId: session.test_version_id,
      expiresAt: new Date(Date.now() + TTL_SECONDS * 1000) });
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return json({ eligible: true }, 201, { "set-cookie": `utp_runner_session=${encodeURIComponent(proof)}; Path=/; Max-Age=${TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}` });
  } catch (error) {
    if (error instanceof MethodRunnerError) return json({ error: error.code }, error.status);
    return json({ error: "session_start_failed" }, 502);
  }
}
