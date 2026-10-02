type FetchLike = typeof fetch;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type TestRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "closed" | "archived";
  created_at: string;
  updated_at: string;
};

export class CrudValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "CrudValidationError";
    this.field = field;
  }
}

export class CrudProviderError extends Error {
  status: number;

  constructor(status: number, message = "data_request_failed") {
    super(message);
    this.name = "CrudProviderError";
    this.status = status;
  }
}

function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new CrudValidationError(field, `${field} must be a UUID`);
  }
  return value;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CrudValidationError(field, `${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new CrudValidationError(field, `${field} must be a string or null`);
  }
  return value.trim() === "" ? null : value.trim();
}

function requiredServerValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

export function bearerAccessToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

export function createProjectTestCrud(options: {
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

  const baseHeaders = {
    apikey: anonKey,
    authorization: `Bearer ${accessToken}`,
  } as const;

  async function requestRows<T>(
    table: "projects" | "tests",
    query: URLSearchParams,
    init?: RequestInit,
  ): Promise<T[]> {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
      ...init,
      headers: {
        ...baseHeaders,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) throw new CrudProviderError(response.status);
    const body = await response.text();
    return body.trim() ? JSON.parse(body) as T[] : [];
  }

  async function pageRows<T>(table: "projects" | "tests", workspaceId: string, options: { page?: number; pageSize?: number; search?: string; status?: string; projectId?: string } = {}) {
    const page = options.page ?? 1, pageSize = options.pageSize ?? 20;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new CrudValidationError("page", "invalid pagination");
    const allowed = table === "projects" ? ["active", "archived"] : ["draft", "published", "closed", "archived"];
    if (options.status && options.status !== "all" && !allowed.includes(options.status)) throw new CrudValidationError("status", "invalid status");
    const search = options.search?.trim() ?? "";
    if (search.length > 160) throw new CrudValidationError("search", "search too long");
    const query = new URLSearchParams({ workspace_id: `eq.${requiredUuid(workspaceId, "workspaceId")}`, select: table === "projects" ? "id,workspace_id,name,description,status,created_at,updated_at" : "id,workspace_id,project_id,title,description,status,created_at,updated_at", order: "created_at.desc,id.desc", offset: String((page - 1) * pageSize), limit: String(pageSize) });
    if (options.projectId) query.set("project_id", `eq.${requiredUuid(options.projectId, "projectId")}`);
    if (options.status && options.status !== "all") query.set("status", `eq.${options.status}`);
    // A quoted PostgREST operand keeps punctuation inside the literal; wildcard
    // characters are escaped so a user's query cannot broaden access or matching.
    if (search) {
      const literal = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_*]/g, (value) => `\\${value}`);
      query.set(table === "projects" ? "name" : "title", `ilike."%${literal}%"`);
    }
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers: { ...baseHeaders, prefer: "count=exact" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new CrudProviderError(response.status);
    const total = response.headers.get("content-range")?.split("/")[1];
    if (!total || !/^\d+$/.test(total)) throw new CrudProviderError(502, "count_unavailable");
    return { items: await response.json() as T[], pagination: { page, pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / pageSize) } };
  }
  async function pageProjects(workspaceId: string, options?: Parameters<typeof pageRows>[2]) { return pageRows<ProjectRow>("projects", workspaceId, options); }
  async function pageTests(workspaceId: string, options?: Parameters<typeof pageRows>[2]) { return pageRows<TestRow>("tests", workspaceId, options); }

  async function listProjects(workspaceId: string): Promise<ProjectRow[]> {
    requiredUuid(workspaceId, "workspaceId");
    return requestRows<ProjectRow>("projects", new URLSearchParams({
      workspace_id: `eq.${workspaceId}`,
      select: "id,workspace_id,name,description,status,created_at,updated_at",
      order: "created_at.desc",
    }));
  }

  async function getProject(projectId: string): Promise<ProjectRow | null> {
    projectId = requiredUuid(projectId, "projectId");
    const rows = await requestRows<ProjectRow>("projects", new URLSearchParams({
      id: `eq.${projectId}`,
      select: "id,workspace_id,name,description,status,created_at,updated_at",
      limit: "1",
    }));
    return rows[0] ?? null;
  }

  async function createProject(input: { workspaceId: string; name: string; description?: string | null }): Promise<ProjectRow> {
    const workspaceId = requiredUuid(input.workspaceId, "workspaceId");
    const name = requiredText(input.name, "name");
    const description = optionalText(input.description, "description");
    const rows = await requestRows<ProjectRow>("projects", new URLSearchParams({
      select: "id,workspace_id,name,description,status,created_at,updated_at",
    }), {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ workspace_id: workspaceId, name, ...(description !== undefined ? { description } : {}) }),
    });
    if (rows.length !== 1) throw new CrudProviderError(502, "unexpected_project_create_result");
    return rows[0];
  }

  async function updateProject(projectId: string, input: { name?: string; description?: string | null }): Promise<ProjectRow | null> {
    projectId = requiredUuid(projectId, "projectId");
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = requiredText(input.name, "name");
    const description = optionalText(input.description, "description");
    if (description !== undefined) patch.description = description;
    if (Object.keys(patch).length === 0) throw new CrudValidationError("body", "at least one editable field is required");
    const rows = await requestRows<ProjectRow>("projects", new URLSearchParams({
      id: `eq.${projectId}`,
      select: "id,workspace_id,name,description,status,created_at,updated_at",
    }), { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
    return rows[0] ?? null;
  }

  async function archiveProject(projectId: string): Promise<ProjectRow | null> {
    projectId = requiredUuid(projectId, "projectId");
    const rows = await requestRows<ProjectRow>("projects", new URLSearchParams({
      id: `eq.${projectId}`,
      select: "id,workspace_id,name,description,status,created_at,updated_at",
    }), { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status: "archived" }) });
    return rows[0] ?? null;
  }

  async function listTests(workspaceId: string, projectId?: string): Promise<TestRow[]> {
    requiredUuid(workspaceId, "workspaceId");
    const query = new URLSearchParams({
      workspace_id: `eq.${workspaceId}`,
      select: "id,workspace_id,project_id,title,description,status,created_at,updated_at",
      order: "created_at.desc",
    });
    if (projectId !== undefined) query.set("project_id", `eq.${requiredUuid(projectId, "projectId")}`);
    return requestRows<TestRow>("tests", query);
  }

  async function getTest(testId: string): Promise<TestRow | null> {
    testId = requiredUuid(testId, "testId");
    const rows = await requestRows<TestRow>("tests", new URLSearchParams({
      id: `eq.${testId}`,
      select: "id,workspace_id,project_id,title,description,status,created_at,updated_at",
      limit: "1",
    }));
    return rows[0] ?? null;
  }

  async function createTest(input: { workspaceId: string; projectId: string; title: string; description?: string | null }): Promise<TestRow> {
    const workspaceId = requiredUuid(input.workspaceId, "workspaceId");
    const projectId = requiredUuid(input.projectId, "projectId");
    const title = requiredText(input.title, "title");
    const description = optionalText(input.description, "description");
    const rows = await requestRows<TestRow>("tests", new URLSearchParams({
      select: "id,workspace_id,project_id,title,description,status,created_at,updated_at",
    }), {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ workspace_id: workspaceId, project_id: projectId, title, ...(description !== undefined ? { description } : {}) }),
    });
    if (rows.length !== 1) throw new CrudProviderError(502, "unexpected_test_create_result");
    return rows[0];
  }

  async function updateTest(testId: string, input: { title?: string; description?: string | null }): Promise<TestRow | null> {
    testId = requiredUuid(testId, "testId");
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = requiredText(input.title, "title");
    const description = optionalText(input.description, "description");
    if (description !== undefined) patch.description = description;
    if (Object.keys(patch).length === 0) throw new CrudValidationError("body", "at least one editable field is required");
    const rows = await requestRows<TestRow>("tests", new URLSearchParams({
      id: `eq.${testId}`,
      select: "id,workspace_id,project_id,title,description,status,created_at,updated_at",
    }), { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
    return rows[0] ?? null;
  }

  async function archiveTest(testId: string): Promise<TestRow | null> {
    testId = requiredUuid(testId, "testId");
    const rows = await requestRows<TestRow>("tests", new URLSearchParams({
      id: `eq.${testId}`,
      select: "id,workspace_id,project_id,title,description,status,created_at,updated_at",
    }), { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status: "archived" }) });
    return rows[0] ?? null;
  }

  return { pageProjects, pageTests, listProjects, getProject, createProject, updateProject, archiveProject, listTests, getTest, createTest, updateTest, archiveTest };
}
