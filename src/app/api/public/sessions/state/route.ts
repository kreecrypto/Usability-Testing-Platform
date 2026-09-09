import { createPublicRunnerStore, PublicRunnerError, runnerServerConfig } from "../../../../../lib/runner/public-session.ts";
import { verifyRunnerSessionProof } from "../../../../../lib/runner/session-proof.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "utp_runner_session";

type FeedbackMarkerRow = Readonly<{ task_id: string; feedback_submitted_at: string | null }>;

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const item of header.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

async function feedbackMarkers(config: ReturnType<typeof runnerServerConfig>, sessionId: string): Promise<Map<string, string | null>> {
  const query = new URLSearchParams({
    session_id: `eq.${sessionId}`,
    select: "task_id,feedback_submitted_at",
  });
  const response = await fetch(`${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/task_sessions?${query}`, {
    headers: {
      apikey: config.secretKey,
      authorization: `Bearer ${config.secretKey}`,
      accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("task_session_state_failed");
  const rows = await response.json() as FeedbackMarkerRow[];
  return new Map(rows.map((row) => [row.task_id, row.feedback_submitted_at]));
}

export async function GET(request: Request): Promise<Response> {
  try {
    const config = runnerServerConfig();
    const proof = cookieValue(request, COOKIE_NAME);
    const claims = proof
      ? verifyRunnerSessionProof({ proof, signingKey: config.signingKey })
      : null;
    if (!claims) return json({ error: "runner_session_required" }, 401);

    const store = createPublicRunnerStore(config);
    const state = await store.sessionState(claims);
    const markers = await feedbackMarkers(config, claims.sessionId);
    return json({
      context: {
        sessionId: claims.sessionId,
        participantId: claims.participantId,
        testId: claims.testId,
        testVersionId: claims.testVersionId,
      },
      state: {
        ...state,
        taskStates: state.taskStates.map((task) => ({
          ...task,
          feedbackSubmittedAt: markers.get(task.taskId) ?? null,
        })),
      },
    }, 200);
  } catch (error) {
    if (error instanceof PublicRunnerError) return json({ error: error.code }, error.status);
    return json({ error: "data_request_failed" }, 502);
  }
}
