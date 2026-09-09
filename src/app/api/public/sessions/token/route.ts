import { createPublicRunnerStore, PublicRunnerError, runnerServerConfig } from "../../../../../lib/runner/public-session.ts";
import { verifyRunnerSessionProof } from "../../../../../lib/runner/session-proof.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "utp_runner_session";

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
  try {
    const config = runnerServerConfig();
    const proof = cookieValue(request, COOKIE_NAME);
    const claims = proof ? verifyRunnerSessionProof({ proof, signingKey: config.signingKey }) : null;
    if (!claims) return json({ error: "runner_session_required" }, 401);
    const store = createPublicRunnerStore(config);
    const credential = await store.refreshIngestionToken(claims);
    return json({ ingestionToken: credential.token, ingestionTokenExpiresAt: credential.expiresAt }, 200);
  } catch (error) {
    if (error instanceof PublicRunnerError) return json({ error: error.code }, error.status);
    return json({ error: "data_request_failed" }, 502);
  }
}
