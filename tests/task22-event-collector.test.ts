import assert from "node:assert/strict";
import test from "node:test";

import {
  createEventCollectorHandler,
  validateRawTrackingEvent,
  type PersistAcceptedEvent,
} from "../src/lib/collector/event-collector.ts";
import type { RawTrackingEvent } from "../src/lib/tracking/events.ts";

const validEvent: RawTrackingEvent = {
  schemaVersion: 2,
  eventId: "evt-0001",
  idempotencyKey: "session-1:1",
  eventLayer: "raw",
  source: "runner",
  eventType: "task_started",
  occurredAt: "2026-09-08T17:10:00.000Z",
  sequence: 1,
  sessionId: "10000000-0000-4000-8000-000000000001",
  participantId: "20000000-0000-4000-8000-000000000001",
  testId: "30000000-0000-4000-8000-000000000001",
  testVersionId: "40000000-0000-4000-8000-000000000001",
  taskId: "50000000-0000-4000-8000-000000000001",
};

function request(body: unknown, init?: RequestInit): Request {
  return new Request("https://collector.example/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

test("valid raw canonical event is accepted only after persistence and gets server receivedAt", async () => {
  const persisted: unknown[] = [];
  const persist: PersistAcceptedEvent = async (event) => {
    persisted.push(event);
  };
  const handler = createEventCollectorHandler({
    persist,
    now: () => new Date("2026-09-08T17:10:05.000Z"),
  });

  const response = await handler(request(validEvent));
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    eventId: "evt-0001",
    receivedAt: "2026-09-08T17:10:05.000Z",
    status: "accepted",
  });
  assert.equal(persisted.length, 1);
  assert.equal((persisted[0] as { receivedAt: string }).receivedAt, "2026-09-08T17:10:05.000Z");
});

test("malformed and derived events are rejected before persistence", async () => {
  let writes = 0;
  const handler = createEventCollectorHandler({
    persist: async () => {
      writes += 1;
    },
  });

  const malformed = await handler(
    request({ ...validEvent, schemaVersion: 1, sequence: -1, sessionId: "not-a-uuid" }),
  );
  assert.equal(malformed.status, 400);

  const derived = await handler(
    request({
      ...validEvent,
      eventLayer: "derived",
      eventType: "task_success",
      source: "analytics",
    }),
  );
  assert.equal(derived.status, 400);
  assert.equal(writes, 0);
});

test("client cannot spoof collector-owned receivedAt", () => {
  const validation = validateRawTrackingEvent({
    ...validEvent,
    receivedAt: "2000-01-01T00:00:00.000Z",
  });
  assert.equal(validation.ok, false);
  if (!validation.ok) {
    assert.ok(validation.errors.some((error) => error.field === "receivedAt"));
  }
});

test("invalid JSON, content type, route, and method fail explicitly", async () => {
  const handler = createEventCollectorHandler({ persist: async () => undefined });

  const invalidJson = await handler(
    new Request("https://collector.example/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  );
  assert.equal(invalidJson.status, 400);

  const wrongType = await handler(
    new Request("https://collector.example/v1/events", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    }),
  );
  assert.equal(wrongType.status, 415);

  const wrongRoute = await handler(new Request("https://collector.example/health"));
  assert.equal(wrongRoute.status, 404);

  const wrongMethod = await handler(new Request("https://collector.example/v1/events"));
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");
});

test("persistence failures return generic 503 without leaking credential or raw provider error", async () => {
  const secret = "SUPABASE_SERVICE_ROLE_DO_NOT_LEAK";
  const handler = createEventCollectorHandler({
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
