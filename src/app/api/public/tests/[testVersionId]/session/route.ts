import { createPublicRunnerStore, PublicRunnerError, runnerServerConfig } from "../../../../../../lib/runner/public-session.ts";
import { mintRunnerSessionProof } from "../../../../../../lib/runner/session-proof.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUNNER_PROOF_TTL_SECONDS = 12 * 60 * 60;
const COOKIE_NAME = "utp_runner_session";

type Context = { params: Promise<{ testVersionId: string }> };

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store", ...(headers ?? {}) } });
}

function errorResponse(error: unknown): Response {
  if (error instanceof PublicRunnerError) return json({ error: error.code }, error.status);
  return json({ error: "data_request_failed" }, 502);
}

export async function POST(request: Request, context: Context): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
  const accepted = Reflect.get(body, "accepted");
  const consentVersion = Reflect.get(body, "consentVersion");
  const locale = Reflect.get(body, "locale");
  if (accepted !== true || typeof consentVersion !== "string" || !consentVersion.trim()) {
    return json({ error: "consent_required" }, 400);
  }

  try {
    const config = runnerServerConfig();
    const store = createPublicRunnerStore(config);
    const { testVersionId } = await context.params;
    const session = await store.startSession(testVersionId, consentVersion, typeof locale === "string" ? locale : null);
    const expiresAt = new Date(Date.now() + RUNNER_PROOF_TTL_SECONDS * 1000);
    const proof = mintRunnerSessionProof({
      signingKey: config.signingKey,
      sessionId: session.sessionId,
      participantId: session.participantId,
      testId: session.testId,
      testVersionId: session.testVersionId,
      expiresAt,
    });
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(proof)}; Path=/; Max-Age=${RUNNER_PROOF_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
    return json({ session }, 201, { "set-cookie": cookie });
  } catch (error) {
    return errorResponse(error);
  }
}
