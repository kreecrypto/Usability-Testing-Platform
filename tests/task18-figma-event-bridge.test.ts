import assert from "node:assert/strict";
import test from "node:test";

import { createFigmaInteractionEventBridge } from "../src/lib/figma/event-bridge.ts";
import type { RawTrackingEvent } from "../src/lib/tracking/events.ts";

const expectedSource = { iframe: "figma" };
const session = {
  sessionId: "10000000-0000-4000-8000-000000000001",
  participantId: "20000000-0000-4000-8000-000000000001",
  testId: "30000000-0000-4000-8000-000000000001",
  testVersionId: "40000000-0000-4000-8000-000000000001",
  taskId: "50000000-0000-4000-8000-000000000001",
};

function figmaMessage(type: string, data: unknown, source: unknown = expectedSource) {
  return {
    origin: "https://www.figma.com",
    source,
    data: { type, data },
  };
}

const mousePayload = {
  presentedNodeId: "10:1",
  handled: true,
  targetNodeId: "10:99",
  targetNodeMousePosition: { x: 10, y: 20 },
  nearestScrollingFrameId: "10:2",
  nearestScrollingFrameMousePosition: { x: 50, y: 60 },
  nearestScrollingFrameOffset: { x: 0, y: 100 },
};

test("accepts only the exact Figma origin and expected iframe window", async () => {
  const emitted: RawTrackingEvent[] = [];
  const bridge = createFigmaInteractionEventBridge({
    expectedSource,
    session,
    emitTrackingEvent: (event) => emitted.push(event),
    now: () => new Date("2026-09-09T06:20:00.000Z"),
    eventIdFactory: (sequence) => `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  });

  assert.deepEqual(
    await bridge.handleMessage({
      ...figmaMessage("MOUSE_PRESS_OR_RELEASE", mousePayload),
      origin: "https://evil.example",
    }),
    { status: "ignored_origin" },
  );
  assert.deepEqual(
    await bridge.handleMessage(figmaMessage("MOUSE_PRESS_OR_RELEASE", mousePayload, { iframe: "other" })),
    { status: "ignored_source" },
  );
  assert.equal(emitted.length, 0);
  assert.deepEqual(bridge.getState(), { sequence: 0, currentScreenId: undefined });
});

test("wraps supported Figma pointer evidence in the canonical internal envelope", async () => {
  const emitted: RawTrackingEvent[] = [];
  const bridge = createFigmaInteractionEventBridge({
    expectedSource,
    session,
    initialScreenId: "9:1",
    emitTrackingEvent: (event) => emitted.push(event),
    now: () => new Date("2026-09-09T06:20:00.000Z"),
    eventIdFactory: (sequence) => `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  });

  const result = await bridge.handleMessage(figmaMessage("MOUSE_PRESS_OR_RELEASE", mousePayload));
  assert.equal(result.status, "emitted");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].schemaVersion, 2);
  assert.equal(emitted[0].eventType, "pointer_interaction");
  assert.equal(emitted[0].source, "prototype_adapter");
  assert.equal(emitted[0].sequence, 1);
  assert.equal(emitted[0].occurredAt, "2026-09-09T06:20:00.000Z");
  assert.equal(emitted[0].idempotencyKey, `${session.sessionId}:figma:1`);
  assert.equal(emitted[0].screenId, "10:1");
  assert.deepEqual(emitted[0].metadata?.nearestScrollingFrameOffset, { x: 0, y: 100 });
});

test("keeps navigation sequence/current screen deterministic for later component-state events", async () => {
  const emitted: RawTrackingEvent[] = [];
  const bridge = createFigmaInteractionEventBridge({
    expectedSource,
    session,
    initialScreenId: "10:1",
    emitTrackingEvent: (event) => emitted.push(event),
    now: () => new Date("2026-09-09T06:21:00.000Z"),
    eventIdFactory: (sequence) => `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  });

  await bridge.handleMessage(figmaMessage("PRESENTED_NODE_CHANGED", {
    presentedNodeId: "20:1",
    isStoredInHistory: true,
    stateMappings: {},
  }));
  await bridge.handleMessage(figmaMessage("NEW_STATE", {
    nodeId: "20:component",
    currentVariantId: "20:a",
    newVariantId: "20:b",
    isStoredInHistory: false,
    isTimedChange: false,
  }));

  assert.equal(emitted[0].eventType, "screen_view");
  assert.equal(emitted[0].sequence, 1);
  assert.equal(emitted[0].metadata?.previousScreenId, "10:1");
  assert.equal(emitted[0].metadata?.currentScreenId, "20:1");
  assert.equal(emitted[1].eventType, "component_state_changed");
  assert.equal(emitted[1].sequence, 2);
  assert.equal(emitted[1].screenId, "20:1");
  assert.deepEqual(bridge.getState(), { sequence: 2, currentScreenId: "20:1" });
});

test("keeps access/lifecycle messages operational and outside the usability raw stream", async () => {
  const emitted: RawTrackingEvent[] = [];
  const operational: string[] = [];
  const bridge = createFigmaInteractionEventBridge({
    expectedSource,
    session,
    emitTrackingEvent: (event) => emitted.push(event),
    onOperationalSignal: (signal) => operational.push(signal),
    eventIdFactory: () => "20000000-0000-4000-8000-000000000001",
  });

  assert.deepEqual(await bridge.handleMessage(figmaMessage("LOGIN_SCREEN_SHOWN", {})), {
    status: "operational",
    signal: "login_screen_shown",
  });
  assert.deepEqual(await bridge.handleMessage(figmaMessage("PASSWORD_SCREEN_SHOWN", {})), {
    status: "operational",
    signal: "password_screen_shown",
  });
  assert.equal(emitted.length, 0);
  assert.deepEqual(operational, ["login_screen_shown", "password_screen_shown"]);
  assert.equal(bridge.getState().sequence, 0);
});

test("fails closed for unsupported or malformed provider messages without consuming sequence", async () => {
  const emitted: RawTrackingEvent[] = [];
  const bridge = createFigmaInteractionEventBridge({
    expectedSource,
    session,
    emitTrackingEvent: (event) => emitted.push(event),
    now: () => new Date("2026-09-09T06:22:00.000Z"),
    eventIdFactory: (sequence) => `30000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  });

  assert.deepEqual(await bridge.handleMessage(figmaMessage("SCROLL", { y: 100 })), {
    status: "ignored_unsupported",
    providerEventType: "SCROLL",
  });
  assert.deepEqual(await bridge.handleMessage(figmaMessage("MOUSE_PRESS_OR_RELEASE", {
    presentedNodeId: "10:1",
  })), {
    status: "invalid_provider_event",
    providerEventType: "MOUSE_PRESS_OR_RELEASE",
  });
  assert.equal(emitted.length, 0);
  assert.equal(bridge.getState().sequence, 0);

  await bridge.handleMessage(figmaMessage("MOUSE_PRESS_OR_RELEASE", mousePayload));
  assert.equal(emitted[0].sequence, 1);
});

test("does not advance sequence or screen state when the downstream event sink fails", async () => {
  let fail = true;
  const emitted: RawTrackingEvent[] = [];
  const bridge = createFigmaInteractionEventBridge({
    expectedSource,
    session,
    initialScreenId: "10:1",
    emitTrackingEvent: async (event) => {
      if (fail) throw new Error("sink unavailable");
      emitted.push(event);
    },
    now: () => new Date("2026-09-09T06:23:00.000Z"),
    eventIdFactory: (sequence) => `40000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  });

  await assert.rejects(
    () => bridge.handleMessage(figmaMessage("PRESENTED_NODE_CHANGED", {
      presentedNodeId: "20:1",
      isStoredInHistory: true,
      stateMappings: {},
    })),
    /sink unavailable/,
  );
  assert.deepEqual(bridge.getState(), { sequence: 0, currentScreenId: "10:1" });

  fail = false;
  await bridge.handleMessage(figmaMessage("PRESENTED_NODE_CHANGED", {
    presentedNodeId: "20:1",
    isStoredInHistory: true,
    stateMappings: {},
  }));
  assert.equal(emitted[0].sequence, 1);
  assert.deepEqual(bridge.getState(), { sequence: 1, currentScreenId: "20:1" });
});
