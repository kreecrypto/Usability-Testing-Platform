const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type QuestionToggle = Readonly<{ enabled: boolean; required: boolean }>;
export type PostTaskQuestionConfig = Readonly<{
  seq: QuestionToggle;
  openFeedback: QuestionToggle;
}>;

export type PostTaskQuestionTask = Readonly<{
  id: string;
  ordinal: number;
  title: string;
  config: PostTaskQuestionConfig;
}>;

type VersionRow = Readonly<{
  id: string;
  workspace_id: string;
  test_id: string;
  lifecycle_status: string;
}>;

type TaskRow = Readonly<{
  id: string;
  test_version_id: string;
  ordinal: number;
  title: string;
  post_task_questions: unknown;
}>;

export class PostTaskQuestionError extends Error {
  code:
    | "invalid_test_id"
    | "invalid_task_id"
    | "invalid_question_config"
    | "draft_not_found"
    | "task_not_found"
    | "permission_denied"
    | "data_request_failed";
  status: number;

  constructor(code: PostTaskQuestionError["code"], status: number, message: string = code) {
    super(message);
    this.name = "PostTaskQuestionError";
    this.code = code;
    this.status = status;
  }
}

const EMPTY_CONFIG: PostTaskQuestionConfig = Object.freeze({
  seq: Object.freeze({ enabled: false, required: false }),
  openFeedback: Object.freeze({ enabled: false, required: false }),
});

function uuid(value: string, code: "invalid_test_id" | "invalid_task_id"): string {
  if (!UUID_PATTERN.test(value)) throw new PostTaskQuestionError(code, 400);
  return value;
}

function toggle(value: unknown, label: string): QuestionToggle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PostTaskQuestionError("invalid_question_config", 400, `${label} configuration is invalid.`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record.enabled !== "boolean" || typeof record.required !== "boolean") {
    throw new PostTaskQuestionError("invalid_question_config", 400, `${label} enabled/required must be boolean.`);
  }
  if (record.required && !record.enabled) {
    throw new PostTaskQuestionError("invalid_question_config", 400, `${label} cannot be required when disabled.`);
  }
  return Object.freeze({ enabled: record.enabled, required: record.required });
}

export function normalizePostTaskQuestionConfig(value: unknown): PostTaskQuestionConfig {
  if (value === null || value === undefined) return EMPTY_CONFIG;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PostTaskQuestionError("invalid_question_config", 400);
  }
  const record = value as Record<string, unknown>;
  return Object.freeze({
    seq: toggle(record.seq, "SEQ"),
    openFeedback: toggle(record.openFeedback ?? record.open_feedback, "Open Feedback"),
  });
}

function fromStored(value: unknown): PostTaskQuestionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_CONFIG;
  const record = value as Record<string, unknown>;
  try {
    return normalizePostTaskQuestionConfig({
      seq: record.seq ?? { enabled: false, required: false },
      open_feedback: record.open_feedback ?? { enabled: false, required: false },
    });
  } catch {
    throw new PostTaskQuestionError("data_request_failed", 502, "Stored post-task question configuration is invalid.");
  }
}

function toStored(config: PostTaskQuestionConfig) {
  return {
    seq: { enabled: config.seq.enabled, required: config.seq.required },
    open_feedback: { enabled: config.openFeedback.enabled, required: config.openFeedback.required },
  };
}

function toTask(row: TaskRow): PostTaskQuestionTask {
  return Object.freeze({
    id: row.id,
    ordinal: row.ordinal,
    title: row.title,
    config: fromStored(row.post_task_questions),
  });
}

export function createPostTaskQuestionBuilder(options: {
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

  const headers = Object.freeze({ apikey: publicKey, authorization: `Bearer ${accessToken}` });

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
    if (response.status === 401) throw new PostTaskQuestionError("data_request_failed", 401);
    if (response.status === 403) throw new PostTaskQuestionError("permission_denied", 403);
    if (!response.ok) throw new PostTaskQuestionError("data_request_failed", 502);
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
    if (!rows[0]) throw new PostTaskQuestionError("draft_not_found", 404);
    return rows[0];
  }

  async function rowsForVersion(versionId: string): Promise<TaskRow[]> {
    const query = new URLSearchParams({
      test_version_id: `eq.${versionId}`,
      select: "id,test_version_id,ordinal,title,post_task_questions",
      order: "ordinal.asc",
    });
    return request<TaskRow[]>(`tasks?${query.toString()}`);
  }

  async function list(testId: string): Promise<PostTaskQuestionTask[]> {
    const draft = await draftVersion(testId);
    return (await rowsForVersion(draft.id)).map(toTask);
  }

  async function update(testId: string, taskId: string, input: unknown): Promise<PostTaskQuestionTask> {
    const draft = await draftVersion(testId);
    taskId = uuid(taskId, "invalid_task_id");
    const config = normalizePostTaskQuestionConfig(input);
    const query = new URLSearchParams({
      id: `eq.${taskId}`,
      test_version_id: `eq.${draft.id}`,
      select: "id,test_version_id,ordinal,title,post_task_questions",
    });
    const rows = await request<TaskRow[]>(`tasks?${query.toString()}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ post_task_questions: toStored(config), updated_at: new Date().toISOString() }),
    });
    if (!rows[0]) throw new PostTaskQuestionError("task_not_found", 404);
    return toTask(rows[0]);
  }

  return Object.freeze({ list, update });
}
