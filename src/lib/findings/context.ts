import { FindingsStoreError } from "./store.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
type FetchLike = typeof fetch;

function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new FindingsStoreError("validation_error", 400, `${field}_invalid`);
  return value;
}

export function createFindingContextStore(options: Readonly<{
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}>) {
  const url = options.supabaseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { apikey: options.anonKey, authorization: `Bearer ${options.accessToken}`, accept: "application/json" } as const;

  async function readOne<T>(table: string, query: URLSearchParams): Promise<T> {
    const response = await fetchImpl(`${url}/rest/v1/${table}?${query.toString()}`, { headers, cache: "no-store" });
    if (response.status === 401) throw new FindingsStoreError("unauthorized", 401);
    if (response.status === 403) throw new FindingsStoreError("forbidden", 403);
    if (!response.ok) throw new FindingsStoreError("provider_error", 502);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0]) throw new FindingsStoreError("not_found", 404);
    return rows[0] as T;
  }

  async function version(testVersionId: string): Promise<Readonly<{ workspaceId: string; projectId: string; testId: string }>> {
    const versionId = requiredUuid(testVersionId, "testVersionId");
    const version = await readOne<{ workspace_id: string; test_id: string }>("test_versions", new URLSearchParams({
      id: `eq.${versionId}`,
      select: "workspace_id,test_id",
      limit: "1",
    }));
    const test = await readOne<{ project_id: string }>("tests", new URLSearchParams({
      id: `eq.${version.test_id}`,
      workspace_id: `eq.${version.workspace_id}`,
      select: "project_id",
      limit: "1",
    }));
    return Object.freeze({ workspaceId: version.workspace_id, projectId: test.project_id, testId: version.test_id });
  }

  async function finding(findingId: string): Promise<Readonly<{ workspaceId: string; testVersionId: string }>> {
    const id = requiredUuid(findingId, "findingId");
    const row = await readOne<{ workspace_id: string; test_version_id: string }>("findings", new URLSearchParams({
      id: `eq.${id}`,
      select: "workspace_id,test_version_id",
      limit: "1",
    }));
    return Object.freeze({ workspaceId: row.workspace_id, testVersionId: row.test_version_id });
  }

  return Object.freeze({ version, finding });
}
