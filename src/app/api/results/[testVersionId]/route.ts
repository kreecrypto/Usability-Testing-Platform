import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createResultsStore, ResultsStoreError } from "../../../../../lib/analytics/results-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ testVersionId: string }> },
): Promise<Response> {
  try {
    const accessToken = accessTokenFromRequest(request);
    if (!accessToken) return json({ error: "authentication_required" }, 401);
    const { testVersionId } = await context.params;
    const config = publicSupabaseConfig();
    const model = await createResultsStore({
      supabaseUrl: config.url,
      anonKey: config.key,
      accessToken,
    }).read(testVersionId);
    return json({ results: model });
  } catch (error) {
    if (error instanceof ResultsStoreError) return json({ error: error.code }, error.status);
    return json({ error: "results_unavailable" }, 502);
  }
}
