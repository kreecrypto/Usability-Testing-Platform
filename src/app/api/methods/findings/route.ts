import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../lib/auth/session.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEVERITIES = new Set(["critical", "high", "medium", "low"]);

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const token = accessTokenFromRequest(request);
  if (!token) return json({ error: "authentication_required" }, 401);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
  const string = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const testVersionId = string("testVersionId");
  const studyResponseId = string("studyResponseId");
  const title = string("title");
  const problem = string("problem");
  const severity = string("severity");
  if (!UUID.test(testVersionId) || !UUID.test(studyResponseId) || !title || !problem ||
      title.length > 240 || problem.length > 10000 || !SEVERITIES.has(severity)) {
    return json({ error: "invalid_method_finding" }, 400);
  }
  const config = publicSupabaseConfig();
  let response: Response;
  try {
    response = await fetch(`${config.url}/rest/v1/rpc/create_method_finding`, {
      method: "POST", cache: "no-store",
      headers: { apikey: config.key, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        p_test_version_id: testVersionId, p_study_response_id: studyResponseId,
        p_title: title, p_problem: problem,
        p_interpretation: string("researcherInterpretation"),
        p_recommendation: string("recommendation"), p_severity: severity,
      }),
    });
  } catch { return json({ error: "finding_unavailable" }, 502); }
  if (response.status === 401) return json({ error: "authentication_required" }, 401);
  if (response.status === 403 || response.status === 404) return json({ error: "method_evidence_not_found_or_denied" }, 403);
  if (!response.ok) return json({ error: "finding_unavailable" }, 502);
  const findingId = await response.json().catch(() => null) as unknown;
  if (typeof findingId !== "string" || !UUID.test(findingId)) return json({ error: "finding_unavailable" }, 502);
  return json({ findingId }, 201);
}
