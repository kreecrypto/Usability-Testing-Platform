import assert from "node:assert/strict";
import test from "node:test";
import { withSessionIngestionAuth } from "../src/lib/collector/authenticated-event-collector.ts";
import { mintSessionIngestionToken, verifySessionIngestionToken } from "../src/lib/collector/session-ingestion-token.ts";

const sessionId = "10000000-0000-4000-8000-000000000001";
const testVersionId = "40000000-0000-4000-8000-000000000001";
const signingKey = "unit-test-signing-key";
const now = new Date("2026-09-09T03:00:00.000Z");

function makeToken() {
  return mintSessionIngestionToken({ signingKey, sessionId, testVersionId, expiresAt: new Date("2026-09-09T03:05:00.000Z"), tokenId: "token-0000000000000001" });
}

const event = { sessionId, testVersionId };

function request(token: string, body: unknown) {
  return new Request("https://collector.example/v1/events", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
}

test("token is session/version bound and expires", () => {
  const signed = makeToken();
  const claims = verifySessionIngestionToken({ token: signed, signingKey, now });
  assert.equal(claims?.sessionId, sessionId);
  assert.equal(claims?.testVersionId, testVersionId);
  assert.equal(verifySessionIngestionToken({ token: signed, signingKey: "wrong-key", now }), null);
  assert.equal(verifySessionIngestionToken({ token: signed, signingKey, now: new Date("2026-09-09T03:05:00.000Z") }), null);
});

test("context mismatch is rejected before consumption", async () => {
  let consumed = 0;
  const handler = withSessionIngestionAuth({ handler: async () => new Response(null, { status: 202 }), signingKey, consume: async () => { consumed += 1; return "accepted"; }, now: () => now });
  const response = await handler(request(makeToken(), { ...event, sessionId: "10000000-0000-4000-8000-000000000099" }));
  assert.equal(response.status, 403);
  assert.equal(consumed, 0);
});

test("replay and rate limit gate outcomes stop ingestion", async () => {
  const outcomes = ["accepted", "replayed", "rate_limited"] as const;
  let index = 0;
  let collectorCalls = 0;
  const handler = withSessionIngestionAuth({ handler: async () => { collectorCalls += 1; return new Response(null, { status: 202 }); }, signingKey, consume: async () => outcomes[index++] ?? "replayed", now: () => now });
  assert.equal((await handler(request(makeToken(), event))).status, 202);
  assert.equal((await handler(request(makeToken(), event))).status, 409);
  assert.equal((await handler(request(makeToken(), event))).status, 429);
  assert.equal(collectorCalls, 1);
});
