const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VersionRow = {
  id: string;
  workspace_id: string;
  test_id: string;
  lifecycle_status: string;
  figma_start_node_id: string | null;
  prototype_mapping: Record<string, unknown> | null;
};

type TaskRuleRow = {
  id: string;
  workspace_id: string;
  test_version_id: string;
  ordinal: number;
  title: string;
  success_rule: unknown;
  failure_rule: unknown;
};

export type SuccessCriteriaTask = Readonly<{
  id: string;
  ordinal: number;
  title: string;
  successNodeIds: readonly string[];
  failureNodeIds: readonly string[];
  editable: boolean;
}>;

export type SuccessCriteriaDraft = Readonly<{
  workspaceId: string;
  testVersionId: string;
  prototypeUrl: string;
  startNodeId: string;
  tasks: readonly SuccessCriteriaTask[];
}>;

export class SuccessCriteriaError extends Error {
  code: "invalid_test_id" | "draft_not_found" | "prototype_not_configured" | "permission_denied" | "data_request_failed";
  status: number;

  constructor(code: SuccessCriteriaError["code"], status: number) {
    super(code);
    this.name = "SuccessCriteriaError";
    this.code = code;
    this.status = status;
  }
}

function ruleNodeIds(rule: unknown): { nodeIds: string[]; editable: boolean } {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return { nodeIds: [], editable: true };
  const value = rule as Record<string, unknown>;
  if (Object.keys(value).length === 0) return { nodeIds: [], editable: true };
  if (value.type !== "presented_node" || !Array.isArray(value.nodeIds)) return { nodeIds: [], editable: false };
  return {
    nodeIds: value.nodeIds.filter((nodeId): nodeId is string => typeof nodeId === "string"),
    editable: true,
  };
}

function prototypeSource(mapping: Record<string, unknown> | null): string | null {
  if (!mapping) return null;
  for (const key of ["prototypeUrl", "sourceUrl"]) {
    const value = mapping[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function createSuccessCriteriaReader(options: {
  supabaseUrl: string;
  publicKey: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}) {
  const supabaseUrl = options.supabaseUrl.trim().replace(/\/+$/, "");
  const publicKey = options.publicKey.trim();
  const accessToken = options.accessToken.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!supabaseUrl.startsWith("https://") || !publicKey || !accessToken) throw new Error("authenticated Supabase configuration is required");

  async function rows<T>(path: string): Promise<T[]> {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/${path}`, {
      headers: { apikey: publicKey, authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (response.status === 401) throw new SuccessCriteriaError("data_request_failed", 401);
    if (response.status === 403) throw new SuccessCriteriaError("permission_denied", 403);
    if (!response.ok) throw new SuccessCriteriaError("data_request_failed", 502);
    return await response.json() as T[];
  }

  async function getDraft(testId: string): Promise<SuccessCriteriaDraft> {
    if (!UUID_PATTERN.test(testId)) throw new SuccessCriteriaError("invalid_test_id", 400);
    const versionQuery = new URLSearchParams({
      test_id: `eq.${testId}`,
      lifecycle_status: "eq.draft",
      select: "id,workspace_id,test_id,lifecycle_status,figma_start_node_id,prototype_mapping",
      order: "version_no.desc",
      limit: "1",
    });
    const version = (await rows<VersionRow>(`test_versions?${versionQuery.toString()}`))[0];
    if (!version) throw new SuccessCriteriaError("draft_not_found", 404);

    const prototypeUrl = prototypeSource(version.prototype_mapping);
    const startNodeId = version.figma_start_node_id;
    if (!prototypeUrl || !startNodeId) throw new SuccessCriteriaError("prototype_not_configured", 409);

    const taskQuery = new URLSearchParams({
      test_version_id: `eq.${version.id}`,
      select: "id,workspace_id,test_version_id,ordinal,title,success_rule,failure_rule",
      order: "ordinal.asc",
    });
    const taskRows = await rows<TaskRuleRow>(`tasks?${taskQuery.toString()}`);
    const tasks = taskRows.map((task): SuccessCriteriaTask => {
      const success = ruleNodeIds(task.success_rule);
      const failure = ruleNodeIds(task.failure_rule);
      return Object.freeze({
        id: task.id,
        ordinal: task.ordinal,
        title: task.title,
        successNodeIds: Object.freeze(success.nodeIds),
        failureNodeIds: Object.freeze(failure.nodeIds),
        editable: success.editable && failure.editable,
      });
    });

    return Object.freeze({
      workspaceId: version.workspace_id,
      testVersionId: version.id,
      prototypeUrl,
      startNodeId,
      tasks: Object.freeze(tasks),
    });
  }

  return Object.freeze({ getDraft });
}
