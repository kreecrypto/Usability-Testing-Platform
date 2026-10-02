import { buildMethodResults, type MethodBlock, type MethodEvidence } from "./results.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 1000;
type VersionRow = { id: string; test_id: string; version_no: number; study_mode: string; lifecycle_status: string };
type TestRow = { id: string; title: string; description: string | null };
type BlockRow = { id: string; ordinal: number; kind: MethodBlock["kind"]; title: string; config: unknown };
type ResponseRow = { id: string; session_id: string; block_id: string; response: unknown; submitted_at: string };

export class MethodResultsError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) { super(code); this.name = "MethodResultsError"; this.code = code; this.status = status; }
}

export function createMethodResultsStore(options: { supabaseUrl: string; publicKey: string; accessToken: string; fetchImpl?: typeof fetch }) {
  const base = options.supabaseUrl.trim().replace(/\/+$/, "");
  const key = options.publicKey.trim();
  const token = options.accessToken.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!base.startsWith("https://") || !key || !token) throw new Error("authenticated Supabase configuration required");
  async function readAll<T>(table: string, params: URLSearchParams): Promise<T[]> {
    const result: T[] = [];
    for (let start = 0; ; start += PAGE_SIZE) {
      const response = await fetchImpl(`${base}/rest/v1/${table}?${params}`, {
        cache: "no-store", headers: { apikey: key, authorization: `Bearer ${token}`, range: `${start}-${start + PAGE_SIZE - 1}` },
      });
      if (response.status === 401) throw new MethodResultsError("authentication_required", 401);
      if (response.status === 403) throw new MethodResultsError("permission_denied", 403);
      if (!response.ok) throw new MethodResultsError("data_request_failed", 502);
      const rows = await response.json() as T[];
      if (!Array.isArray(rows)) throw new MethodResultsError("data_request_failed", 502);
      result.push(...rows);
      if (rows.length < PAGE_SIZE) return result;
    }
  }
  async function read(testVersionId: string) {
    if (!UUID.test(testVersionId)) throw new MethodResultsError("invalid_version_id", 400);
    const versionParams = new URLSearchParams({ id: `eq.${testVersionId}`, study_mode: "eq.methods", select: "id,test_id,version_no,study_mode,lifecycle_status", limit: "1" });
    const version = (await readAll<VersionRow>("test_versions", versionParams))[0];
    if (!version) throw new MethodResultsError("not_found", 404);
    const testParams = new URLSearchParams({ id: `eq.${version.test_id}`, select: "id,title,description", limit: "1" });
    const blockParams = new URLSearchParams({ test_version_id: `eq.${version.id}`, select: "id,ordinal,kind,title,config", order: "ordinal.asc" });
    const responseParams = new URLSearchParams({ test_version_id: `eq.${version.id}`, select: "id,session_id,block_id,response,submitted_at", order: "submitted_at.asc,id.asc" });
    const [tests, blocks, responses] = await Promise.all([
      readAll<TestRow>("tests", testParams), readAll<BlockRow>("study_blocks", blockParams), readAll<ResponseRow>("study_responses", responseParams),
    ]);
    const test = tests[0];
    if (!test) throw new MethodResultsError("not_found", 404);
    const evidence: MethodEvidence[] = responses.map((row) => ({ id: row.id, sessionId: row.session_id, blockId: row.block_id,
      response: row.response, submittedAt: row.submitted_at }));
    return { testId: test.id, testVersionId: version.id, versionNo: version.version_no,
      title: test.title, description: test.description, blocks: buildMethodResults(blocks, evidence),
      evidence: evidence.map(({ id, sessionId, blockId, submittedAt }) => ({ id, sessionId, blockId, submittedAt })) };
  }
  return { read };
}
