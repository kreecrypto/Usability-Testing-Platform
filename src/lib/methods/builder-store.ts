import { parseMethodConfig, parseScreenerConfig, StudyContractError, type StudyKind } from "./study-contract.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TestRow = { id: string; workspace_id: string; status: string };
type VersionRow = { id: string; workspace_id: string; test_id: string; version_no: number; lifecycle_status: string; study_mode: string; screener_config: unknown; invite_only: boolean };
export type MethodBlockRow = { id: string; workspace_id: string; test_version_id: string; ordinal: number; kind: StudyKind; title: string; config: unknown };

export class MethodBuilderError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) { super(code); this.name = "MethodBuilderError"; this.code = code; this.status = status; }
}

function requiredUuid(value: string): string {
  if (!UUID.test(value)) throw new MethodBuilderError("invalid_id", 400);
  return value;
}

function title(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200) throw new MethodBuilderError("invalid_title", 400);
  return value.trim();
}

function kind(value: unknown): Exclude<StudyKind, "usability_task"> {
  if (value !== "survey" && value !== "card_sort" && value !== "tree_test") throw new MethodBuilderError("invalid_kind", 400);
  return value;
}

export function createMethodBuilderStore(options: { supabaseUrl: string; publicKey: string; accessToken: string; fetchImpl?: typeof fetch }) {
  const base = options.supabaseUrl.trim().replace(/\/+$/, "");
  const publicKey = options.publicKey.trim();
  const accessToken = options.accessToken.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!base.startsWith("https://") || !publicKey || !accessToken) throw new Error("authenticated Supabase configuration is required");
  const headers = { apikey: publicKey, authorization: `Bearer ${accessToken}` };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${base}/rest/v1/${path}`, {
      ...init, cache: "no-store",
      headers: { ...headers, accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    });
    const body = await response.text();
    if (response.status === 401) throw new MethodBuilderError("authentication_required", 401);
    if (response.status === 403) throw new MethodBuilderError("permission_denied", 403);
    if (!response.ok) throw new MethodBuilderError("data_request_failed", 502);
    return (body.trim() ? JSON.parse(body) : null) as T;
  }

  async function testRow(testId: string): Promise<TestRow> {
    const params = new URLSearchParams({ id: `eq.${requiredUuid(testId)}`, select: "id,workspace_id,status", limit: "1" });
    const row = (await request<TestRow[]>(`tests?${params}`))[0];
    if (!row) throw new MethodBuilderError("test_not_found", 404);
    return row;
  }

  async function latestVersion(testId: string): Promise<VersionRow | null> {
    const params = new URLSearchParams({ test_id: `eq.${requiredUuid(testId)}`, select: "id,workspace_id,test_id,version_no,lifecycle_status,study_mode,screener_config,invite_only", order: "version_no.desc", limit: "1" });
    return (await request<VersionRow[]>(`test_versions?${params}`))[0] ?? null;
  }

  async function publishedVersion(testId: string): Promise<VersionRow | null> {
    await testRow(testId);
    const params = new URLSearchParams({ test_id: `eq.${requiredUuid(testId)}`, lifecycle_status: "eq.published", study_mode: "eq.methods",
      select: "id,workspace_id,test_id,version_no,lifecycle_status,study_mode,screener_config,invite_only", order: "version_no.desc", limit: "1" });
    return (await request<VersionRow[]>(`test_versions?${params}`))[0] ?? null;
  }

  async function blocks(versionId: string): Promise<MethodBlockRow[]> {
    const params = new URLSearchParams({ test_version_id: `eq.${versionId}`, select: "id,workspace_id,test_version_id,ordinal,kind,title,config", order: "ordinal.asc" });
    return request<MethodBlockRow[]>(`study_blocks?${params}`);
  }

  async function overview(testId: string) {
    const test = await testRow(testId);
    const version = await latestVersion(test.id);
    if (version && version.study_mode !== "methods") throw new MethodBuilderError("test_uses_target_builder", 409);
    return { version, blocks: version ? await blocks(version.id) : [] };
  }

  async function initialize(testId: string) {
    const test = await testRow(testId);
    if (test.status === "archived" || test.status === "closed") throw new MethodBuilderError("test_unavailable", 409);
    const version = await latestVersion(test.id);
    if (version?.study_mode !== undefined && version.study_mode !== "methods") throw new MethodBuilderError("test_uses_target_builder", 409);
    if (version?.lifecycle_status === "draft") return overview(testId);
    if (version?.lifecycle_status === "published") {
      await request<unknown>("rpc/create_draft_from_published", { method: "POST", body: JSON.stringify({ p_test_id: test.id }) });
      return overview(testId);
    }
    const params = new URLSearchParams({ select: "id,workspace_id,test_id,version_no,lifecycle_status,study_mode,screener_config,invite_only" });
    const rows = await request<VersionRow[]>(`test_versions?${params}`, {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({ workspace_id: test.workspace_id, test_id: test.id, version_no: (version?.version_no ?? 0) + 1, lifecycle_status: "draft", study_mode: "methods", invite_only: true }),
    });
    if (!rows[0]) throw new MethodBuilderError("data_request_failed", 502);
    return { version: rows[0], blocks: [] };
  }

  async function addBlock(testId: string, input: { kind: unknown; title: unknown; config: unknown }) {
    const state = await overview(testId);
    if (!state.version || state.version.lifecycle_status !== "draft") throw new MethodBuilderError("draft_required", 409);
    const blockKind = kind(input.kind);
    let config;
    try { config = parseMethodConfig(blockKind, input.config); }
    catch (error) { if (error instanceof StudyContractError) throw new MethodBuilderError(error.code, 400); throw error; }
    const params = new URLSearchParams({ select: "id,workspace_id,test_version_id,ordinal,kind,title,config" });
    const rows = await request<MethodBlockRow[]>(`study_blocks?${params}`, {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({ workspace_id: state.version.workspace_id, test_version_id: state.version.id,
        ordinal: Math.max(0, ...state.blocks.map((block) => block.ordinal)) + 1,
        kind: blockKind, title: title(input.title), config }),
    });
    if (!rows[0]) throw new MethodBuilderError("data_request_failed", 502);
    return rows[0];
  }

  async function updateBlock(testId: string, blockId: string, input: { title: unknown; config: unknown }) {
    const state = await overview(testId);
    if (!state.version || state.version.lifecycle_status !== "draft") throw new MethodBuilderError("draft_required", 409);
    const block = state.blocks.find((item) => item.id === requiredUuid(blockId));
    if (!block) throw new MethodBuilderError("block_not_found", 404);
    let config;
    try { config = parseMethodConfig(block.kind, input.config); }
    catch (error) { if (error instanceof StudyContractError) throw new MethodBuilderError(error.code, 400); throw error; }
    const params = new URLSearchParams({ id: `eq.${block.id}`, test_version_id: `eq.${state.version.id}`, select: "id,workspace_id,test_version_id,ordinal,kind,title,config" });
    const rows = await request<MethodBlockRow[]>(`study_blocks?${params}`, {
      method: "PATCH", headers: { prefer: "return=representation" },
      body: JSON.stringify({ title: title(input.title), config, updated_at: new Date().toISOString() }),
    });
    if (!rows[0]) throw new MethodBuilderError("block_not_found", 404);
    return rows[0];
  }

  async function deleteBlock(testId: string, blockId: string) {
    const state = await overview(testId);
    if (!state.version || state.version.lifecycle_status !== "draft") throw new MethodBuilderError("draft_required", 409);
    const block = state.blocks.find((item) => item.id === requiredUuid(blockId));
    if (!block) throw new MethodBuilderError("block_not_found", 404);
    const params = new URLSearchParams({ id: `eq.${block.id}`, test_version_id: `eq.${state.version.id}` });
    await request<unknown>(`study_blocks?${params}`, { method: "DELETE" });
  }

  async function saveScreener(testId: string, rawConfig: unknown, inviteOnly: unknown) {
    const state = await overview(testId);
    if (!state.version || state.version.lifecycle_status !== "draft") throw new MethodBuilderError("draft_required", 409);
    if (typeof inviteOnly !== "boolean") throw new MethodBuilderError("invalid_invite_only", 400);
    let screenerConfig;
    try { screenerConfig = parseScreenerConfig(rawConfig); }
    catch (error) { if (error instanceof StudyContractError) throw new MethodBuilderError(error.code, 400); throw error; }
    const params = new URLSearchParams({ id: `eq.${state.version.id}`, lifecycle_status: "eq.draft", select: "id,workspace_id,test_id,version_no,lifecycle_status,study_mode,screener_config,invite_only" });
    const rows = await request<VersionRow[]>(`test_versions?${params}`, {
      method: "PATCH", headers: { prefer: "return=representation" },
      body: JSON.stringify({ screener_config: screenerConfig, invite_only: inviteOnly }),
    });
    if (!rows[0]) throw new MethodBuilderError("draft_required", 409);
    return rows[0];
  }

  return { overview, publishedVersion, initialize, addBlock, updateBlock, deleteBlock, saveScreener };
}
