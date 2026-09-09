import { createPublicRunnerStore, PublicRunnerError, runnerServerConfig } from "../../../../../lib/runner/public-session.ts";
import { createSupabaseAdminFetch } from "../../../../../lib/runner/supabase-admin-fetch.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ testVersionId: string }> };

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "public, max-age=0, must-revalidate" } });
}

function errorResponse(error: unknown): Response {
  if (error instanceof PublicRunnerError) return json({ error: error.code }, error.status);
  return json({ error: "data_request_failed" }, 502);
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const config = runnerServerConfig();
    const store = createPublicRunnerStore({
      ...config,
      fetchImpl: createSupabaseAdminFetch(config.secretKey),
    });
    const { testVersionId } = await context.params;
    return json({ test: await store.snapshot(testVersionId) }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
