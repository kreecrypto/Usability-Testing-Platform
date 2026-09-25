import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../lib/auth/session.ts";
import { createReportStore, ReportStoreError } from "../../../../lib/reports/store.ts";

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
    const report = await createReportStore({
      supabaseUrl: config.url,
      anonKey: config.key,
      accessToken,
    }).read(testVersionId);
    return json({ report });
  } catch (error) {
    if (error instanceof ReportStoreError) return json({ error: error.message, code: error.code }, error.status);
    return json({ error: "report_unavailable" }, 502);
  }
}
