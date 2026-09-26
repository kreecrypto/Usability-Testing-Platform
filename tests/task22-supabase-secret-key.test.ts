import assert from "node:assert/strict";
import test from "node:test";

import { createSupabaseAdminFetch } from "../src/lib/supabase-admin-fetch.ts";
import { createSupabaseEventPersister } from "../src/lib/collector/supabase-event-persistence.ts";
import { createSupabaseIngestionTokenConsumer } from "../src/lib/collector/supabase-ingestion-token-gate.ts";
import { createSupabaseDeadLetterRecorder } from "../src/lib/collector/supabase-event-dead-letter.ts";
import type { AcceptedTrackingEvent } from "../src/lib/tracking/events.ts";

const secretKey = "sb_secret_task22_regression_key";
const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "22222222-2222-4222-8222-222222222222";
const participantId = "33333333-3333-4333-8333-333333333333";
const testId = "44444444-4444-4444-8444-444444444444";
const testVersionId = "55555555-5555-4555-8555-555555555555";

const event: AcceptedTrackingEvent = {
  schemaVersion: 2,
  eventId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "task22:session:1",
  eventLayer: "raw",
  source: "runner",
  eventType: "screen_view",
  occurredAt: "2026-09-10T00:00:00.000Z",
  receivedAt: "2026-09-10T00:00:00.100Z",
  sequence: 1,
  sessionId,
  participantId,
  testId,
  testVersionId,
  screenId: "checkout",
  metadata: {
    previousScreenId: "cart",
    currentScreenId: "checkout",
    navigationSource: "prototype",
  },
};

function assertOpaqueSecretHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("apikey"), secretKey);
  assert.equal(headers.has("authorization"), false);
}

test("shared admin fetch strips Bearer auth for sb_secret keys but preserves legacy JWT auth", async () => {
  let modernHeaders = new Headers();
  const modernFetch = createSupabaseAdminFetch(secretKey, (async (_input, init) => {
    modernHeaders = new Headers(init?.headers);
    return new Response(null, { status: 204 });
  }) as typeof fetch);

  await modernFetch("https://example.supabase.co/rest/v1/events", {
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` },
  });
  assert.equal(modernHeaders.get("apikey"), secretKey);
  assert.equal(modernHeaders.has("authorization"), false);

  const legacyKey = "eyJlegacy-service-role-jwt";
  let legacyHeaders = new Headers();
  const legacyFetch = createSupabaseAdminFetch(legacyKey, (async (_input, init) => {
    legacyHeaders = new Headers(init?.headers);
    return new Response(null, { status: 204 });
  }) as typeof fetch);

  await legacyFetch("https://example.supabase.co/rest/v1/events", {
    headers: { apikey: legacyKey, authorization: `Bearer ${legacyKey}` },
  });
  assert.equal(legacyHeaders.get("authorization"), `Bearer ${legacyKey}`);
});

test("Task 22 event persistence uses sb_secret as apikey only and keeps dedupe insert contract", async () => {
  let call = 0;
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assertOpaqueSecretHeaders(init);
    call += 1;
    if (call === 1) {
      return Response.json([{ workspace_id: workspaceId, participant_id: participantId, test_id: testId, test_version_id: testVersionId }]);
    }
    assert.equal(new Headers(init?.headers).get("prefer"), "resolution=ignore-duplicates,return=representation");
    return Response.json([{ event_id: event.eventId, idempotency_key: event.idempotencyKey }], { status: 201 });
  }) as typeof fetch;

  const persist = createSupabaseEventPersister({ supabaseUrl: "https://example.supabase.co", secretKey, fetchImpl });
  assert.equal(await persist(event), "accepted");
  assert.equal(call, 2);
});

test("Task 22 ingestion-token gate uses sb_secret as apikey only", async () => {
  const consume = createSupabaseIngestionTokenConsumer({
    supabaseUrl: "https://example.supabase.co",
    secretKey,
    rateLimitPerMinute: 60,
    fetchImpl: (async (_input, init) => {
      assertOpaqueSecretHeaders(init);
      return Response.json("accepted");
    }) as typeof fetch,
  });

  assert.equal(await consume({ sessionId, testVersionId, exp: 1800000000, jti: "task22-token-0001" }), "accepted");
});

test("Task 22 DLQ recorder uses sb_secret as apikey only", async () => {
  const record = createSupabaseDeadLetterRecorder({
    supabaseUrl: "https://example.supabase.co",
    secretKey,
    fetchImpl: (async (_input, init) => {
      assertOpaqueSecretHeaders(init);
      assert.equal(new Headers(init?.headers).get("prefer"), "resolution=merge-duplicates,return=minimal");
      return new Response(null, { status: 201 });
    }) as typeof fetch,
  });

  await record(event, 3);
});
