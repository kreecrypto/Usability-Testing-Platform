import { randomUUID } from "node:crypto";
import { mintSessionIngestionToken } from "../collector/session-ingestion-token.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const INGESTION_TOKEN_TTL_SECONDS = 300 as const;

export type PublicRunnerTask = Readonly<{
  id: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
  timeoutSeconds: number | null;
  postTaskQuestions: Readonly<Record<string, unknown>>;
}>;

export type PublicTestSnapshot = Readonly<{
  testId: string;
  testVersionId: string;
  versionNo: number;
  title: string;
  description: string | null;
  prototype: Readonly<{
    sourceUrl: string;
    embedUrl: string;
    liveEmbedUrl: string | null;
    startNodeId: string;
  }>;
  tasks: readonly PublicRunnerTask[];
}>;

export type AnonymousRunnerSession = Readonly<{
  participantId: string;
  sessionId: string;
  testId: string;
  testVersionId: string;
  startedAt: string;
  ingestionToken: string;
  ingestionTokenExpiresAt: string;
}>;

export type RunnerTaskState = Readonly<{
  taskId: string;
  outcome: "success_direct" | "success_indirect" | "failed" | "give_up" | "timeout" | "abandoned" | "technical_blocked" | null;
  startedAt: string;
  endedAt: string | null;
}>;

export type RunnerSessionState = Readonly<{
  sessionId: string;
  status: "active" | "completed" | "abandoned" | "technical_blocked";
  completedAt: string | null;
  lastSequence: number;
  taskStates: readonly RunnerTaskState[];
  answeredQuestionKeys: readonly Readonly<{ taskId: string | null; questionKey: string }>[];
}>;

export class PublicRunnerError extends Error {
  readonly code: "invalid_version_id" | "published_test_not_found" | "invalid_consent" | "session_not_active" | "data_request_failed";
  readonly status: number;

  constructor(code: PublicRunnerError["code"], status: number, message: string = code) {
    super(message);
    this.name = "PublicRunnerError";
    this.code = code;
    this.status = status;
  }
}

type VersionRow = Readonly<{
  id: string;
  test_id: string;
  version_no: number;
  lifecycle_status: string;
  figma_start_node_id: string | null;
  prototype_mapping: Record<string, unknown>;
}>;

type TestRow = Readonly<{ id: string; title: string; description: string | null; status: string }>;
type TaskRow = Readonly<{
  id: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
  timeout_seconds: number | null;
  post_task_questions: Record<string, unknown>;
}>;
type SessionRpcRow = Readonly<{
  participant_id: string;
  session_id: string;
  workspace_id: string;
  test_id: string;
  test_version_id: string;
  started_at: string;
}>;
type SessionStatusRow = Readonly<{
  id: string;
  status: "active" | "completed" | "abandoned" | "technical_blocked";
  participant_id: string;
  test_version_id: string;
  completed_at: string | null;
}>;
type TaskSessionRow = Readonly<{
  task_id: string;
  outcome: RunnerTaskState["outcome"];
  started_at: string;
  ended_at: string | null;
}>;
type EventSequenceRow = Readonly<{ sequence: number | null }>;
type AnswerRow = Readonly<{ task_id: string | null; question_key: string }>;

function requiredVersionId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new PublicRunnerError("invalid_version_id", 400);
  return value;
}

function requiredServerValue(value: string, field: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function liveEmbedUrl(embedUrl: string, clientId: string | null): string | null {
  if (!clientId) return null;
  const url = new URL(embedUrl);
  if (url.protocol !== "https:" || url.hostname !== "embed.figma.com") return null;
  url.searchParams.set("client-id", clientId);
  return url.toString();
}

function prototypeFromVersion(version: VersionRow, figmaEmbedClientId: string | null) {
  const mapping = version.prototype_mapping;
  if (
    mapping?.provider !== "figma" ||
    typeof mapping.sourceUrl !== "string" || !mapping.sourceUrl.trim() ||
    typeof mapping.embedUrl !== "string" || !mapping.embedUrl.trim() ||
    !version.figma_start_node_id
  ) throw new PublicRunnerError("published_test_not_found", 404);
  return Object.freeze({
    sourceUrl: mapping.sourceUrl,
    embedUrl: mapping.embedUrl,
    liveEmbedUrl: liveEmbedUrl(mapping.embedUrl, figmaEmbedClientId),
    startNodeId: version.figma_start_node_id,
  });
}

export function runnerServerConfig() {
  return Object.freeze({
    supabaseUrl: requiredServerValue(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", "SUPABASE_URL"),
    secretKey: requiredServerValue(process.env.SUPABASE_SECRET_KEY ?? "", "SUPABASE_SECRET_KEY"),
    signingKey: requiredServerValue(process.env.EVENT_INGESTION_TOKEN_SECRET ?? "", "EVENT_INGESTION_TOKEN_SECRET"),
    figmaEmbedClientId: process.env.FIGMA_EMBED_CLIENT_ID?.trim() || null,
  });
}

export function createPublicRunnerStore(options: {
  supabaseUrl: string;
  secretKey: string;
  signingKey: string;
  figmaEmbedClientId?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  eventIdFactory?: () => string;
}) {
  const supabaseUrl = requiredServerValue(options.supabaseUrl, "supabaseUrl").replace(/\/+$/, "");
  const secretKey = requiredServerValue(options.secretKey, "secretKey");
  const signingKey = requiredServerValue(options.signingKey, "signingKey");
  const figmaEmbedClientId = options.figmaEmbedClientId?.trim() || null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const eventIdFactory = options.eventIdFactory ?? randomUUID;
  if (!supabaseUrl.startsWith("https://")) throw new Error("supabaseUrl must use https");

  const serverHeaders = Object.freeze({ apikey: secretKey, authorization: `Bearer ${secretKey}` });

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${supabaseUrl}${path}`, {
      ...init,
      headers: { ...serverHeaders, accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      let message = "data_request_failed";
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed.message === "string") message = parsed.message;
      } catch {
        // Provider details stay server-side.
      }
      if (/published_test_version_not_found|consent_version_required/i.test(message)) {
        throw new PublicRunnerError(/consent/i.test(message) ? "invalid_consent" : "published_test_not_found", /consent/i.test(message) ? 400 : 404);
      }
      throw new PublicRunnerError("data_request_failed", 502);
    }
    return (text.trim() ? JSON.parse(text) : null) as T;
  }

  async function snapshot(testVersionId: string): Promise<PublicTestSnapshot> {
    testVersionId = requiredVersionId(testVersionId);
    const versionParams = new URLSearchParams({
      id: `eq.${testVersionId}`,
      lifecycle_status: "eq.published",
      select: "id,test_id,version_no,lifecycle_status,figma_start_node_id,prototype_mapping",
      limit: "1",
    });
    const versions = await request<VersionRow[]>(`/rest/v1/test_versions?${versionParams}`);
    const version = versions[0];
    if (!version) throw new PublicRunnerError("published_test_not_found", 404);
    const prototype = prototypeFromVersion(version, figmaEmbedClientId);

    const testParams = new URLSearchParams({
      id: `eq.${version.test_id}`,
      status: "eq.published",
      select: "id,title,description,status",
      limit: "1",
    });
    const tests = await request<TestRow[]>(`/rest/v1/tests?${testParams}`);
    const test = tests[0];
    if (!test) throw new PublicRunnerError("published_test_not_found", 404);

    // Participant payload deliberately excludes expected_path, success_rule and
    // failure_rule. Those remain server/database-side inputs to the versioned
    // outcome engine and are never exposed in the public runner.
    const taskParams = new URLSearchParams({
      test_version_id: `eq.${version.id}`,
      select: "id,ordinal,title,scenario,instruction,timeout_seconds,post_task_questions",
      order: "ordinal.asc",
    });
    const taskRows = await request<TaskRow[]>(`/rest/v1/tasks?${taskParams}`);
    if (taskRows.length === 0) throw new PublicRunnerError("published_test_not_found", 404);

    return Object.freeze({
      testId: test.id,
      testVersionId: version.id,
      versionNo: version.version_no,
      title: test.title,
      description: test.description,
      prototype,
      tasks: Object.freeze(taskRows.map((task) => Object.freeze({
        id: task.id,
        ordinal: task.ordinal,
        title: task.title,
        scenario: task.scenario,
        instruction: task.instruction,
        timeoutSeconds: task.timeout_seconds,
        postTaskQuestions: Object.freeze({ ...(task.post_task_questions ?? {}) }),
      }))),
    });
  }

  function mintIngestion(sessionId: string, testVersionId: string): { token: string; expiresAt: string } {
    const current = now();
    const expiresAt = new Date(current.getTime() + INGESTION_TOKEN_TTL_SECONDS * 1000);
    return {
      token: mintSessionIngestionToken({ signingKey, sessionId, testVersionId, expiresAt, tokenId: eventIdFactory() }),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async function startSession(testVersionId: string, consentVersion: string, locale?: string | null): Promise<AnonymousRunnerSession> {
    testVersionId = requiredVersionId(testVersionId);
    if (!consentVersion.trim()) throw new PublicRunnerError("invalid_consent", 400);
    const rows = await request<SessionRpcRow[]>("/rest/v1/rpc/create_anonymous_participant_session", {
      method: "POST",
      body: JSON.stringify({
        p_test_version_id: testVersionId,
        p_consent_version: consentVersion.trim(),
        p_locale: locale?.trim() || null,
      }),
    });
    const row = rows[0];
    if (!row) throw new PublicRunnerError("data_request_failed", 502);
    const ingestion = mintIngestion(row.session_id, row.test_version_id);
    return Object.freeze({
      participantId: row.participant_id,
      sessionId: row.session_id,
      testId: row.test_id,
      testVersionId: row.test_version_id,
      startedAt: row.started_at,
      ingestionToken: ingestion.token,
      ingestionTokenExpiresAt: ingestion.expiresAt,
    });
  }

  async function sessionRow(claims: { sessionId: string; participantId: string; testVersionId: string }): Promise<SessionStatusRow> {
    const params = new URLSearchParams({
      id: `eq.${claims.sessionId}`,
      participant_id: `eq.${claims.participantId}`,
      test_version_id: `eq.${claims.testVersionId}`,
      select: "id,status,participant_id,test_version_id,completed_at",
      limit: "1",
    });
    const rows = await request<SessionStatusRow[]>(`/rest/v1/sessions?${params}`);
    const row = rows[0];
    if (!row) throw new PublicRunnerError("session_not_active", 409);
    return row;
  }

  async function refreshIngestionToken(claims: { sessionId: string; participantId: string; testVersionId: string }) {
    const row = await sessionRow(claims);
    if (row.status !== "active") throw new PublicRunnerError("session_not_active", 409);
    return Object.freeze(mintIngestion(row.id, row.test_version_id));
  }

  async function sessionState(claims: { sessionId: string; participantId: string; testVersionId: string }): Promise<RunnerSessionState> {
    const row = await sessionRow(claims);
    const taskParams = new URLSearchParams({
      session_id: `eq.${row.id}`,
      select: "task_id,outcome,started_at,ended_at",
      order: "started_at.asc",
    });
    const taskRows = await request<TaskSessionRow[]>(`/rest/v1/task_sessions?${taskParams}`);
    const eventParams = new URLSearchParams({
      session_id: `eq.${row.id}`,
      event_layer: "eq.raw",
      select: "sequence",
      order: "sequence.desc",
      limit: "1",
    });
    const eventRows = await request<EventSequenceRow[]>(`/rest/v1/events?${eventParams}`);
    const answerParams = new URLSearchParams({
      session_id: `eq.${row.id}`,
      select: "task_id,question_key",
      order: "created_at.asc",
    });
    const answerRows = await request<AnswerRow[]>(`/rest/v1/answers?${answerParams}`);

    return Object.freeze({
      sessionId: row.id,
      status: row.status,
      completedAt: row.completed_at,
      lastSequence: Number.isSafeInteger(eventRows[0]?.sequence) ? (eventRows[0]?.sequence as number) : 0,
      taskStates: Object.freeze(taskRows.map((task) => Object.freeze({
        taskId: task.task_id,
        outcome: task.outcome,
        startedAt: task.started_at,
        endedAt: task.ended_at,
      }))),
      answeredQuestionKeys: Object.freeze(answerRows.map((answer) => Object.freeze({
        taskId: answer.task_id,
        questionKey: answer.question_key,
      }))),
    });
  }

  return Object.freeze({ snapshot, startSession, refreshIngestionToken, sessionState });
}
