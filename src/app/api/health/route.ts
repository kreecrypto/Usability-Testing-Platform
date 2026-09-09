import { writePipelineLog } from "../../../lib/observability/structured-log.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DependencyState = "ok" | "misconfigured" | "unreachable";

type SupabaseConfig = {
  url: string;
  secretKey: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;
  return { url, secretKey };
}

function supabaseHeaders(secretKey: string): HeadersInit {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

async function checkSupabaseDatabase(config: SupabaseConfig | null): Promise<DependencyState> {
  if (!config) return "misconfigured";

  try {
    const response = await fetch(`${config.url}/rest/v1/sessions?select=id&limit=1`, {
      method: "GET",
      headers: supabaseHeaders(config.secretKey),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

async function checkSupabaseStorage(config: SupabaseConfig | null): Promise<DependencyState> {
  if (!config) return "misconfigured";

  try {
    const response = await fetch(`${config.url}/storage/v1/bucket`, {
      method: "GET",
      headers: supabaseHeaders(config.secretKey),
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
  const config = getSupabaseConfig();
  const [supabaseDatabase, supabaseStorage] = await Promise.all([
    checkSupabaseDatabase(config),
    checkSupabaseStorage(config),
  ]);
  const healthy = supabaseDatabase === "ok" && supabaseStorage === "ok";

  writePipelineLog(
    healthy ? "info" : "error",
    "health_check",
    {
      requestId,
      operation: "session_pipeline_health",
    },
    healthy
      ? undefined
      : new Error(`supabase_database_${supabaseDatabase}_storage_${supabaseStorage}`),
  );

  return Response.json(
    {
      ok: healthy,
      service: "usability-testing-platform",
      pipeline: "event-ingestion",
      dependencies: { supabaseDatabase, supabaseStorage },
      requestId,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
