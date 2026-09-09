import { parseFunnelDefinition } from "./funnel.ts";
import { buildResultsModel, type ResultAnswer, type ResultTaskDefinition, type ResultsModel } from "./results.ts";
import { fromEventStorageRow, type EventStorageRow } from "../tracking/persistence.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const PAGE_SIZE = 1000;

type FetchLike = typeof fetch;

type SessionRow = Readonly<{ id: string }>;
type VersionRow = Readonly<{ funnel_config: unknown }>;
type TaskRow = Readonly<{
  id: string;
  title: string;
  ordinal: number;
  expected_path: unknown;
}>;
type AnswerRow = Readonly<{
  id: string;
  session_id: string;
  task_id: string | null;
  question_key: string;
  answer_type: string;
  value: unknown;
  created_at: string;
}>;

export class ResultsStoreError extends Error {
  code: "invalid_test_version" | "unauthorized" | "forbidden" | "provider_error";
  status: number;

  constructor(code: ResultsStoreError["code"], status: number) {
    super(code);
    this.name = "ResultsStoreError";
    this.code = code;
    this.status = status;
  }
}

function required(value: string, field: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function expectedPath(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

export function createResultsStore(options: Readonly<{
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}>) {
  const supabaseUrl = required(options.supabaseUrl, "supabaseUrl").replace(/\/+$/, "");
  const anonKey = required(options.anonKey, "anonKey");
  const accessToken = required(options.accessToken, "accessToken");
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!supabaseUrl.startsWith("https://")) throw new Error("supabaseUrl must use https");

  const baseHeaders = {
    apikey: anonKey,
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
  } as const;

  async function readPage<T>(table: string, query: URLSearchParams, start: number): Promise<T[]> {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
      headers: { ...baseHeaders, range: `${start}-${start + PAGE_SIZE - 1}` },
      cache: "no-store",
    });
    if (response.status === 401) throw new ResultsStoreError("unauthorized", 401);
    if (response.status === 403) throw new ResultsStoreError("forbidden", 403);
    if (!response.ok) throw new ResultsStoreError("provider_error", 502);
    const value = await response.json();
    if (!Array.isArray(value)) throw new ResultsStoreError("provider_error", 502);
    return value as T[];
  }

  async function readAll<T>(table: string, query: URLSearchParams): Promise<T[]> {
    const output: T[] = [];
    for (let start = 0; ; start += PAGE_SIZE) {
      const rows = await readPage<T>(table, query, start);
      output.push(...rows);
      if (rows.length < PAGE_SIZE) return output;
    }
  }

  async function read(testVersionId: string): Promise<ResultsModel> {
    if (!UUID_PATTERN.test(testVersionId)) throw new ResultsStoreError("invalid_test_version", 400);

    const versionQuery = new URLSearchParams({
      id: `eq.${testVersionId}`,
      select: "funnel_config",
      limit: "1",
    });
    const sessionQuery = new URLSearchParams({
      test_version_id: `eq.${testVersionId}`,
      select: "id",
      order: "started_at.asc,id.asc",
    });
    const eventQuery = new URLSearchParams({
      test_version_id: `eq.${testVersionId}`,
      select: "event_id,workspace_id,session_id,participant_id,test_id,test_version_id,task_id,screen_id,idempotency_key,event_name,event_layer,source,schema_version,occurred_at,received_at,sequence,payload,derived_from_event_ids,rule_version",
      order: "occurred_at.asc,received_at.asc,event_id.asc",
    });
    const taskQuery = new URLSearchParams({
      test_version_id: `eq.${testVersionId}`,
      select: "id,title,ordinal,expected_path",
      order: "ordinal.asc,id.asc",
    });

    const [versionRows, sessions, eventRows, taskRows] = await Promise.all([
      readAll<VersionRow>("test_versions", versionQuery),
      readAll<SessionRow>("sessions", sessionQuery),
      readAll<EventStorageRow>("events", eventQuery),
      readAll<TaskRow>("tasks", taskQuery),
    ]);

    let answerRows: AnswerRow[] = [];
    if (sessions.length > 0) {
      for (let index = 0; index < sessions.length; index += 100) {
        const ids = sessions.slice(index, index + 100).map((session) => session.id);
        const answerQuery = new URLSearchParams({
          session_id: `in.(${ids.join(",")})`,
          select: "id,session_id,task_id,question_key,answer_type,value,created_at",
          order: "created_at.asc,id.asc",
        });
        answerRows.push(...await readAll<AnswerRow>("answers", answerQuery));
      }
    }

    const tasks: ResultTaskDefinition[] = taskRows.map((row) => Object.freeze({
      taskId: row.id,
      title: row.title,
      ordinal: row.ordinal,
      expectedPath: Object.freeze(expectedPath(row.expected_path)),
    }));
    const answers: ResultAnswer[] = answerRows.map((row) => Object.freeze({
      id: row.id,
      sessionId: row.session_id,
      taskId: row.task_id,
      questionKey: row.question_key,
      answerType: row.answer_type,
      value: row.value,
      createdAt: row.created_at,
    }));

    return buildResultsModel({
      testVersionId,
      events: eventRows.map(fromEventStorageRow),
      tasks,
      answers,
      funnelDefinition: parseFunnelDefinition(versionRows[0]?.funnel_config),
    });
  }

  return Object.freeze({ read });
}
