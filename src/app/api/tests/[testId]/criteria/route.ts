import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createSuccessCriteriaReader, SuccessCriteriaError } from "../../../../../lib/builder/success-criteria.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ testId: string }> };

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const accessToken = accessTokenFromRequest(request);
    if (!accessToken) return json({ error: "authentication_required" }, 401);
    const config = publicSupabaseConfig();
    const reader = createSuccessCriteriaReader({
      supabaseUrl: config.url,
      publicKey: config.key,
      accessToken,
    });
    const { testId } = await context.params;
    return json({ draft: await reader.getDraft(testId) }, 200);
  } catch (error) {
    if (error instanceof SuccessCriteriaError) {
      return json({ error: error.code }, error.status);
    }
    return json({ error: "data_request_failed" }, 502);
  }
}
