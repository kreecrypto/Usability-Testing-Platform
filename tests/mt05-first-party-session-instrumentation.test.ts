import assert from "node:assert/strict";
import test from "node:test";
import type { TrackingEvent } from "../src/lib/tracking/events.ts";
import { createFirstPartySessionInstrumentation } from "../src/lib/web/first-party-session-instrumentation.ts";

const context = Object.freeze({
  sessionId: "11111111-1111-4111-8111-111111111111",
  participantId: "22222222-2222-4222-8222-222222222222",
  testId: "33333333-3333-4333-8333-333333333333",
  testVersionId: "44444444-4444-4444-8444-444444444444",
});

function memoryStorage() {
  let events: readonly TrackingEvent[] = [];
  return {
    storage: {
      async load() { return events; },
      async save(next: readonly TrackingEvent[]) { events = [...next]; },
    },
    read: () => events,
  };
}

test("consent gates evidence and accepted batches clear the outbox", async () => {
  const memory = memoryStorage();
  let consent = false;
  const requests: Array<{ authorization: string | null; events: TrackingEvent[] }> = [];
  const runtime = createFirstPartySessionInstrumentation({
    context,
    hasConsent: () => consent,
    storage: memory.storage,
    refreshCredential: async () => ({ token: "session-token", expiresAt: "2099-01-01T00:00:00.000Z" }),
    randomId: () => "55555555-5555-4555-8555-555555555555",
    now: () => "2026-09-22T05:00:00.000Z",
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { events: TrackingEvent[] };
      requests.push({ authorization: new Headers(init?.headers).get("authorization"), events: body.events });
      return new Response(JSON.stringify({ accepted: body.events.length }), { status: 202 });
    },
  });

  assert.equal(await runtime.instrumentation.recordScreenView("/checkout"), null);
  assert.equal(memory.read().length, 0);

  consent = true;
  await runtime.instrumentation.recordScreenView("/checkout");
  assert.equal(memory.read().length, 1);
  assert.equal(requests.length, 0);

  assert.equal(await runtime.flush(), 1);
  assert.equal(memory.read().length, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.authorization, "Bearer session-token");
  assert.equal(requests[0]?.events[0]?.metadata.targetProvider, "first_party_web");
});

test("failed upload retains the same event identity for retry", async () => {
  const memory = memoryStorage();
  let attempts = 0;
  const deliveredIds: string[] = [];
  const runtime = createFirstPartySessionInstrumentation({
    context,
    hasConsent: () => true,
    storage: memory.storage,
    refreshCredential: async () => ({ token: `token-${attempts + 1}`, expiresAt: "2099-01-01T00:00:00.000Z" }),
    randomId: () => "66666666-6666-4666-8666-666666666666",
    fetchImpl: async (_input, init) => {
      attempts += 1;
      const body = JSON.parse(String(init?.body)) as { events: TrackingEvent[] };
      deliveredIds.push(body.events[0]!.eventId);
      return new Response("{}", { status: attempts === 1 ? 503 : 202 });
    },
  });

  await runtime.instrumentation.recordScreenView("/account");
  await assert.rejects(runtime.flush(), /event_upload_transient_failure/);
  assert.equal(memory.read().length, 1);

  assert.equal(await runtime.flush(), 1);
  assert.equal(memory.read().length, 0);
  assert.deepEqual(deliveredIds, [
    "66666666-6666-4666-8666-666666666666",
    "66666666-6666-4666-8666-666666666666",
  ]);
});
