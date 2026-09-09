const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TaskEditorRow = Readonly<{
  id: string;
  workspaceId: string;
  testVersionId: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
}>;

type TaskRow = Readonly<{
  id: string;
  workspace_id: string;
  test_version_id: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
}>;

type VersionRow = Readonly<{
  id: string;
  workspace_id: string;
  test_id: string;
  lifecycle_status: string;
}>;

export class TaskBuilderError extends Error {
  code:
    | "invalid_test_id"
    | "invalid_task_id"
    | "invalid_title"
    | "invalid_task_order"
    | "draft_not_found"
    | "task_not_found"
    | "permission_denied"
    | "data_request_failed";
  status: number;

  constructor(code: TaskBuilderError["code"], status: number, message: string = code) {
    super(message);
    this.name = "TaskBuilderError";
    this.code = code;
    this.status = status;
  }
}

function uuid(value: string, code: "invalid_test_id" | "invalid_task_id"): string {
  if (!UUID_PATTERN.test(value)) throw new TaskBuilderError(code, 400);
  return value;
}

function title(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TaskBuilderError("invalid_title", 400, "Task title is required.");
  }
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new TaskBuilderError("data_request_failed", 400);
  const trimmed = value.trim();
  return trimmed || null;
}

function toTask(row: TaskRow): TaskEditorRow {
  return Object.freeze({
    id: row.id,
    workspaceId: row.workspace_id,
    testVersionId: row.test_version_id,
    ordinal: row.ordinal,
    title: row.title,
    scenario: row.scenario,
    instruction: row.instruction,
  });
}

export function createTaskScenarioBuilder(options: {
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
    if (response.status === 401) throw new TaskBuilderError("data_request_failed", 401);
    if (response.status === 403) throw new TaskBuilderError("permission_denied", 403);
    if (!response.ok) throw new TaskBuilderError("data_request_failed", 502);
    const body = await response.text();
    return (body.trim() ? JSON.parse(body) : null) as T;
  }

  async function draftVersion(testId: string): Promise<VersionRow> {
    testId = uuid(testId, "invalid_test_id");
    const query = new URLSearchParams({
      test_id: `eq.${testId}`,
      lifecycle_status: "eq.draft",
      select: "id,workspace_id,test_id,lifecycle_status",
      order: "version_no.desc",
      limit: "1",
    });
    const rows = await request<VersionRow[]>(`test_versions?${query.toString()}`);
    if (!rows[0]) throw new TaskBuilderError("draft_not_found", 404);
    return rows[0];
  }

  async function rowsForVersion(versionId: string): Promise<TaskRow[]> {
    const query = new URLSearchParams({
      test_version_id: `eq.${versionId}`,
      select: "id,workspace_id,test_version_id,ordinal,title,scenario,instruction",
      order: "ordinal.asc",
    });
    return request<TaskRow[]>(`tasks?${query.toString()}`);
  }

  async function listTasks(testId: string): Promise<TaskEditorRow[]> {
    const draft = await draftVersion(testId);
    return (await rowsForVersion(draft.id)).map(toTask);
  }

  async function createTask(
    testId: string,
    input: { title: string; scenario?: string | null; instruction?: string | null },
  ): Promise<TaskEditorRow> {
    const draft = await draftVersion(testId);
    const existing = await rowsForVersion(draft.id);
    const query = new URLSearchParams({
      select: "id,workspace_id,test_version_id,ordinal,title,scenario,instruction",
    });
    const rows = await request<TaskRow[]>(`tasks?${query.toString()}`, {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        workspace_id: draft.workspace_id,
        test_version_id: draft.id,
        ordinal: existing.length + 1,
        title: title(input.title),
        scenario: optionalText(input.scenario),
        instruction: optionalText(input.instruction),
      }),
    });
    if (!rows[0]) throw new TaskBuilderError("data_request_failed", 502);
    return toTask(rows[0]);
  }

  async function updateTask(
    testId: string,
    taskId: string,
    input: { title: string; scenario?: string | null; instruction?: string | null },
  ): Promise<TaskEditorRow> {
    const draft = await draftVersion(testId);
    taskId = uuid(taskId, "invalid_task_id");
    const query = new URLSearchParams({
      id: `eq.${taskId}`,
      test_version_id: `eq.${draft.id}`,
      select: "id,workspace_id,test_version_id,ordinal,title,scenario,instruction",
    });
    const rows = await request<TaskRow[]>(`tasks?${query.toString()}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        title: title(input.title),
        scenario: optionalText(input.scenario),
        instruction: optionalText(input.instruction),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!rows[0]) throw new TaskBuilderError("task_not_found", 404);
    return toTask(rows[0]);
  }

  async function reorderTasks(testId: string, taskIds: string[]): Promise<TaskEditorRow[]> {
    const draft = await draftVersion(testId);
    if (!Array.isArray(taskIds) || taskIds.length === 0 || new Set(taskIds).size !== taskIds.length) {
      throw new TaskBuilderError("invalid_task_order", 400);
    }
    for (const taskId of taskIds) uuid(taskId, "invalid_task_id");
    await request<null>("rpc/reorder_draft_tasks", {
      method: "POST",
      body: JSON.stringify({ p_test_version_id: draft.id, p_task_ids: taskIds }),
    });
    return (await rowsForVersion(draft.id)).map(toTask);
  }

  return Object.freeze({ listTasks, createTask, updateTask, reorderTasks });
}
