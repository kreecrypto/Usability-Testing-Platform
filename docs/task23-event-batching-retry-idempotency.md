# Task 23 — Event Batching, Retry & Idempotency

## Status

Task 23 extends the Task 22 Vercel collector with deterministic batch ingestion, bounded persistence retry, and duplicate suppression. The `/v1/events` route still accepts the Task 22 single-event payload for compatibility, and now also accepts a batch envelope:

```json
{
  "events": [
    { "schemaVersion": 2, "eventLayer": "raw", "eventType": "task_started" }
  ]
}
```

Each object in `events` must be a complete canonical raw Event Contract v2 event. Batches are validated before persistence begins; if any event is malformed, the collector returns `400` and writes none of the batch.

## Runtime behavior

- `POST /v1/events` accepts either one raw event object or `{ "events": [...] }`.
- A batch must contain 1 to 100 events.
- Validation remains the same as Task 22: derived events, malformed timestamps, invalid session/test identifiers, invalid sequence, unsupported source/type, non-object metadata, and client-supplied `receivedAt` are rejected.
- The collector assigns `receivedAt` per accepted event.
- Transient persistence failures are retried up to three attempts by default.
- Retry exhaustion returns only `{ "error": "ingestion_unavailable" }` with HTTP `503` so database/provider details and secrets are not exposed.
- Duplicate `(sessionId, idempotencyKey)` entries inside the same batch are suppressed before a second write.
- Supabase persistence uses the database uniqueness gate on `(session_id, idempotency_key)` with PostgREST conflict handling so retried deliveries do not create another primary event row.

## Batch response

A batch response is accepted with HTTP `202` and returns per-event receipts:

```json
{
  "status": "accepted",
  "accepted": [
    {
      "eventId": "60000000-0000-4000-8000-000000000001",
      "receivedAt": "2026-09-09T10:00:05.000Z",
      "status": "accepted"
    }
  ],
  "duplicates": [
    {
      "eventId": "60000000-0000-4000-8000-000000000099",
      "receivedAt": "2026-09-09T10:00:05.000Z",
      "status": "duplicate"
    }
  ],
  "summary": {
    "received": 2,
    "accepted": 1,
    "duplicate": 1
  }
}
```

Single-event requests keep the Task 22 receipt shape and return one event receipt.

## Database idempotency gate

The existing Task 20 schema already enforces:

- `events.event_id` as the primary canonical event identity;
- `unique (session_id, idempotency_key)` so retrying a delivery for the same session/key cannot create another row;
- `events_session_raw_sequence_uq` so raw sequence ordering cannot silently duplicate within a session.

Task 23 uses that database gate during Supabase REST persistence instead of relying only on collector memory. The collector-side same-batch suppression prevents extra work within one request; the Supabase gate remains the source of truth across retry attempts and separate HTTP deliveries.

## QA evidence

Required evidence before marking complete:

- batch upload persists multiple valid events and returns per-event receipts;
- an invalid event rejects the whole batch before persistence;
- transient persistence failure retries before success;
- retry exhaustion returns generic `503` without leaking raw errors;
- duplicate idempotency keys inside one batch produce one write and one duplicate receipt;
- Supabase persistence uses the `(session_id, idempotency_key)` conflict target and reports ignored duplicate inserts.
