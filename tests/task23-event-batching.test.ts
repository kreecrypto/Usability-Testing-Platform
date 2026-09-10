import assert from "node:assert/strict";
import test from "node:test";

import { createEventCollectorHandler } from "../src/lib/collector/event-collector.ts";
import { createSupabaseEventPersister } from "../src/lib/collector/supabase-event-persistence.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent } from "../src/lib/tracking/events.ts";

const baseEvent = {
  schemaVersion: 2,
  eventId: "10000000-0000-4000-8000-000000000001",
  idempotencyKey: "session-1:1",
  eventLayer: "raw",
  source: "runner",
  eventType: "screen_view",
  occurredAt: "2026-09-09T10:00:00.000Z",
  sequence: 1,
  sessionId: "20000000-0000-4000-8000-000000000001",
  participantId: "30000000-0000-4000-8000-000000000001",
  testId: "40000000-0000-4000-8000-000000000001",
  testVersionId: "50000000-0000-4000-8000-000000000001",
  screenId: "checkout",
  metadata: {
    previousScreenId: "cart",
    currentScreenId: "checkout",
    navigationSource: "prototype",
  },
};

function request(body: unknown) {
  return new Request("https://collector.example/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("batch upload accepts multiple valid events with per-event receipts", async () => {
  const persisted: AcceptedTrackingEvent<RawTrackingEvent>[] = [];
  const handler = createEventCollectorHandler({
    now: () => new Date("2026-09-09T10:00:05.000Z"),
    persist: async (event) => {
      persisted.push(event);
      return "accepted";
    },
  });
  const secondEvent = {
    ...baseEvent,
    eventId: "10000000-0000-4000-8000-000000000002",
    idempotencyKey: "session-1:2",
    sequence: 2,
    occurredAt: "2026-09-09T10:00:01.000Z",
  };

  const response = await handler(request({ events: [baseEvent, secondEvent] }));
  assert.equal(response.status, 202);
  assert.equal(persisted.length, 2);
  assert.deepEqual(await response.json(), {
    events: [
      { eventId: baseEvent.eventId, receivedAt: "2026-09-09T10:00:05.000Z", status: "accepted" },
      { eventId: secondEvent.eventId, receivedAt: "2026-09-09T10:00:05.000Z", status: "accepted" },
    ],
    summary: { received: 2, accepted: 2, duplicate: 0 },
  });
});

test("invalid event in a batch rejects the whole upload before persistence", async () => {
  let persisted = 0;
  const handler = createEventCollectorHandler({ persist: async () => { persisted += 1; return "accepted"; } });
  const response = await handler(request({
    events: [baseEvent, { ...baseEvent, eventId: "bad-id", idempotencyKey: "session-1:2", sequence: 2 }],
  }));
  assert.equal(response.status, 400);
  assert.equal(persisted, 0);
});

test("retrying transient persistence failures eventually accepts without leaking raw errors", async () => {
  let attempts = 0;
  const handler = createEventCollectorHandler({
    maxPersistenceAttempts: 3,
    persist: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary provider secret detail");
      return "accepted";
    },
  });
  const response = await handler(request(baseEvent));
  assert.equal(response.status, 202);
  assert.equal(attempts, 3);
  assert.equal((await response.text()).includes("provider secret detail"), false);
});

test("retry exhaustion returns generic 503 without partial batch response details", async () => {
  let attempts = 0;
  const handler = createEventCollectorHandler({
    maxPersistenceAttempts: 2,
    persist: async () => {
      attempts += 1;
      throw new Error("provider-specific failure");
    },
  });
  const response = await handler(request({ events: [baseEvent, { ...baseEvent, eventId: "10000000-0000-4000-8000-000000000002", idempotencyKey: "session-1:2", sequence: 2 }] }));
  assert.equal(response.status, 503);
  assert.equal(attempts, 2);
  assert.deepEqual(await response.json(), { error: "ingestion_unavailable" });
});

test("duplicate idempotency keys inside the same batch are suppressed before a second write", async () => {
  const writes: string[] = [];
  const handler = createEventCollectorHandler({
    now: () => new Date("2026-09-09T10:00:05.000Z"),
    persist: async (event) => {
      writes.push(event.idempotencyKey);
      return "accepted";
    },
  });
  const duplicateDelivery = {
    ...baseEvent,
    eventId: "60000000-0000-4000-8000-000000000099",
  };

  const response = await handler(request({ events: [baseEvent, duplicateDelivery] }));
  assert.equal(response.status, 202);
  assert.deepEqual(writes, [baseEvent.idempotencyKey]);
  assert.deepEqual(await response.json(), {
    events: [
      {
        eventId: baseEvent.eventId,
        receivedAt: "2026-09-09T10:00:05.000Z",
        status: "accepted",
      },
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
  const insertHeaders = new Headers(calls[1].init?.headers);
  assert.equal(insertHeaders.get("prefer"), "resolution=ignore-duplicates,return=representation");
  assert.equal(insertHeaders.get("apikey"), "sb_secret_server_only");
  assert.equal(insertHeaders.has("authorization"), false);
});
