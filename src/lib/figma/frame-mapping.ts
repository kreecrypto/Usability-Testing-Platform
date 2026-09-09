import {
  parseFigmaNodeIdentifier,
  parsePublicFigmaPrototypeUrl,
} from "./public-embed.ts";

type FetchLike = typeof fetch;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PrototypeFrameMappingV1 = Readonly<{
  version: 1;
  source: "explicit_node_ids";
  prototypeUrl: string;
  fileKey: string;
  startNodeId: string;
  successNodeIds: readonly string[];
  failureNodeIds: readonly string[];
}>;

export class FrameMappingValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "FrameMappingValidationError";
    this.field = field;
  }
}

export class FrameMappingProviderError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null = null) {
    super(code ?? "frame_mapping_persistence_failed");
    this.name = "FrameMappingProviderError";
    this.status = status;
    this.code = code;
  }
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new FrameMappingValidationError(field, `${field} is required`);
  }
  return value.trim();
}

function requiredUuid(value: unknown, field: string): string {
  const text = requiredText(value, field);
  if (!UUID_PATTERN.test(text)) {
    throw new FrameMappingValidationError(field, `${field} must be a UUID`);
  }
  return text;
}

function canonicalNodeId(value: unknown, field: string): string {
  const text = requiredText(value, field);
  try {
    return parseFigmaNodeIdentifier(text, "node-id")!;
  } catch {
    throw new FrameMappingValidationError(field, `${field} must be a valid Figma node id`);
  }
}

function requiredNodeIds(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new FrameMappingValidationError(field, `${field} must contain at least one Figma node id`);
  }

  const canonical = value.map((nodeId, index) => canonicalNodeId(nodeId, `${field}[${index}]`));
  if (new Set(canonical).size !== canonical.length) {
    throw new FrameMappingValidationError(field, `${field} must not contain duplicate node ids`);
  }
  return Object.freeze(canonical);
}

function validateDisjointTerminalTargets(
  successNodeIds: readonly string[],
  failureNodeIds: readonly string[],
): void {
  const success = new Set(successNodeIds);
  const conflicts = failureNodeIds.filter((nodeId) => success.has(nodeId));
  if (conflicts.length > 0) {
    throw new FrameMappingValidationError(
      "failureNodeIds",
      `success and failure targets conflict: ${conflicts.join(", ")}`,
    );
  }
}

export function buildPrototypeFrameMapping(input: {
  prototypeUrl: unknown;
  startNodeId?: unknown;
  successNodeIds: unknown;
  failureNodeIds: unknown;
}): PrototypeFrameMappingV1 {
  const prototypeUrl = requiredText(input.prototypeUrl, "prototypeUrl");

  let prototype;
  try {
    prototype = parsePublicFigmaPrototypeUrl(prototypeUrl);
  } catch (error) {
    throw new FrameMappingValidationError(
      "prototypeUrl",
      error instanceof Error ? error.message : "prototypeUrl is invalid",
    );
  }

  const startNodeId = input.startNodeId === undefined || input.startNodeId === null || input.startNodeId === ""
    ? prototype.startingPointNodeId ?? prototype.nodeId
    : canonicalNodeId(input.startNodeId, "startNodeId");

  if (!startNodeId) {
    throw new FrameMappingValidationError(
      "startNodeId",
      "startNodeId is required when the prototype URL has no node/start point",
    );
  }

  const successNodeIds = requiredNodeIds(input.successNodeIds, "successNodeIds");
  const failureNodeIds = requiredNodeIds(input.failureNodeIds, "failureNodeIds");
  validateDisjointTerminalTargets(successNodeIds, failureNodeIds);

  return Object.freeze({
    version: 1,
    source: "explicit_node_ids",
    prototypeUrl,
    fileKey: prototype.fileKey,
    startNodeId,
    successNodeIds,
    failureNodeIds,
  });
}

function requiredServerValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

export function createPrototypeFrameMappingPersistence(options: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}) {
  const supabaseUrl = requiredServerValue(options.supabaseUrl, "supabaseUrl").replace(/\/+$/, "");
  const anonKey = requiredServerValue(options.anonKey, "anonKey");
  const accessToken = requiredServerValue(options.accessToken, "accessToken");
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!supabaseUrl.startsWith("https://")) throw new Error("supabaseUrl must use https");

  async function save(input: {
    workspaceId: unknown;
    testVersionId: unknown;
    taskId: unknown;
    prototypeUrl: unknown;
    startNodeId?: unknown;
    successNodeIds: unknown;
    failureNodeIds: unknown;
  }): Promise<PrototypeFrameMappingV1> {
    const workspaceId = requiredUuid(input.workspaceId, "workspaceId");
    const testVersionId = requiredUuid(input.testVersionId, "testVersionId");
    const taskId = requiredUuid(input.taskId, "taskId");
    const mapping = buildPrototypeFrameMapping(input);

    const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/save_figma_frame_mapping`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        p_workspace_id: workspaceId,
        p_test_version_id: testVersionId,
        p_task_id: taskId,
        p_prototype_url: mapping.prototypeUrl,
        p_file_key: mapping.fileKey,
        p_start_node_id: mapping.startNodeId,
        p_success_node_ids: mapping.successNodeIds,
        p_failure_node_ids: mapping.failureNodeIds,
      }),
    });

    if (!response.ok) {
      let code: string | null = null;
      try {
        const body = await response.json() as { code?: unknown };
        if (typeof body.code === "string") code = body.code;
      } catch {
        // Provider details are intentionally not surfaced to the client.
      }
      throw new FrameMappingProviderError(response.status, code);
    }

    return mapping;
  }

  return { save };
}
