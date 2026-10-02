import { createMethodRunnerStore, MethodRunnerError } from "../../../../../lib/methods/runner-store.ts";
import { runnerServerConfig } from "../../../../../lib/runner/public-session.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ testVersionId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const config = runnerServerConfig();
    const store = createMethodRunnerStore({ supabaseUrl: config.supabaseUrl, secretKey: config.secretKey });
    const snapshot = await store.snapshot((await context.params).testVersionId);
    return Response.json({ test: snapshot }, { headers: { "cache-control": "public, max-age=0, must-revalidate" } });
  } catch (error) {
    if (error instanceof MethodRunnerError) return Response.json({ error: error.code }, { status: error.status });
    return Response.json({ error: "data_request_failed" }, { status: 502 });
  }
}
