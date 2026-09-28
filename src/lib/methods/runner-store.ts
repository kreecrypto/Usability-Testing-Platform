import { isDeepStrictEqual } from "node:util";
import { parseMethodConfig, parseMethodResponse, parseScreenerConfig, publicMethodConfig, publicScreenerConfig, StudyContractError, type StudyKind } from "./study-contract.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VersionRow = { id: string; test_id: string; workspace_id: string; version_no: number; lifecycle_status: string; study_mode: string; screener_config: unknown; invite_only: boolean };
type TestRow = { id: string; title: string; description: string | null; status: string };
type BlockRow = { id: string; ordinal: number; kind: StudyKind; title: string; config: unknown };
type SessionRow = { id: string; workspace_id: string; test_version_id: string; status: string };
type ResponseRow = { id: string; block_id: string; response: unknown };

export class MethodRunnerError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) { super(code); this.name = "MethodRunnerError"; this.code = code; this.status = status; }
}

function uuid(value: string): string {
  if (!UUID.test(value)) throw new MethodRunnerError("invalid_id", 400);
  return value;
}

export function createMethodRunnerStore(options: { supabaseUrl: string; secretKey: string; fetchImpl?: typeof fetch }) {
  const base = options.supabaseUrl.trim().replace(/\/+$/, "");
  const key = options.secretKey.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!base.startsWith("https://") || !key) throw new Error("server Supabase configuration required");
  const headers = { apikey: key, authorization: `Bearer ${key}` };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${base}/rest/v1/${path}`, {
      ...init, cache: "no-store",
      headers: { ...headers, accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    });
    const body = await response.text();
    if (!response.ok) {
      if (response.status === 409 || /23505/.test(body)) throw new MethodRunnerError("already_submitted", 409);
      throw new MethodRunnerError("data_request_failed", 502);
    }
    return (body.trim() ? JSON.parse(body) : null) as T;
  }

  async function internalSnapshot(testVersionId: string) {
    const params = new URLSearchParams({ id: `eq.${uuid(testVersionId)}`, lifecycle_status: "eq.published", study_mode: "eq.methods", select: "id,test_id,workspace_id,version_no,lifecycle_status,study_mode,screener_config,invite_only", limit: "1" });
    const version = (await request<VersionRow[]>(`test_versions?${params}`))[0];
    if (!version) throw new MethodRunnerError("published_study_not_found", 404);
    const testParams = new URLSearchParams({ id: `eq.${version.test_id}`, status: "eq.published", select: "id,title,description,status", limit: "1" });
    const test = (await request<TestRow[]>(`tests?${testParams}`))[0];
    if (!test) throw new MethodRunnerError("published_study_not_found", 404);
    const blockParams = new URLSearchParams({ test_version_id: `eq.${version.id}`, select: "id,ordinal,kind,title,config", order: "ordinal.asc" });
    const blocks = await request<BlockRow[]>(`study_blocks?${blockParams}`);
    if (blocks.length === 0 || blocks.some((block) => block.kind === "usability_task")) throw new MethodRunnerError("published_study_not_found", 404);
    try { parseScreenerConfig(version.screener_config); for (const block of blocks) parseMethodConfig(block.kind, block.config); }
    catch { throw new MethodRunnerError("published_study_unavailable", 503); }
    return { version, test, blocks };
  }

  async function snapshot(testVersionId: string) {
    const { version, test, blocks } = await internalSnapshot(testVersionId);
    return {
      testId: test.id, testVersionId: version.id, versionNo: version.version_no,
      title: test.title, description: test.description, inviteOnly: version.invite_only,
      screener: publicScreenerConfig(parseScreenerConfig(version.screener_config)),
      blocks: blocks.map((block) => ({ id: block.id, ordinal: block.ordinal, kind: block.kind,
        title: block.title, config: publicMethodConfig(block.kind, parseMethodConfig(block.kind, block.config)) })),
    };
  }

  async function session(testVersionId: string, sessionId: string): Promise<SessionRow> {
    const params = new URLSearchParams({ id: `eq.${uuid(sessionId)}`, test_version_id: `eq.${uuid(testVersionId)}`, select: "id,workspace_id,test_version_id,status", limit: "1" });
    const row = (await request<SessionRow[]>(`sessions?${params}`))[0];
    if (!row) throw new MethodRunnerError("session_not_found", 404);
    return row;
  }

  async function progress(testVersionId: string, sessionId: string) {
    const row = await session(testVersionId, sessionId);
    const responses = await loadResponses(row);
    return { status: row.status, completedBlockIds: responses.map((response) => response.block_id) };
  }

  async function loadResponses(row: SessionRow): Promise<ResponseRow[]> {
    const params = new URLSearchParams({ session_id: `eq.${row.id}`, test_version_id: `eq.${row.test_version_id}`, select: "id,block_id,response", order: "submitted_at.asc" });
    return request<ResponseRow[]>(`study_responses?${params}`);
  }

  async function completeSession(row: SessionRow): Promise<void> {
    if (row.status === "completed") return;
    const sessionParams = new URLSearchParams({ id: `eq.${row.id}`, status: "eq.active" });
    await request<unknown>(`sessions?${sessionParams}`, {
      method: "PATCH", body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString() }),
    });
  }

  async function submit(testVersionId: string, sessionId: string, blockId: string, rawResponse: unknown) {
    const row = await session(testVersionId, sessionId);
    const { blocks } = await internalSnapshot(testVersionId);
    const block = blocks.find((item) => item.id === uuid(blockId));
    if (!block) throw new MethodRunnerError("block_not_found", 404);
    let response: Record<string, unknown>;
    try { response = parseMethodResponse(block.kind, parseMethodConfig(block.kind, block.config), rawResponse); }
    catch (error) { if (error instanceof StudyContractError) throw new MethodRunnerError(error.code, 400); throw error; }
    const current = await loadResponses(row);
    const existing = current.find((item) => item.block_id === block.id);
    if (existing) {
      if (!isDeepStrictEqual(existing.response, response)) throw new MethodRunnerError("already_submitted", 409);
      const completed = current.length === blocks.length;
      if (completed) await completeSession(row);
      return { responseId: existing.id, completed };
    }
    if (row.status !== "active") throw new MethodRunnerError("session_not_active", 409);
    const next = blocks.find((item) => !current.some((response) => response.block_id === item.id));
    if (next?.id !== block.id) throw new MethodRunnerError("block_out_of_order", 409);
    const timestamp = new Date().toISOString();
    const insertParams = new URLSearchParams({ select: "id" });
    let saved: { id: string }[];
    try {
      saved = await request<{ id: string }[]>(`study_responses?${insertParams}`, {
        method: "POST", headers: { prefer: "return=representation" },
        body: JSON.stringify({ workspace_id: row.workspace_id, test_version_id: row.test_version_id,
          session_id: row.id, block_id: block.id, response, started_at: timestamp, submitted_at: timestamp }),
      });
    } catch (error) {
      if (error instanceof MethodRunnerError && error.code === "already_submitted") {
        const afterRace = await loadResponses(row);
        const duplicate = afterRace.find((item) => item.block_id === block.id);
        if (duplicate && isDeepStrictEqual(duplicate.response, response)) {
          const completed = afterRace.length === blocks.length;
          if (completed) await completeSession(row);
          return { responseId: duplicate.id, completed };
        }
      }
      throw error;
    }
    if (!saved[0]) throw new MethodRunnerError("data_request_failed", 502);
    if (current.length + 1 === blocks.length) {
      await completeSession(row);
    }
    return { responseId: saved[0].id, completed: current.length + 1 === blocks.length };
  }

  return { snapshot, progress, submit };
}
