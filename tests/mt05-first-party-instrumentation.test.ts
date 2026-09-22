import assert from "node:assert/strict";
import test from "node:test";
import { createFirstPartyWebInstrumentation, FIRST_PARTY_WEB_ADAPTER_VERSION } from "../src/lib/web/first-party-instrumentation.ts";
import type { RawTrackingEvent } from "../src/lib/tracking/events.ts";

const context = Object.freeze({
  sessionId: "11111111-1111-4111-8111-111111111111",
  participantId: "22222222-2222-4222-8222-222222222222",
  testId: "33333333-3333-4333-8333-333333333333",
  testVersionId: "44444444-4444-4444-8444-444444444444",
  taskId: "55555555-5555-4555-8555-555555555555",
});

function fixture(consented = true) {
  const events: RawTrackingEvent[] = [];
  let consent = consented;
  let id = 0;
  const adapter = createFirstPartyWebInstrumentation({
    context,
    hasConsent: () => consent,
    enqueue: async (event) => { events.push(event); },
    now: () => "2026-09-22T00:00:00.000Z",
    randomId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  return { adapter, events, setConsent: (value: boolean) => { consent = value; } };
}

test("does not emit behavioral evidence before consent", async () => {
  const { adapter, events, setConsent } = fixture(false);
  assert.equal(await adapter.recordScreenView("/checkout"), null);
  assert.equal(events.length, 0);
  setConsent(true);
  const event = await adapter.recordScreenView("/checkout");
  assert.equal(event?.eventType, "screen_view");
  assert.equal(events.length, 1);
});

test("emits stable provider-neutral screen evidence after consent", async () => {
  const { adapter } = fixture();
  const event = await adapter.recordScreenView("checkout:payment", "checkout:cart");
  assert.equal(event?.screenId, "checkout:payment");
  assert.equal(event?.source, "prototype_adapter");
  assert.equal(event?.metadata?.targetProvider, "first_party_web");
  assert.equal(event?.metadata?.adapterVersion, FIRST_PARTY_WEB_ADAPTER_VERSION);
  assert.equal(event?.metadata?.previousScreenId, "checkout:cart");
});

test("normalizes owned-page pointer evidence and fails closed out of bounds", async () => {
  const { adapter } = fixture();
  const event = await adapter.recordPointer({ screenId: "/pay", x: 250, y: 400, viewportWidth: 500, viewportHeight: 800, elementId: "pay-now" });
  assert.equal(event?.eventType, "pointer_interaction");
  assert.equal(event?.metadata?.normalizedX, 0.5);
  assert.equal(event?.metadata?.normalizedY, 0.5);
  assert.equal(event?.metadata?.coordinateTransformVersion, FIRST_PARTY_WEB_ADAPTER_VERSION);
  assert.throws(() => adapter.recordPointer({ screenId: "/pay", x: 501, y: 1, viewportWidth: 500, viewportHeight: 800 }), /pointer_out_of_bounds/);
});

test("scroll is emitted only from explicit owned-document evidence", async () => {
  const { adapter } = fixture();
  const event = await adapter.recordScroll({ screenId: "/products", scrollX: 0, scrollY: 640, documentWidth: 1280, documentHeight: 3000 });
  assert.equal(event?.eventType, "scroll");
  assert.equal(event?.metadata?.evidenceSource, "owned_document");
});

test("enqueue failure does not fabricate a delivered event", async () => {
  const adapter = createFirstPartyWebInstrumentation({
    context,
    hasConsent: () => true,
    enqueue: async () => { throw new Error("outbox_unavailable"); },
    now: () => "2026-09-22T00:00:00.000Z",
    randomId: () => "00000000-0000-4000-8000-999999999999",
  });
  await assert.rejects(() => adapter.recordScreenView("/checkout"), /outbox_unavailable/);
});
