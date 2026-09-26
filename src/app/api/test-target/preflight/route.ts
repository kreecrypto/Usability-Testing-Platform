import { preflightTestTarget, TestTargetImportError } from "../../../../lib/builder/test-target-import.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
  const input = body as Record<string, unknown>;
  try {
    const target = preflightTestTarget({
      url: String(input.targetUrl ?? ""),
      ownership: input.ownership === "owned" ? "owned" : input.ownership === "external" ? "external" : undefined,
      environment: input.environment === "uat" ? "uat" : input.environment === "production" ? "production" : undefined,
    });
    return json({ target }, 200);
  } catch (error) {
    if (error instanceof TestTargetImportError) return json({ error: error.code }, error.status);
    return json({ error: "preflight_failed" }, 400);
  }
}
