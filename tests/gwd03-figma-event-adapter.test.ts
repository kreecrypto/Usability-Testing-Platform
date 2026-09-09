import assert from "node:assert/strict";
import test from "node:test";

import { validateRawTrackingEvent } from "../src/lib/collector/event-collector.ts";
import {
  adaptFigmaEmbedEvent,
  FigmaAdapterValidationError,
  type FigmaAdapterContext,
} from "../src/lib/figma/event-adapter.ts";
import { fromEventStorageRow, toEventStorageRow } from "../src/lib/tracking/persistence.ts";

const context: FigmaAdapterContext = {
  eventId: "evt-figma-1",
  idempotencyKey: "session:1",
  occurredAt: "2026-09-09T05:50:00.000Z",
  sequence: 1,
  sessionId: "10000000-0000-4000-8000-000000000001",
  participantId: "20000000-0000-4000-8000-000000000001",
  testId: "30000000-0000-4000-8000-000000000001",
  testVersionId: "40000000-0000-4000-8000-000000000001",
  taskId: "50000000-0000-4000-8000-000000000001",
  previousScreenId: "10:1",
  currentScreenId: "10:1",
};

function tracking(result: ReturnType<typeof adaptFigmaEmbedEvent>) {
  assert.equal(result.kind, "tracking");
  if (result.kind !== "tracking") throw new Error("expected tracking event");
  return result.event;
}

test("maps Figma MOUSE_PRESS_OR_RELEASE to pointer_interaction and preserves provider coordinates", () => {
  const event = tracking(adaptFigmaEmbedEvent(
    "MOUSE_PRESS_OR_RELEASE",
    {
      presentedNodeId: "20:1",
      handled: false,
      targetNodeId: "20:99",
      targetNodeMousePosition: { x: 15, y: 25 },
      nearestScrollingFrameId: "20:2",
      nearestScrollingFrameMousePosition: { x: 35, y: 45 },
      nearestScrollingFrameOffset: { x: 0, y: 120 },
    },
    context,
  ));

  assert.equal(event.eventType, "pointer_interaction");
  assert.equal(event.source, "prototype_adapter");
  assert.equal(event.screenId, "20:1");
  assert.equal(event.metadata?.provider, "figma");
  assert.equal(event.metadata?.providerEventType, "MOUSE_PRESS_OR_RELEASE");
  assert.deepEqual(event.metadata?.targetNodeMousePosition, { x: 15, y: 25 });
  assert.deepEqual(event.metadata?.nearestScrollingFrameOffset, { x: 0, y: 120 });
  assert.notEqual(event.eventType, "scroll");
  assert.equal(validateRawTrackingEvent(event).ok, true);
});

test("maps frame navigation to screen_view and preserves Figma history + component state mapping", () => {
  const event = tracking(adaptFigmaEmbedEvent(
    "PRESENTED_NODE_CHANGED",
    {
      presentedNodeId: "30:1",
      isStoredInHistory: true,
      stateMappings: { "30:20": "30:200" },
    },
    context,
  ));

  assert.equal(event.eventType, "screen_view");
  assert.equal(event.screenId, "30:1");
  assert.equal(event.metadata?.previousScreenId, "10:1");
  assert.equal(event.metadata?.currentScreenId, "30:1");
  assert.equal(event.metadata?.navigationSource, "figma_presented_node_changed");
  assert.equal(event.metadata?.isStoredInHistory, true);
  assert.deepEqual(event.metadata?.stateMappings, { "30:20": "30:200" });
  assert.equal(validateRawTrackingEvent(event).ok, true);
});

test("preserves overlay-capable PRESENTED_NODE_CHANGED evidence without inventing an overlay event type", () => {
  const event = tracking(adaptFigmaEmbedEvent(
    "PRESENTED_NODE_CHANGED",
    {
      presentedNodeId: "40:overlay",
      isStoredInHistory: false,
      stateMappings: { "10:component": "10:variant" },
    },
    context,
  ));

  assert.equal(event.eventType, "screen_view");
  assert.equal(event.screenId, "40:overlay");
  assert.equal(event.metadata?.providerEventType, "PRESENTED_NODE_CHANGED");
  assert.equal(event.metadata?.isStoredInHistory, false);
});

test("maps Figma NEW_STATE to canonical component_state_changed and round-trips persistence", () => {
  const event = tracking(adaptFigmaEmbedEvent(
    "NEW_STATE",
    {
      nodeId: "10:component",
      currentVariantId: "10:variant-a",
      newVariantId: "10:variant-b",
      isStoredInHistory: false,
      isTimedChange: true,
    },
    context,
  ));

  assert.equal(event.eventType, "component_state_changed");
  assert.equal(event.screenId, "10:1");
  assert.equal(event.metadata?.nodeId, "10:component");
  assert.equal(event.metadata?.currentVariantId, "10:variant-a");
  assert.equal(event.metadata?.newVariantId, "10:variant-b");

  const accepted = { ...event, receivedAt: "2026-09-09T05:50:01.000Z" };
  const row = toEventStorageRow("60000000-0000-4000-8000-000000000001", accepted);
  const restored = fromEventStorageRow(row);
  assert.equal(restored.eventType, "component_state_changed");
  assert.equal(restored.screenId, "10:1");
  assert.deepEqual(restored.metadata, event.metadata);
});

test("keeps embed lifecycle/access events operational instead of fabricating usability events", () => {
  assert.deepEqual(adaptFigmaEmbedEvent("INITIAL_LOAD", {}, context), {
    kind: "operational",
    signal: "initial_load",
    providerEventType: "INITIAL_LOAD",
  });
  assert.deepEqual(adaptFigmaEmbedEvent("LOGIN_SCREEN_SHOWN", {}, context), {
    kind: "operational",
    signal: "login_screen_shown",
    providerEventType: "LOGIN_SCREEN_SHOWN",
  });
  assert.deepEqual(adaptFigmaEmbedEvent("PASSWORD_SCREEN_SHOWN", {}, context), {
    kind: "operational",
    signal: "password_screen_shown",
    providerEventType: "PASSWORD_SCREEN_SHOWN",
  });
  assert.deepEqual(adaptFigmaEmbedEvent("REQUEST_CLOSE", {}, context), {
    kind: "operational",
    signal: "request_close",
    providerEventType: "REQUEST_CLOSE",
  });
});

test("rejects undocumented provider event types and malformed documented payloads", () => {
  assert.throws(
    () => adaptFigmaEmbedEvent("SCROLL", {}, context),
    (error: unknown) => error instanceof FigmaAdapterValidationError && error.field === "providerEventType",
  );

  assert.throws(
    () => adaptFigmaEmbedEvent("NEW_STATE", { nodeId: "10:1" }, context),
    (error: unknown) => error instanceof FigmaAdapterValidationError,
  );
});
