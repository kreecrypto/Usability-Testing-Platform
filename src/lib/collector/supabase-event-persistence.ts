import type {
  AcceptedTrackingEvent,
  RawTrackingEvent,
} from "../tracking/events.ts";
import { toEventStorageRow } from "../tracking/persistence.ts";
import { createSupabaseAdminFetch } from "../supabase-admin-fetch.ts";
import type { PersistAcceptedEvent, PersistAcceptedEventResult } from "./event-collector.ts";

type FetchLike = typeof fetch;

type SessionContext = Readonly<{
  workspace_id: string;
  participant_id: string;
  test_id: string;
  test_version_id: string;
}>;

function requiredServerValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

function parseSessionContext(value: unknown): SessionContext {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("session_context_not_found");
  }

  const row = value[0];
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    throw new Error("invalid_session_context");
  }

  const context = row as Record<string, unknown>;
  for (const field of [
    "workspace_id",
    "participant_id",
    "test_id",
    "test_version_id",
  ] as const) {
    if (typeof context[field] !== "string" || context[field].trim() === "") {
      throw new Error("invalid_session_context");
    }
  }

  return context as SessionContext;
}

function assertEventMatchesSession(
  event: AcceptedTrackingEvent<RawTrackingEvent>,
  context: SessionContext,
): void {
  if (
    context.participant_id !== event.participantId ||
    context.test_id !== event.testId ||
    context.test_version_id !== event.testVersionId
  ) {
    throw new Error("session_context_mismatch");
  }
}

export function createSupabaseEventPersister(options: {
  supabaseUrl: string;
  secretKey: string;
  fetchImpl?: FetchLike;
}): PersistAcceptedEvent {
  const supabaseUrl = requiredServerValue(options.supabaseUrl, "supabaseUrl").replace(/\/+$/, "");
  const secretKey = requiredServerValue(options.secretKey, "secretKey");
  const fetchImpl = createSupabaseAdminFetch(secretKey, options.fetchImpl ?? fetch);

  if (!supabaseUrl.startsWith("https://")) {
    throw new Error("supabaseUrl must use https");
  }

  const authorizationHeaders = {
    apikey: secretKey,
    authorization: `Bearer ${secretKey}`,
  } as const;

  return async function persistAcceptedEvent(
    event: AcceptedTrackingEvent<RawTrackingEvent>,
  ): Promise<PersistAcceptedEventResult> {
    const query = new URLSearchParams({
      id: `eq.${event.sessionId}`,
      select: "workspace_id,participant_id,test_id,test_version_id",
      limit: "1",
    });

    const lookupResponse = await fetchImpl(
      `${supabaseUrl}/rest/v1/sessions?${query.toString()}`,
      {
        method: "GET",
        headers: authorizationHeaders,
        cache: "no-store",
      },
    );

    if (!lookupResponse.ok) {
      throw new Error("session_lookup_failed");
    }

    const context = parseSessionContext(await lookupResponse.json());
    assertEventMatchesSession(event, context);

    const storageRow = toEventStorageRow(context.workspace_id, event);
    const insertQuery = new URLSearchParams({
      on_conflict: "session_id,idempotency_key",
      select: "event_id,idempotency_key",
    });
    const insertResponse = await fetchImpl(
      `${supabaseUrl}/rest/v1/events?${insertQuery.toString()}`,
      {
        method: "POST",
        headers: {
          ...authorizationHeaders,
          "content-type": "application/json",
          prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify(storageRow),
        cache: "no-store",
      },
    );

    if (!insertResponse.ok) {
      throw new Error("event_insert_failed");
    }

    const responseBody = await insertResponse.text();
    if (responseBody.trim() === "") {
      return "accepted";
    }

    const insertedRows = JSON.parse(responseBody);
    if (Array.isArray(insertedRows) && insertedRows.length === 0) {
      return "duplicate";
    }

    return "accepted";
  };
}
