const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublishPreviewTask = Readonly<{
  id: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
  expectedPath: readonly unknown[];
  successRule: Readonly<Record<string, unknown>>;
  failureRule: Readonly<Record<string, unknown>>;
  timeoutSeconds: number | null;
  postTaskQuestions: Readonly<Record<string, unknown>>;
}>;

export type PublishPreview = Readonly<{
  testId: string;
  testVersionId: string;
  versionNo: number;
  lifecycleStatus: "draft" | "published";
  sourceUrl: string;
  embedUrl: string;
  fileKey: string;
  startNodeId: string;
  tasks: readonly PublishPreviewTask[];
}>;

export class PublishVersioningError extends Error {
  constructor(
    public readonly code:
      | "invalid_test_id"
      | "test_version_not_found"
      | "permission_denied"
      | "not_publishable"
      | "data_request_failed",
    public readonly status: number,
    message: string = code,
  ) {
    super(message);
    this.name = "PublishVersioningError";
  }
}

type VersionRow = Readonly<{
  id: string;
  test_id: string;
  version_no: number;
  lifecycle_status: "draft" | "published" | "archived";
  figma_file_key: string | null;
  figma_start_node_id: string | null;
  prototype_mapping: Record<string, unknown>;
}>;

type TaskRow = Readonly<{
  id: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
  expected_path: unknown;
  success_rule: Record<string, unknown>;
  failure_rule: Record<string, unknown>;
  timeout_seconds: number | null;
  post_task_questions: Record<string, unknown>;
}>;

function requiredTestId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new PublishVersioningError("invalid_test_id", 400);
  return value;
}

function mappingStrings(mapping: Record<string, unknown>): {
  sourceUrl: string;
  embedUrl: string;
  fileKey: string;
} | null {
  if (
    mapping.provider !== "figma" ||
    typeof mapping.sourceUrl !== "string" ||
    typeof mapping.embedUrl !== "string" ||
    typeof mapping.fileKey !== "string" ||
    !mapping.sourceUrl.trim() ||
    !mapping.embedUrl.trim() ||
    !mapping.fileKey.trim()
  ) return null;
  return { sourceUrl: mapping.sourceUrl, embedUrl: mapping.embedUrl, fileKey: mapping.fileKey };
}

export function createPublishVersioningStore(options: {
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
    const response = await fetchImpl(`${supabaseUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (response.status === 401) throw new PublishVersioningError("data_request_failed", 401);
    if (response.status === 403) throw new PublishVersioningError("permission_denied", 403);
    const text = await response.text();
    if (!response.ok) {
      let message = "data_request_failed";
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed.message === "string") message = parsed.message;
      } catch { /* generic */ }
      if (/required|publishable|task/i.test(message)) {
        throw new PublishVersioningError("not_publishable", 409, message);
      }
      throw new PublishVersioningError("data_request_failed", 502, message);
    }
    return (text.trim() ? JSON.parse(text) : null) as T;
  }

  async function preview(testId: string): Promise<PublishPreview> {
    testId = requiredTestId(testId);
    const params = new URLSearchParams({
      test_id: `eq.${testId}`,
      lifecycle_status: "in.(draft,published)",
      select: "id,test_id,version_no,lifecycle_status,figma_file_key,figma_start_node_id,prototype_mapping",
      order: "version_no.desc",
      limit: "1",
    });
    const versions = await request<VersionRow[]>(`/rest/v1/test_versions?${params}`);
    const version = versions[0];
    if (!version || version.lifecycle_status === "archived") {
      throw new PublishVersioningError("test_version_not_found", 404);
    }
    const mapping = mappingStrings(version.prototype_mapping);
    if (!mapping || !version.figma_start_node_id) {
      throw new PublishVersioningError("not_publishable", 409, "publishable_prototype_snapshot_required");
    }

    const taskParams = new URLSearchParams({
      test_version_id: `eq.${version.id}`,
      select: "id,ordinal,title,scenario,instruction,expected_path,success_rule,failure_rule,timeout_seconds,post_task_questions",
      order: "ordinal.asc",
    });
    const taskRows = await request<TaskRow[]>(`/rest/v1/tasks?${taskParams}`);
    const tasks = taskRows.map((task) => Object.freeze({
      id: task.id,
      ordinal: task.ordinal,
      title: task.title,
      scenario: task.scenario,
      instruction: task.instruction,
      expectedPath: Object.freeze(Array.isArray(task.expected_path) ? [...task.expected_path] : []),
      successRule: Object.freeze({ ...(task.success_rule ?? {}) }),
      failureRule: Object.freeze({ ...(task.failure_rule ?? {}) }),
      timeoutSeconds: task.timeout_seconds,
      postTaskQuestions: Object.freeze({ ...(task.post_task_questions ?? {}) }),
    }));

    if (tasks.length === 0) throw new PublishVersioningError("not_publishable", 409, "at_least_one_task_required");

    return Object.freeze({
      testId,
      testVersionId: version.id,
      versionNo: version.version_no,
      lifecycleStatus: version.lifecycle_status,
      sourceUrl: mapping.sourceUrl,
      embedUrl: mapping.embedUrl,
      fileKey: mapping.fileKey,
      startNodeId: version.figma_start_node_id,
      tasks: Object.freeze(tasks),
    });
  }

  async function publish(testId: string): Promise<PublishPreview> {
    testId = requiredTestId(testId);
    await request<string>("/rest/v1/rpc/publish_draft_test_version", {
      method: "POST",
      body: JSON.stringify({ p_test_id: testId }),
    });
    return preview(testId);
  }

  async function createDraftFromPublished(testId: string): Promise<PublishPreview> {
    testId = requiredTestId(testId);
    await request<string>("/rest/v1/rpc/create_draft_from_published", {
      method: "POST",
      body: JSON.stringify({ p_test_id: testId }),
    });
    return preview(testId);
  }

  return Object.freeze({ preview, publish, createDraftFromPublished });
}
