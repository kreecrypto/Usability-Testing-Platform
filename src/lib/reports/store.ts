import { parseResultsStudyContext } from "../analytics/context.ts";
import { createResultsStore, ResultsStoreError } from "../analytics/results-store.ts";
import { createFindingsStore, FindingsStoreError } from "../findings/store.ts";
import { buildUsabilityReport, type ReportStudyContext, type UsabilityReport } from "./model.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type FetchLike = typeof fetch;

type VersionRow = Readonly<{
  id: string;
  test_id: string;
  version_no: number | null;
  lifecycle_status: string | null;
  published_at: string | null;
  target_provider: string | null;
  target_snapshot: unknown;
}>;

export class ReportStoreError extends Error {
  code: "invalid_test_version" | "unauthorized" | "forbidden" | "not_found" | "provider_error";
  status: number;

  constructor(code: ReportStoreError["code"], status: number, message: string = code) {
    super(message);
    this.name = "ReportStoreError";
    this.code = code;
    this.status = status;
  }
}

export function createReportStore(options: Readonly<{
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}>) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const supabaseUrl = options.supabaseUrl.replace(/\/+$/, "");
  const headers = {
    apikey: options.anonKey,
    authorization: `Bearer ${options.accessToken}`,
    accept: "application/json",
  } as const;
  const resultsStore = createResultsStore({ ...options, fetchImpl });
  const findingsStore = createFindingsStore({ ...options, fetchImpl });

  async function version(testVersionId: string): Promise<VersionRow> {
    if (!UUID_PATTERN.test(testVersionId)) throw new ReportStoreError("invalid_test_version", 400);
    const query = new URLSearchParams({
      id: `eq.${testVersionId}`,
      select: "id,test_id,version_no,lifecycle_status,published_at,target_provider,target_snapshot",
      limit: "1",
    });
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/test_versions?${query.toString()}`, {
      headers,
      cache: "no-store",
    });
    if (response.status === 401) throw new ReportStoreError("unauthorized", 401);
    if (response.status === 403) throw new ReportStoreError("forbidden", 403);
    if (!response.ok) throw new ReportStoreError("provider_error", 502);
    const body = await response.json();
    if (!Array.isArray(body) || !body[0]) throw new ReportStoreError("not_found", 404);
    return body[0] as VersionRow;
  }

  async function read(testVersionId: string): Promise<UsabilityReport> {
    try {
      const [versionRow, results, findings] = await Promise.all([
        version(testVersionId),
        resultsStore.read(testVersionId),
        findingsStore.listFindings(testVersionId),
      ]);
      const evidenceEntries = await Promise.all(findings.map(async (finding) =>
        [finding.id, await findingsStore.listEvidence(finding.id)] as const,
      ));
      const retests = await findingsStore.listRetestsForVersion(testVersionId);
      const context: ReportStudyContext = parseResultsStudyContext(versionRow);
      return buildUsabilityReport({
        results,
        context,
        findings,
        evidenceByFinding: Object.freeze(Object.fromEntries(evidenceEntries)),
        retests,
      });
    } catch (error) {
      if (error instanceof ReportStoreError) throw error;
      if (error instanceof ResultsStoreError || error instanceof FindingsStoreError) {
        const code = error.code === "validation_error" ? "invalid_test_version" : error.code;
        throw new ReportStoreError(
          code === "not_found" ? "not_found" : code as ReportStoreError["code"],
          error.status,
          error.message,
        );
      }
      throw error;
    }
  }

  return Object.freeze({ read });
}
