import {
  availableTaskOutcomeRuleTypes,
  buildTaskOutcomeRule,
  normalizeExpectedPath,
  parseStoredTaskOutcomeRule,
  taskOutcomeRulesConflict,
  taskOutcomeRuleSupported,
  type RuleTargetSnapshot,
  type TaskOutcomeRule,
} from "./task-outcome-rules.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TaskRow = Readonly<{
  id: string;
  workspace_id: string;
  test_version_id: string;
  expected_path: unknown;
  success_rule: unknown;
  failure_rule: unknown;
}>;

type VersionRow = Readonly<{
  id: string;
  lifecycle_status: string;
  target_provider: string | null;
  target_snapshot: unknown;
}>;

export type TaskOutcomeRuleEditorState = Readonly<{
  taskId: string;
  workspaceId: string;
  testVersionId: string;
  target: RuleTargetSnapshot;
  availableRuleTypes: readonly string[];
  expectedPath: readonly string[];
  successRule: ReturnType<typeof parseStoredTaskOutcomeRule>;
  failureRule: ReturnType<typeof parseStoredTaskOutcomeRule>;
}>;

export class TaskOutcomeRuleStoreError extends Error {
  readonly code:
    | "invalid_task_id"
    | "task_not_found"
    | "draft_not_found"
    | "target_not_configured"
    | "invalid_rule"
    | "unsupported_rule"
    | "conflicting_terminal_rules"
    | "permission_denied"
    | "data_request_failed";
  readonly status: number;

  constructor(code: TaskOutcomeRuleStoreError["code"], status: number, message: string = code) {
    super(message);
    this.name = "TaskOutcomeRuleStoreError";
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function targetSnapshot(row: VersionRow): RuleTargetSnapshot {
  const snapshot = record(row.target_snapshot);
  const capabilities = record(snapshot?.capabilities);
  const provider = snapshot?.provider;
  if (
    !capabilities ||
    (provider !== "figma_prototype" && provider !== "first_party_web" && provider !== "external_web") ||
    (row.target_provider && row.target_provider !== provider)
  ) {
    throw new TaskOutcomeRuleStoreError("target_not_configured", 409);
  }
  return Object.freeze({ provider, capabilities: Object.freeze({ ...capabilities }) });
}

export function createTaskOutcomeRuleStore(options: {
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

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        ...headers,
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (response.status === 401) throw new TaskOutcomeRuleStoreError("data_request_failed", 401);
    if (response.status === 403) throw new TaskOutcomeRuleStoreError("permission_denied", 403);
    const body = await response.text();
    if (!response.ok) {
      let message = "data_request_failed";
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        if (typeof parsed.message === "string") message = parsed.message;
      } catch {
        // Keep provider response details server-side.
      }
      if (/unsupported_rule/.test(message)) throw new TaskOutcomeRuleStoreError("unsupported_rule", 409, message);
      if (/conflicting_terminal_rules/.test(message)) throw new TaskOutcomeRuleStoreError("conflicting_terminal_rules", 409, message);
      if (/invalid_.*rule|terminal_rules_required/.test(message)) throw new TaskOutcomeRuleStoreError("invalid_rule", 400, message);
      throw new TaskOutcomeRuleStoreError("data_request_failed", 502, message);
    }
    return (body.trim() ? JSON.parse(body) : null) as T;
  }

  async function get(taskId: string): Promise<TaskOutcomeRuleEditorState> {
    if (!UUID_PATTERN.test(taskId)) throw new TaskOutcomeRuleStoreError("invalid_task_id", 400);
    const taskParams = new URLSearchParams({
      id: `eq.${taskId}`,
      select: "id,workspace_id,test_version_id,expected_path,success_rule,failure_rule",
      limit: "1",
    });
    const tasks = await request<TaskRow[]>(`tasks?${taskParams}`);
    const task = tasks[0];
    if (!task) throw new TaskOutcomeRuleStoreError("task_not_found", 404);

    const versionParams = new URLSearchParams({
      id: `eq.${task.test_version_id}`,
      lifecycle_status: "eq.draft",
      select: "id,lifecycle_status,target_provider,target_snapshot",
      limit: "1",
    });
    const versions = await request<VersionRow[]>(`test_versions?${versionParams}`);
    const version = versions[0];
    if (!version) throw new TaskOutcomeRuleStoreError("draft_not_found", 409);
    const target = targetSnapshot(version);

    const expectedPath = Array.isArray(task.expected_path)
      ? task.expected_path.filter((item): item is string => typeof item === "string")
      : [];

    return Object.freeze({
      taskId: task.id,
      workspaceId: task.workspace_id,
      testVersionId: task.test_version_id,
      target,
      availableRuleTypes: availableTaskOutcomeRuleTypes(target),
      expectedPath: Object.freeze(expectedPath),
      successRule: parseStoredTaskOutcomeRule(task.success_rule),
      failureRule: parseStoredTaskOutcomeRule(task.failure_rule),
    });
  }

  async function save(taskId: string, input: Readonly<{
    successRule: Readonly<{ type: unknown; values: unknown }>;
    failureRule: Readonly<{ type: unknown; values: unknown }>;
    expectedPath?: unknown;
  }>): Promise<TaskOutcomeRuleEditorState> {
    const current = await get(taskId);
    let success: TaskOutcomeRule;
    let failure: TaskOutcomeRule;
    try {
      success = buildTaskOutcomeRule(input.successRule);
      failure = buildTaskOutcomeRule(input.failureRule);
    } catch (error) {
      throw new TaskOutcomeRuleStoreError("invalid_rule", 400, error instanceof Error ? error.message : "invalid_rule");
    }
    if (!taskOutcomeRuleSupported(success, current.target) || !taskOutcomeRuleSupported(failure, current.target)) {
      throw new TaskOutcomeRuleStoreError("unsupported_rule", 409);
    }
    if (taskOutcomeRulesConflict(success, failure)) {
      throw new TaskOutcomeRuleStoreError("conflicting_terminal_rules", 409);
    }

    let expectedPath: readonly string[];
    try {
      expectedPath = normalizeExpectedPath(input.expectedPath);
    } catch {
      throw new TaskOutcomeRuleStoreError("invalid_rule", 400, "invalid_expected_path");
    }

    await request<unknown>("rpc/save_task_outcome_rules", {
      method: "POST",
      body: JSON.stringify({
        p_workspace_id: current.workspaceId,
        p_test_version_id: current.testVersionId,
        p_task_id: current.taskId,
        p_success_rule: success,
        p_failure_rule: failure,
        p_expected_path: expectedPath,
      }),
    });

    return get(taskId);
  }

  return Object.freeze({ get, save });
}
