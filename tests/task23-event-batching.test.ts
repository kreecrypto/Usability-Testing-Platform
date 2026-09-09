import assert from "node:assert/strict";
import test from "node:test";

import {
  createEventCollectorHandler,
  type PersistAcceptedEvent,
} from "../src/lib/collector/event-collector.ts";
import { createSupabaseEventPersister } from "../src/lib/collector/supabase-event-persistence.ts";
import type {
  AcceptedTrackingEvent,
  RawTrackingEvent,
} from "../src/lib/tracking/events.ts";

const baseEvent: RawTrackingEvent = {
  schemaVersion: 2,
  eventId: "60000000-0000-4000-8000-000000000001",
  idempotencyKey: "session-1:1",
  eventLayer: "raw",
  source: "runner",
  eventType: "task_started",
  occurredAt: "2026-09-09T10:00:00.000Z",
  sequence: 1,
  sessionId: "10000000-0000-4000-8000-000000000001",
  participantId: "20000000-0000-4000-8000-000000000001",
  testId: "30000000-0000-4000-8000-000000000001",
  testVersionId: "40000000-0000-4000-8000-000000000001",
  taskId: "50000000-0000-4000-8000-000000000001",
};

function event(overrides: Partial<RawTrackingEvent>): RawTrackingEvent {
  return { ...baseEvent, ...overrides };
}

function request(body: unknown): Request {
  return new Request("https://collector.example/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("batch upload accepts multiple valid events with per-event receipts", async () => {
  const persisted: AcceptedTrackingEvent<RawTrackingEvent>[] = [];
  const handler = createEventCollectorHandler({
    persist: async (acceptedEvent) => {
      persisted.push(acceptedEvent);
      return "accepted";
    },
    now: () => new Date("2026-09-09T10:00:05.000Z"),
  });

  const response = await handler(
    request({
      events: [
        baseEvent,
        event({
          eventId: "60000000-0000-4000-8000-000000000002",
          idempotencyKey: "session-1:2",
          eventType: "screen_view",
          sequence: 2,
        }),
      ],
    }),
  );

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    status: "accepted",
    accepted: [
      {
        eventId: "60000000-0000-4000-8000-000000000001",
        receivedAt: "2026-09-09T10:00:05.000Z",
        status: "accepted",
      },
      {
        eventId: "60000000-0000-4000-8000-000000000002",
        receivedAt: "2026-09-09T10:00:05.000Z",
        status: "accepted",
      },
    ],
    duplicates: [],
    summary: { received: 2, accepted: 2, duplicate: 0 },
  });
  assert.equal(persisted.length, 2);
});

test("invalid event in a batch rejects the whole upload before persistence", async () => {
  let writes = 0;
  const handler = createEventCollectorHandler({
    persist: async () => {
      writes += 1;
      return "accepted";
    },
  });

  const response = await handler(
    request({
      events: [
        baseEvent,
        event({
          eventId: "60000000-0000-4000-8000-000000000002",
          idempotencyKey: "session-1:2",
          sequence: -1,
        }),
      ],
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(writes, 0);
  const body = await response.json() as { details: Array<{ field: string }> };
  assert.ok(body.details.some((detail) => detail.field === "events[1].sequence"));
});

test("retrying transient persistence failures eventually accepts without leaking raw errors", async () => {
  let attempts = 0;
  const handler = createEventCollectorHandler({
    persist: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("temporary database timeout with secret value");
      }
      return "accepted";
    },
    maxPersistenceAttempts: 3,
    now: () => new Date("2026-09-09T10:00:05.000Z"),
  });

  const response = await handler(request({ events: [baseEvent] }));

  assert.equal(response.status, 202);
  assert.equal(attempts, 3);
  assert.equal(JSON.stringify(await response.json()).includes("secret value"), false);
});

test("retry exhaustion returns generic 503 without partial batch response details", async () => {
  let attempts = 0;
  const handler = createEventCollectorHandler({
    persist: async () => {
      attempts += 1;
      throw new Error("database token should stay hidden");
    },
    maxPersistenceAttempts: 2,
  });

  const response = await handler(request({ events: [baseEvent] }));

  assert.equal(response.status, 503);
  assert.equal(attempts, 2);
  const body = await response.text();
  assert.equal(body.includes("database token"), false);
  assert.deepEqual(JSON.parse(body), { error: "ingestion_unavailable" });
});

test("duplicate idempotency keys inside the same batch are suppressed before a second write", async () => {
  const persisted: string[] = [];
  const handler = createEventCollectorHandler({
    persist: async (acceptedEvent) => {
      persisted.push(acceptedEvent.idempotencyKey);
      return "accepted";
    },
    now: () => new Date("2026-09-09T10:00:05.000Z"),
  });

  const response = await handler(
    request({
      events: [
        baseEvent,
        event({
          eventId: "60000000-0000-4000-8000-000000000099",
          sequence: 99,
        }),
      ],
    }),
  );

  assert.equal(response.status, 202);
  assert.equal(persisted.length, 1);
  assert.deepEqual(await response.json(), {
    status: "accepted",
    accepted: [
      {
        eventId: "60000000-0000-4000-8000-000000000001",
        receivedAt: "2026-09-09T10:00:05.000Z",
        status: "accepted",
      },
    ],
    duplicates: [
      {
        eventId: "60000000-0000-4000-8000-000000000099",
        receivedAt: "2026-09-09T10:00:05.000Z",
        status: "duplicate",
      },
    ],
    summary: { received: 2, accepted: 1, duplicate: 1 },
  });
});

test("Supabase persister uses idempotency conflict target and reports ignored duplicate inserts", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const acceptedEvent: AcceptedTrackingEvent<RawTrackingEvent> = {
    ...baseEvent,
    receivedAt: "2026-09-09T10:00:05.000Z",
  };

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/rest/v1/sessions?")) {
      return Response.json([
        {
          workspace_id: "70000000-0000-4000-8000-000000000001",
          participant_id: acceptedEvent.participantId,
          test_id: acceptedEvent.testId,
          test_version_id: acceptedEvent.testVersionId,
        },
      ]);
    }
    return Response.json([], { status: 201 });
  };

  const persist = createSupabaseEventPersister({
    supabaseUrl: "https://example.supabase.co",
    secretKey: "sb_secret_server_only",
    fetchImpl,
  });

  assert.equal(await persist(acceptedEvent), "duplicate");
  assert.match(calls[1].url, /\/rest\/v1\/events\?on_conflict=session_id%2Cidempotency_key&select=event_id%2Cidempotency_key$/);
  assert.equal(
    (calls[1].init?.headers as Record<string, string>).prefer,
    "resolution=ignore-duplicates,return=representation",
  );
});
