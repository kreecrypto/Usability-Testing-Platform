import assert from "node:assert/strict";
import test from "node:test";

import { createEventCollectorHandler } from "../src/lib/collector/event-collector.ts";
import { createSupabaseEventPersister } from "../src/lib/collector/supabase-event-persistence.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent } from "../src/lib/tracking/events.ts";

const validEvent = {
  schemaVersion: 2,
  eventId: "10000000-0000-4000-8000-000000000001",
  idempotencyKey: "session-1:1",
  eventLayer: "raw",
  source: "runner",
  eventType: "screen_view",
  occurredAt: "2026-09-08T17:10:00.000Z",
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

function request(body: unknown, init?: RequestInit) {
  return new Request("https://collector.example/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

test("valid raw canonical event is accepted only after persistence and gets server receivedAt", async () => {
  const persisted: AcceptedTrackingEvent<RawTrackingEvent>[] = [];
  const handler = createEventCollectorHandler({
    now: () => new Date("2026-09-08T17:10:05.000Z"),
    persist: async (event) => {
      persisted.push(event);
      return "accepted";
    },
  });

  const response = await handler(request(validEvent));
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].receivedAt, "2026-09-08T17:10:05.000Z");
  assert.deepEqual(await response.json(), {
    eventId: validEvent.eventId,
    receivedAt: "2026-09-08T17:10:05.000Z",
    status: "accepted",
  });
});

test("malformed and derived events are rejected before persistence", async () => {
  let persisted = 0;
  const handler = createEventCollectorHandler({ persist: async () => { persisted += 1; return "accepted"; } });

  const missingIdentity = { ...validEvent } as Record<string, unknown>;
  delete missingIdentity.participantId;
  assert.equal((await handler(request(missingIdentity))).status, 400);

  const invalidSequence = { ...validEvent, sequence: 0 };
  assert.equal((await handler(request(invalidSequence))).status, 400);

  const derivedEvent = {
    ...validEvent,
    eventLayer: "derived",
    source: "rules_engine",
    eventType: "task_success",
    derivedFromEventIds: [validEvent.eventId],
    ruleVersion: "success-v1",
  };
  assert.equal((await handler(request(derivedEvent))).status, 400);
  assert.equal(persisted, 0);
});

test("client cannot spoof collector-owned receivedAt", async () => {
  let persisted = 0;
  const handler = createEventCollectorHandler({ persist: async () => { persisted += 1; return "accepted"; } });
  const response = await handler(request({ ...validEvent, receivedAt: "2026-09-08T17:09:59.000Z" }));
  assert.equal(response.status, 400);
  assert.equal(persisted, 0);
});

test("invalid JSON, content type, route, and method fail explicitly", async () => {
  const handler = createEventCollectorHandler({ persist: async () => "accepted" });

  const invalidJson = new Request("https://collector.example/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal((await handler(invalidJson)).status, 400);

  const wrongContentType = new Request("https://collector.example/v1/events", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify(validEvent),
  });
  assert.equal((await handler(wrongContentType)).status, 415);

  const wrongRoute = new Request("https://collector.example/not-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validEvent),
  });
  assert.equal((await handler(wrongRoute)).status, 404);

  const wrongMethod = new Request("https://collector.example/v1/events", { method: "GET" });
  const wrongMethodResponse = await handler(wrongMethod);
  assert.equal(wrongMethodResponse.status, 405);
  assert.equal(wrongMethodResponse.headers.get("allow"), "POST");
});

test("persistence failures return generic 503 without leaking credential or raw provider error", async () => {
  const secret = "service-role-secret-must-not-leak";
  const handler = createEventCollectorHandler({
    maxPersistenceAttempts: 1,
    persist: async () => {
      throw new Error(`database failed with token ${secret}`);
    },
  });

  const response = await handler(request(validEvent));
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.equal(body.includes(secret), false);
  assert.equal(body.includes("database failed"), false);
  assert.deepEqual(JSON.parse(body), { error: "ingestion_unavailable" });
});

test("Supabase persister resolves trusted workspace from session before inserting event", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const secret = "sb_secret_server_only";
  const acceptedEvent: AcceptedTrackingEvent<RawTrackingEvent> = {
    ...validEvent,
    eventId: "60000000-0000-4000-8000-000000000001",
    receivedAt: "2026-09-08T17:10:05.000Z",
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
    return new Response(null, { status: 201 });
  };

  const persist = createSupabaseEventPersister({
    supabaseUrl: "https://example.supabase.co",
    secretKey: secret,
    fetchImpl,
  });
  await persist(acceptedEvent);

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/rest\/v1\/sessions\?/);
  const lookupHeaders = new Headers(calls[0].init?.headers);
  assert.equal(lookupHeaders.get("apikey"), secret);
  assert.equal(lookupHeaders.has("authorization"), false);
  assert.match(calls[1].url, /\/rest\/v1\/events\?on_conflict=session_id%2Cidempotency_key&select=event_id%2Cidempotency_key$/);

  const stored = JSON.parse(String(calls[1].init?.body)) as Record<string, unknown>;
  assert.equal(stored.workspace_id, "70000000-0000-4000-8000-000000000001");
  assert.equal(stored.session_id, acceptedEvent.sessionId);
  assert.equal(stored.participant_id, acceptedEvent.participantId);
  assert.equal(stored.test_id, acceptedEvent.testId);
  assert.equal(stored.test_version_id, acceptedEvent.testVersionId);
  assert.equal(stored.event_id, acceptedEvent.eventId);
});

test("Supabase persister rejects participant/test/version spoofing before event insert", async () => {
  let calls = 0;
  const acceptedEvent: AcceptedTrackingEvent<RawTrackingEvent> = {
    ...validEvent,
    eventId: "60000000-0000-4000-8000-000000000002",
    receivedAt: "2026-09-08T17:10:05.000Z",
  };
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json([
      {
        workspace_id: "70000000-0000-4000-8000-000000000001",
        participant_id: "30000000-0000-4000-8000-000000000099",
        test_id: acceptedEvent.testId,
        test_version_id: acceptedEvent.testVersionId,
      },
    ]);
  };

  const persist = createSupabaseEventPersister({
    supabaseUrl: "https://example.supabase.co",
    secretKey: "sb_secret_server_only",
    fetchImpl,
  });

  await assert.rejects(() => persist(acceptedEvent), /session_context_mismatch/);
  assert.equal(calls, 1);
});
