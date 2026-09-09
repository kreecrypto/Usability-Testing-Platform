import { writePipelineLog } from "../../../lib/observability/structured-log.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DependencyState = "ok" | "misconfigured" | "unreachable";

async function checkSupabase(): Promise<DependencyState> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) return "misconfigured";

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/sessions?select=id&limit=1`, {
      method: "GET",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function GET(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
  const supabase = await checkSupabase();
  const healthy = supabase === "ok";

  writePipelineLog(healthy ? "info" : "error", "health_check", {
    requestId,
    operation: "session_pipeline_health",
  }, healthy ? undefined : new Error(`supabase_${supabase}`));

  return Response.json(
    {
      ok: healthy,
      service: "usability-testing-platform",
      pipeline: "event-ingestion",
      dependencies: { supabase },
      requestId,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
