import type { AcceptedTrackingEvent, RawTrackingEvent } from "../tracking/events.ts";
import type { RecordDeadLetter } from "./reliable-event-persistence.ts";

type FetchLike = typeof fetch;

function requiredServerValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

export function createSupabaseDeadLetterRecorder(options: {
  supabaseUrl: string;
  secretKey: string;
  fetchImpl?: FetchLike;
}): RecordDeadLetter {
  const supabaseUrl = requiredServerValue(options.supabaseUrl, "supabaseUrl").replace(/\/+$/, "");
  const secretKey = requiredServerValue(options.secretKey, "secretKey");
  const fetchImpl = options.fetchImpl ?? fetch;

  return async function recordDeadLetter(
    event: AcceptedTrackingEvent<RawTrackingEvent>,
    attemptCount: number,
  ): Promise<void> {
    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/event_ingestion_dlq?on_conflict=session_id,idempotency_key`,
      {
        method: "POST",
        headers: {
          apikey: secretKey,
          authorization: `Bearer ${secretKey}`,
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          session_id: event.sessionId,
          event_id: event.eventId,
          idempotency_key: event.idempotencyKey,
          event_name: event.eventType,
          attempt_count: attemptCount,
          failure_code: "persistence_attempts_exhausted",
          last_failed_at: new Date().toISOString(),
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) throw new Error("dead_letter_insert_failed");
  };
}
