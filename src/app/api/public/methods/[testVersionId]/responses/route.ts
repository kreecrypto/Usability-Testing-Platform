import { createMethodRunnerStore, MethodRunnerError } from "../../../../../../lib/methods/runner-store.ts";
import { runnerServerConfig } from "../../../../../../lib/runner/public-session.ts";
import { verifyRunnerSessionProof } from "../../../../../../lib/runner/session-proof.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ testVersionId: string }> };

function cookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const part = header.split(";").map((item) => item.trim()).find((item) => item.startsWith("utp_runner_session="));
  return part ? decodeURIComponent(part.slice("utp_runner_session=".length)) : null;
}

function context(request: Request, testVersionId: string) {
  const config = runnerServerConfig();
  const proof = cookie(request);
  const claims = proof ? verifyRunnerSessionProof({ proof, signingKey: config.signingKey }) : null;
  if (!claims || claims.testVersionId !== testVersionId) throw new MethodRunnerError("runner_session_required", 401);
  return { config, claims };
}

function fail(error: unknown): Response {
  if (error instanceof MethodRunnerError) return Response.json({ error: error.code }, { status: error.status });
  return Response.json({ error: "data_request_failed" }, { status: 502 });
}

export async function GET(request: Request, route: Context): Promise<Response> {
  try {
    const { testVersionId } = await route.params;
    const { config, claims } = context(request, testVersionId);
    const store = createMethodRunnerStore({ supabaseUrl: config.supabaseUrl, secretKey: config.secretKey });
    return Response.json(await store.progress(testVersionId, claims.sessionId), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request, route: Context): Promise<Response> {
  try {
    const { testVersionId } = await route.params;
    const { config, claims } = context(request, testVersionId);
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; }
    catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "invalid_body" }, { status: 400 });
    const store = createMethodRunnerStore({ supabaseUrl: config.supabaseUrl, secretKey: config.secretKey });
    const result = await store.submit(testVersionId, claims.sessionId, String(body.blockId ?? ""), body.response);
    return Response.json(result, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
