import {
  compareRetestMetric,
  isEvidenceType,
  isFindingSeverity,
  isFindingStatus,
  normalizeMetricSnapshot,
  type FindingEvidenceRecord,
  type FindingRecord,
  type RetestMetricComparison,
} from "./model.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type FetchLike = typeof fetch;

type FindingRow = Readonly<{
  id: string;
  workspace_id: string;
  project_id: string;
  test_version_id: string;
  task_id: string | null;
  screen_id: string | null;
  title: string;
  problem: string;
  description: string | null;
  severity: string;
  status: string;
  metric_snapshot: unknown;
  created_at: string;
  updated_at: string;
}>;

type EvidenceRow = Readonly<{
  id: string;
  workspace_id: string;
  finding_id: string;
  evidence_type: string;
  session_id: string | null;
  event_id: string | null;
  answer_id: string | null;
  note: string | null;
  evidence_payload: unknown;
  created_at: string;
}>;

type RetestRow = Readonly<{
  id: string;
  workspace_id: string;
  finding_id: string;
  original_test_version_id: string;
  retest_test_version_id: string;
  status: string;
  before_metrics: unknown;
  after_metrics: unknown;
  created_at: string;
  updated_at: string;
}>;

export class FindingsStoreError extends Error {
  code: "validation_error" | "unauthorized" | "forbidden" | "not_found" | "provider_error";
  status: number;

  constructor(code: FindingsStoreError["code"], status: number, message: string = code) {
    super(message);
    this.name = "FindingsStoreError";
    this.code = code;
    this.status = status;
  }
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new FindingsStoreError("validation_error", 400, `${field}_invalid`);
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new FindingsStoreError("validation_error", 400, `${field}_required`);
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new FindingsStoreError("validation_error", 400, "text_invalid");
  return value.trim() || null;
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FindingsStoreError("validation_error", 400, "evidence_payload_invalid");
  return { ...(value as Record<string, unknown>) };
}

function mapFinding(row: FindingRow): FindingRecord {
  if (!isFindingSeverity(row.severity) || !isFindingStatus(row.status)) throw new FindingsStoreError("provider_error", 502);
  return Object.freeze({
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    testVersionId: row.test_version_id,
    taskId: row.task_id,
    screenId: row.screen_id,
    title: row.title,
    problem: row.problem,
    description: row.description,
    severity: row.severity,
    status: row.status,
    metricSnapshot: normalizeMetricSnapshot(row.metric_snapshot, row.test_version_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapEvidence(row: EvidenceRow): FindingEvidenceRecord {
  if (!isEvidenceType(row.evidence_type)) throw new FindingsStoreError("provider_error", 502);
  return Object.freeze({
    id: row.id,
    findingId: row.finding_id,
    type: row.evidence_type,
    sessionId: row.session_id,
    eventId: row.event_id,
    answerId: row.answer_id,
    note: row.note,
    payload: Object.freeze(objectPayload(row.evidence_payload)),
    createdAt: row.created_at,
  });
}

export function createFindingsStore(options: Readonly<{
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}>) {
  const supabaseUrl = text(options.supabaseUrl, "supabaseUrl").replace(/\/+$/, "");
  const anonKey = text(options.anonKey, "anonKey");
  const accessToken = text(options.accessToken, "accessToken");
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { apikey: anonKey, authorization: `Bearer ${accessToken}`, accept: "application/json" } as const;

  async function rows<T>(table: string, query: URLSearchParams, init?: RequestInit): Promise<T[]> {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (response.status === 401) throw new FindingsStoreError("unauthorized", 401);
    if (response.status === 403) throw new FindingsStoreError("forbidden", 403);
    if (!response.ok) throw new FindingsStoreError("provider_error", 502);
    const body = await response.text();
    if (!body.trim()) return [];
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed)) throw new FindingsStoreError("provider_error", 502);
    return parsed as T[];
  }

  async function getFindingRow(findingId: string): Promise<FindingRow> {
    const id = uuid(findingId, "findingId");
    const result = await rows<FindingRow>("findings", new URLSearchParams({
      id: `eq.${id}`,
      select: "id,workspace_id,project_id,test_version_id,task_id,screen_id,title,problem,description,severity,status,metric_snapshot,created_at,updated_at",
      limit: "1",
    }));
    if (!result[0]) throw new FindingsStoreError("not_found", 404);
    return result[0];
  }

  async function listFindings(testVersionId: string): Promise<readonly FindingRecord[]> {
    const version = uuid(testVersionId, "testVersionId");
    const result = await rows<FindingRow>("findings", new URLSearchParams({
      test_version_id: `eq.${version}`,
      select: "id,workspace_id,project_id,test_version_id,task_id,screen_id,title,problem,description,severity,status,metric_snapshot,created_at,updated_at",
      order: "created_at.desc,id.asc",
    }));
    return Object.freeze(result.map(mapFinding));
  }

  async function createFinding(input: Readonly<Record<string, unknown>>): Promise<FindingRecord> {
    const workspaceId = uuid(input.workspaceId, "workspaceId");
    const projectId = uuid(input.projectId, "projectId");
    const testVersionId = uuid(input.testVersionId, "testVersionId");
    const taskId = input.taskId ? uuid(input.taskId, "taskId") : null;
    const screenId = optionalText(input.screenId);
    const title = text(input.title, "title");
    const problem = text(input.problem, "problem");
    const description = optionalText(input.description);
    if (!isFindingSeverity(input.severity)) throw new FindingsStoreError("validation_error", 400, "severity_invalid");
    let metricSnapshot;
    try { metricSnapshot = normalizeMetricSnapshot(input.metricSnapshot, testVersionId); }
    catch (error) { throw new FindingsStoreError("validation_error", 400, error instanceof Error ? error.message : "metric_snapshot_invalid"); }

    const result = await rows<FindingRow>("findings", new URLSearchParams({
      select: "id,workspace_id,project_id,test_version_id,task_id,screen_id,title,problem,description,severity,status,metric_snapshot,created_at,updated_at",
    }), {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        project_id: projectId,
        test_version_id: testVersionId,
        task_id: taskId,
        screen_id: screenId,
        title,
        problem,
        description,
        severity: input.severity,
        status: "open",
        metric_snapshot: metricSnapshot,
      }),
    });
    if (result.length !== 1) throw new FindingsStoreError("provider_error", 502);
    return mapFinding(result[0]);
  }

  async function updateFinding(findingId: string, input: Readonly<Record<string, unknown>>): Promise<FindingRecord> {
    const current = await getFindingRow(findingId);
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = text(input.title, "title");
    if (input.problem !== undefined) patch.problem = text(input.problem, "problem");
    if (input.description !== undefined) patch.description = optionalText(input.description);
    if (input.screenId !== undefined) patch.screen_id = optionalText(input.screenId);
    if (input.taskId !== undefined) patch.task_id = input.taskId ? uuid(input.taskId, "taskId") : null;
    if (input.severity !== undefined) {
      if (!isFindingSeverity(input.severity)) throw new FindingsStoreError("validation_error", 400, "severity_invalid");
      patch.severity = input.severity;
    }
    if (input.status !== undefined) {
      if (!isFindingStatus(input.status)) throw new FindingsStoreError("validation_error", 400, "status_invalid");
      patch.status = input.status;
    }
    if (input.metricSnapshot !== undefined) {
      try { patch.metric_snapshot = normalizeMetricSnapshot(input.metricSnapshot, current.test_version_id); }
      catch (error) { throw new FindingsStoreError("validation_error", 400, error instanceof Error ? error.message : "metric_snapshot_invalid"); }
    }
    if (Object.keys(patch).length === 0) throw new FindingsStoreError("validation_error", 400, "no_editable_fields");
    const result = await rows<FindingRow>("findings", new URLSearchParams({
      id: `eq.${current.id}`,
      select: "id,workspace_id,project_id,test_version_id,task_id,screen_id,title,problem,description,severity,status,metric_snapshot,created_at,updated_at",
    }), { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
    if (!result[0]) throw new FindingsStoreError("not_found", 404);
    return mapFinding(result[0]);
  }

  async function listEvidence(findingId: string): Promise<readonly FindingEvidenceRecord[]> {
    const finding = await getFindingRow(findingId);
    const result = await rows<EvidenceRow>("finding_evidence", new URLSearchParams({
      finding_id: `eq.${finding.id}`,
      select: "id,workspace_id,finding_id,evidence_type,session_id,event_id,answer_id,note,evidence_payload,created_at",
      order: "created_at.asc,id.asc",
    }));
    return Object.freeze(result.map(mapEvidence));
  }

  async function linkEvidence(findingId: string, input: Readonly<Record<string, unknown>>): Promise<FindingEvidenceRecord> {
    const finding = await getFindingRow(findingId);
    if (!isEvidenceType(input.type)) throw new FindingsStoreError("validation_error", 400, "evidence_type_invalid");
    const sessionId = input.sessionId ? uuid(input.sessionId, "sessionId") : null;
    const eventId = input.eventId ? uuid(input.eventId, "eventId") : null;
    const answerId = input.answerId ? uuid(input.answerId, "answerId") : null;
    const note = optionalText(input.note);
    const payload = objectPayload(input.payload);
    if (input.type === "session" && !sessionId) throw new FindingsStoreError("validation_error", 400, "session_evidence_requires_session");
    if (input.type === "event" && (!sessionId || !eventId)) throw new FindingsStoreError("validation_error", 400, "event_evidence_requires_session_event");
    if (input.type === "answer" && (!sessionId || !answerId)) throw new FindingsStoreError("validation_error", 400, "answer_evidence_requires_session_answer");
    if ((input.type === "path" || input.type === "heatmap") && (!sessionId || Object.keys(payload).length === 0)) {
      throw new FindingsStoreError("validation_error", 400, `${input.type}_evidence_requires_session_payload`);
    }
    const result = await rows<EvidenceRow>("finding_evidence", new URLSearchParams({
      select: "id,workspace_id,finding_id,evidence_type,session_id,event_id,answer_id,note,evidence_payload,created_at",
    }), {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        workspace_id: finding.workspace_id,
        finding_id: finding.id,
        evidence_type: input.type,
        session_id: sessionId,
        event_id: eventId,
        answer_id: answerId,
        note,
        evidence_payload: payload,
      }),
    });
    if (result.length !== 1) throw new FindingsStoreError("provider_error", 502);
    return mapEvidence(result[0]);
  }

  async function createRetest(input: Readonly<Record<string, unknown>>): Promise<Readonly<{ id: string }>> {
    const workspaceId = uuid(input.workspaceId, "workspaceId");
    const findingId = uuid(input.findingId, "findingId");
    const originalVersionId = uuid(input.originalTestVersionId, "originalTestVersionId");
    const retestVersionId = uuid(input.retestTestVersionId, "retestTestVersionId");
    let before; let after;
    try {
      before = normalizeMetricSnapshot(input.beforeMetrics, originalVersionId);
      after = normalizeMetricSnapshot(input.afterMetrics, retestVersionId);
      if (before.metricKey !== after.metricKey) throw new Error("retest_metric_key_mismatch");
    } catch (error) {
      throw new FindingsStoreError("validation_error", 400, error instanceof Error ? error.message : "retest_metrics_invalid");
    }
    const result = await rows<RetestRow>("retests", new URLSearchParams({ select: "id,workspace_id,finding_id,original_test_version_id,retest_test_version_id,status,before_metrics,after_metrics,created_at,updated_at" }), {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        finding_id: findingId,
        original_test_version_id: originalVersionId,
        retest_test_version_id: retestVersionId,
        status: "running",
        before_metrics: before,
        after_metrics: after,
      }),
    });
    if (!result[0]) throw new FindingsStoreError("provider_error", 502);
    return Object.freeze({ id: result[0].id });
  }

  async function retestComparison(retestId: string): Promise<Readonly<{ retestId: string; status: string; comparison: RetestMetricComparison }>> {
    const id = uuid(retestId, "retestId");
    const result = await rows<RetestRow>("retests", new URLSearchParams({
      id: `eq.${id}`,
      select: "id,workspace_id,finding_id,original_test_version_id,retest_test_version_id,status,before_metrics,after_metrics,created_at,updated_at",
      limit: "1",
    }));
    const row = result[0];
    if (!row) throw new FindingsStoreError("not_found", 404);
    let comparison;
    try {
      comparison = compareRetestMetric({
        baselineVersionId: row.original_test_version_id,
        retestVersionId: row.retest_test_version_id,
        before: row.before_metrics,
        after: row.after_metrics,
      });
    } catch (error) {
      throw new FindingsStoreError("provider_error", 502, error instanceof Error ? error.message : "retest_comparison_invalid");
    }
    return Object.freeze({ retestId: row.id, status: row.status, comparison });
  }

  return Object.freeze({ listFindings, createFinding, updateFinding, listEvidence, linkEvidence, createRetest, retestComparison });
}
