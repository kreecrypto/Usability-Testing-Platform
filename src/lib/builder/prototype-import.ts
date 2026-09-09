import { parsePublicFigmaPrototypeUrl, type PublicFigmaPrototype } from "../figma/public-embed.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DraftPrototypeMappingV1 = Readonly<{
  schemaVersion: 1;
  provider: "figma";
  sourceUrl: string;
  embedUrl: string;
  fileKey: string;
  nodeId?: string;
  startingPointNodeId?: string;
}>;

export type DraftPrototypeVersion = Readonly<{
  id: string;
  workspaceId: string;
  testId: string;
  versionNo: number;
  prototype: DraftPrototypeMappingV1;
}>;

export class PrototypeImportError extends Error {
  code:
    | "invalid_test_id"
    | "invalid_prototype_url"
    | "test_not_found"
    | "permission_denied"
    | "data_request_failed";
  status: number;

  constructor(code: PrototypeImportError["code"], status: number, message: string = code) {
    super(message);
    this.name = "PrototypeImportError";
    this.code = code;
    this.status = status;
  }
}

type TestRow = Readonly<{
  id: string;
  workspace_id: string;
}>;

type VersionRow = Readonly<{
  id: string;
  workspace_id: string;
  test_id: string;
  version_no: number;
  lifecycle_status: string;
  figma_file_key: string | null;
  figma_start_node_id: string | null;
  prototype_mapping: Record<string, unknown>;
}>;

function requiredTestId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new PrototypeImportError("invalid_test_id", 400);
  return value;
}

function parsedPrototype(value: string): PublicFigmaPrototype {
  try {
    return parsePublicFigmaPrototypeUrl(value);
  } catch (error) {
    throw new PrototypeImportError(
      "invalid_prototype_url",
      400,
      error instanceof Error ? error.message : "invalid_prototype_url",
    );
  }
}

function toMapping(prototype: PublicFigmaPrototype): DraftPrototypeMappingV1 {
  return Object.freeze({
    schemaVersion: 1 as const,
    provider: "figma" as const,
    sourceUrl: prototype.sourceUrl,
    embedUrl: prototype.embedUrl,
    fileKey: prototype.fileKey,
    ...(prototype.nodeId ? { nodeId: prototype.nodeId } : {}),
    ...(prototype.startingPointNodeId
      ? { startingPointNodeId: prototype.startingPointNodeId }
      : {}),
  });
}

function mappingFromRow(row: VersionRow): DraftPrototypeMappingV1 | null {
  const mapping = row.prototype_mapping;
  if (
    mapping?.schemaVersion !== 1 ||
    mapping?.provider !== "figma" ||
    typeof mapping.sourceUrl !== "string" ||
    typeof mapping.embedUrl !== "string" ||
    typeof mapping.fileKey !== "string"
  ) {
    return null;
  }
  return Object.freeze({
    schemaVersion: 1,
    provider: "figma",
    sourceUrl: mapping.sourceUrl,
    embedUrl: mapping.embedUrl,
    fileKey: mapping.fileKey,
    ...(typeof mapping.nodeId === "string" ? { nodeId: mapping.nodeId } : {}),
    ...(typeof mapping.startingPointNodeId === "string"
      ? { startingPointNodeId: mapping.startingPointNodeId }
      : {}),
  });
}

export function validatePrototypeImport(prototypeUrl: string): DraftPrototypeMappingV1 {
  return toMapping(parsedPrototype(prototypeUrl));
}

export function createDraftPrototypeStore(options: {
  supabaseUrl: string;
  publicKey: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}) {
  const supabaseUrl = options.supabaseUrl.trim().replace(/\/+$/, "");
  const publicKey = options.publicKey.trim();
  const accessToken = options.accessToken.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!supabaseUrl.startsWith("https://") || !publicKey || !accessToken) {
    throw new Error("authenticated Supabase configuration is required");
  }

  const headers = Object.freeze({
    apikey: publicKey,
    authorization: `Bearer ${accessToken}`,
  });

  async function rows<T>(
    table: "tests" | "test_versions",
    query: URLSearchParams,
    init?: RequestInit,
  ): Promise<T[]> {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
      ...init,
      headers: {
        ...headers,
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (response.status === 401) throw new PrototypeImportError("data_request_failed", 401);
    if (response.status === 403) throw new PrototypeImportError("permission_denied", 403);
    if (!response.ok) throw new PrototypeImportError("data_request_failed", 502);
    const text = await response.text();
    return text.trim() ? (JSON.parse(text) as T[]) : [];
  }

  async function getTest(testId: string): Promise<TestRow> {
    testId = requiredTestId(testId);
    const result = await rows<TestRow>(
      "tests",
      new URLSearchParams({
        id: `eq.${testId}`,
        select: "id,workspace_id",
        limit: "1",
      }),
    );
    if (!result[0]) throw new PrototypeImportError("test_not_found", 404);
    return result[0];
  }

  async function findDraft(testId: string): Promise<VersionRow | null> {
    const result = await rows<VersionRow>(
      "test_versions",
      new URLSearchParams({
        test_id: `eq.${requiredTestId(testId)}`,
        lifecycle_status: "eq.draft",
        select:
          "id,workspace_id,test_id,version_no,lifecycle_status,figma_file_key,figma_start_node_id,prototype_mapping",
        order: "version_no.desc",
        limit: "1",
      }),
    );
    return result[0] ?? null;
  }

  async function getDraft(testId: string): Promise<DraftPrototypeVersion | null> {
    const test = await getTest(testId);
    const draft = await findDraft(testId);
    if (!draft) return null;
    const mapping = mappingFromRow(draft);
    if (!mapping) return null;
    return Object.freeze({
      id: draft.id,
      workspaceId: test.workspace_id,
      testId: test.id,
      versionNo: draft.version_no,
      prototype: mapping,
    });
  }

  async function saveDraft(
    testId: string,
    prototypeUrl: string,
  ): Promise<DraftPrototypeVersion> {
    const test = await getTest(testId);
    const prototype = validatePrototypeImport(prototypeUrl);
    const startNodeId = prototype.startingPointNodeId ?? prototype.nodeId ?? null;
    const draft = await findDraft(testId);

    if (draft) {
      const updated = await rows<VersionRow>(
        "test_versions",
        new URLSearchParams({
          id: `eq.${draft.id}`,
          lifecycle_status: "eq.draft",
          select:
            "id,workspace_id,test_id,version_no,lifecycle_status,figma_file_key,figma_start_node_id,prototype_mapping",
        }),
        {
          method: "PATCH",
          headers: { prefer: "return=representation" },
          body: JSON.stringify({
            figma_file_key: prototype.fileKey,
            figma_start_node_id: startNodeId,
            prototype_mapping: prototype,
          }),
        },
      );
      if (!updated[0]) throw new PrototypeImportError("data_request_failed", 502);
      return Object.freeze({
        id: updated[0].id,
        workspaceId: test.workspace_id,
        testId: test.id,
        versionNo: updated[0].version_no,
        prototype,
      });
    }

    const latest = await rows<Pick<VersionRow, "version_no">>(
      "test_versions",
      new URLSearchParams({
        test_id: `eq.${test.id}`,
        select: "version_no",
        order: "version_no.desc",
        limit: "1",
      }),
    );
    const versionNo = (latest[0]?.version_no ?? 0) + 1;
    const created = await rows<VersionRow>(
      "test_versions",
      new URLSearchParams({
        select:
          "id,workspace_id,test_id,version_no,lifecycle_status,figma_file_key,figma_start_node_id,prototype_mapping",
      }),
      {
        method: "POST",
        headers: { prefer: "return=representation" },
        body: JSON.stringify({
          workspace_id: test.workspace_id,
          test_id: test.id,
          version_no: versionNo,
          lifecycle_status: "draft",
          provider: "figma",
          figma_file_key: prototype.fileKey,
          figma_start_node_id: startNodeId,
          figma_version_id: null,
          prototype_mapping: prototype,
          event_schema_version: "v2",
        }),
      },
    );
    if (!created[0]) throw new PrototypeImportError("data_request_failed", 502);
    return Object.freeze({
      id: created[0].id,
      workspaceId: test.workspace_id,
      testId: test.id,
      versionNo: created[0].version_no,
      prototype,
    });
  }

  return Object.freeze({ getDraft, saveDraft });
}
