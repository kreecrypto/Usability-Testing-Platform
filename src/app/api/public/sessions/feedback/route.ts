import { runnerServerConfig } from "../../../../../lib/runner/public-session.ts";
import { verifyRunnerSessionProof } from "../../../../../lib/runner/session-proof.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "utp_runner_session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const item of header.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
  const taskId = Reflect.get(body, "taskId");
  const seq = Reflect.get(body, "seq");
  const openFeedback = Reflect.get(body, "openFeedback");
  if (typeof taskId !== "string" || !UUID_PATTERN.test(taskId)) return json({ error: "invalid_task_id" }, 400);
  if (seq !== null && seq !== undefined && (!Number.isSafeInteger(seq) || (seq as number) < 1 || (seq as number) > 7)) return json({ error: "invalid_seq" }, 400);
  if (openFeedback !== null && openFeedback !== undefined && typeof openFeedback !== "string") return json({ error: "invalid_feedback" }, 400);

  try {
    const config = runnerServerConfig();
    const proof = cookieValue(request, COOKIE_NAME);
    const claims = proof ? verifyRunnerSessionProof({ proof, signingKey: config.signingKey }) : null;
    if (!claims) return json({ error: "runner_session_required" }, 401);

    const response = await fetch(`${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/save_post_task_feedback`, {
      method: "POST",
      headers: {
        apikey: config.secretKey,
        authorization: `Bearer ${config.secretKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        p_session_id: claims.sessionId,
        p_task_id: taskId,
        p_seq: seq ?? null,
        p_open_feedback: typeof openFeedback === "string" ? openFeedback : null,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const providerText = await response.text();
      if (/required|disabled|range|task_not_in_session_version|terminal_task_outcome/i.test(providerText)) return json({ error: "invalid_feedback_state" }, 409);
      return json({ error: "feedback_persistence_failed" }, 502);
    }
    return json({ saved: true }, 200);
  } catch {
    return json({ error: "feedback_persistence_failed" }, 502);
  }
}
