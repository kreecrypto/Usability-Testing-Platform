import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirstPartyMessageBridge,
  FIRST_PARTY_BRIDGE_PROTOCOL,
  FIRST_PARTY_BRIDGE_PROTOCOL_VERSION,
} from "../src/lib/web/first-party-message-bridge.ts";
import type { RawTrackingEvent } from "../src/lib/tracking/events.ts";

const session = Object.freeze({
  sessionId: "11111111-1111-4111-8111-111111111111",
  participantId: "22222222-2222-4222-8222-222222222222",
  testId: "33333333-3333-4333-8333-333333333333",
  testVersionId: "44444444-4444-4444-8444-444444444444",
  taskId: "55555555-5555-4555-8555-555555555555",
});

function message(source: object, type: string, data: Record<string, unknown>) {
  return {
    origin: "https://utp.example.com",
    source,
    data: {
      protocol: FIRST_PARTY_BRIDGE_PROTOCOL,
      version: FIRST_PARTY_BRIDGE_PROTOCOL_VERSION,
      type,
      data,
    },
  };
}

test("accepts only the exact approved origin and opened target window", async () => {
  const source = {};
  const other = {};
  const bridge = createFirstPartyMessageBridge({
    expectedOrigin: "https://utp.example.com",
    expectedSource: () => source,
    session,
    emitTrackingEvent: async () => undefined,
  });

  assert.equal((await bridge.handleMessage({ ...message(source, "ready", { bridgeVersion: "first-party-web-v1" }), origin: "https://evil.example" })).status, "ignored_origin");
  assert.equal((await bridge.handleMessage(message(other, "ready", { bridgeVersion: "first-party-web-v1" }))).status, "ignored_source");
  assert.equal((await bridge.handleMessage(message(source, "ready", { bridgeVersion: "wrong" }))).status, "invalid_provider_event");
});

test("turns approved target messages into sequenced canonical evidence", async () => {
  const source = {};
  const events: RawTrackingEvent[] = [];
  let ready = false;
  const bridge = createFirstPartyMessageBridge({
    expectedOrigin: "https://utp.example.com",
    expectedSource: () => source,
    session,
    initialSequence: 4,
    emitTrackingEvent: async (event) => { events.push(event); },
    onOperationalSignal: async () => { ready = true; },
  });

  const operational = await bridge.handleMessage(message(source, "ready", { bridgeVersion: "first-party-web-v1" }));
  assert.equal(operational.status, "operational");
  assert.equal(ready, true);

  const screen = await bridge.handleMessage(message(source, "screen_view", {
    screenId: "internal-validation:review",
    route: "/internal-validation-target/review",
    url: "https://utp.example.com/internal-validation-target/review",
  }));
  assert.equal(screen.status, "emitted");

  const complete = await bridge.handleMessage(message(source, "completion_signal", {
    signalId: "internal-validation-complete",
    screenId: "internal-validation:complete",
  }));
  assert.equal(complete.status, "emitted");

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.sequence), [5, 6]);
  assert.equal(events[0]?.metadata?.targetProvider, "first_party_web");
  assert.equal(events[0]?.metadata?.route, "/internal-validation-target/review");
  assert.equal(events[1]?.metadata?.signalId, "internal-validation-complete");
});

test("does not swallow event delivery failure as provider validation", async () => {
  const source = {};
  const bridge = createFirstPartyMessageBridge({
    expectedOrigin: "https://utp.example.com",
    expectedSource: () => source,
    session,
    emitTrackingEvent: async () => { throw new Error("outbox_unavailable"); },
  });

  await assert.rejects(
    () => bridge.handleMessage(message(source, "screen_view", {
      screenId: "internal-validation:start",
      route: "/internal-validation-target/start",
    })),
    /outbox_unavailable/,
  );
});
