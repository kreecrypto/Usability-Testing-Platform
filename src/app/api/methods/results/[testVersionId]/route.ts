import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createMethodResultsStore, MethodResultsError } from "../../../../../lib/methods/results-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ testVersionId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const token = accessTokenFromRequest(request);
    if (!token) return Response.json({ error: "authentication_required" }, { status: 401 });
    const config = publicSupabaseConfig();
    const store = createMethodResultsStore({ supabaseUrl: config.url, publicKey: config.key, accessToken: token });
    const model = await store.read((await context.params).testVersionId);
    return Response.json({ results: model }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MethodResultsError) return Response.json({ error: error.code }, { status: error.status });
    return Response.json({ error: "results_unavailable" }, { status: 502 });
  }
}
