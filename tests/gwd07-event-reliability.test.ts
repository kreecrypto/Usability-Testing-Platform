import assert from "node:assert/strict";
import test from "node:test";

import { createReliableEventPersister } from "../src/lib/collector/reliable-event-persistence.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent } from "../src/lib/tracking/events.ts";

const acceptedEvent: AcceptedTrackingEvent<RawTrackingEvent> = {
  schemaVersion: 2,
  eventId: "60000000-0000-4000-8000-000000000001",
  idempotencyKey: "session-1:1",
  eventLayer: "raw",
  source: "runner",
  eventType: "task_started",
  occurredAt: "2026-09-09T10:00:00.000Z",
  receivedAt: "2026-09-09T10:00:05.000Z",
  sequence: 1,
  sessionId: "10000000-0000-4000-8000-000000000001",
  participantId: "20000000-0000-4000-8000-000000000001",
  testId: "30000000-0000-4000-8000-000000000001",
  testVersionId: "40000000-0000-4000-8000-000000000001",
  taskId: "50000000-0000-4000-8000-000000000001",
};

test("transient persistence failure retries without DLQ when a later attempt succeeds", async () => {
  let attempts = 0;
  let deadLetters = 0;
  const persist = createReliableEventPersister({
    maxAttempts: 3,
    persist: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("transient");
      return "accepted";
    },
    recordDeadLetter: async () => { deadLetters += 1; },
  });

  assert.equal(await persist(acceptedEvent), "accepted");
  assert.equal(attempts, 3);
  assert.equal(deadLetters, 0);
});

test("poison event is recorded once after max attempts are exhausted", async () => {
  let attempts = 0;
  const deadLetters: Array<{ eventId: string; attemptCount: number }> = [];
  const persist = createReliableEventPersister({
    maxAttempts: 3,
    persist: async () => {
      attempts += 1;
      throw new Error("poison");
    },
    recordDeadLetter: async (event, attemptCount) => {
      deadLetters.push({ eventId: event.eventId, attemptCount });
    },
  });

  await assert.rejects(() => persist(acceptedEvent), /poison/);
  assert.equal(attempts, 3);
  assert.deepEqual(deadLetters, [{ eventId: acceptedEvent.eventId, attemptCount: 3 }]);
});

test("duplicate result is preserved through the reliability wrapper", async () => {
  const persist = createReliableEventPersister({
    maxAttempts: 3,
    persist: async () => "duplicate",
    recordDeadLetter: async () => { throw new Error("must not DLQ duplicate"); },
  });

  assert.equal(await persist(acceptedEvent), "duplicate");
});
