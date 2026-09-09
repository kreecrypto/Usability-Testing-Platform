import assert from "node:assert/strict";
import test from "node:test";

import { FUNNEL_SCHEMA_VERSION, deriveFunnel, parseFunnelDefinition } from "../src/lib/analytics/funnel.ts";
import { buildResultsModel } from "../src/lib/analytics/results.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent } from "../src/lib/tracking/events.ts";

type Raw = AcceptedTrackingEvent<RawTrackingEvent>;

function raw(
  id: string,
  sessionId: string,
  sequence: number,
  eventType: RawTrackingEvent["eventType"],
  screenId?: string,
): Raw {
  const at = new Date(Date.UTC(2026, 8, 9, 1, 0, sequence)).toISOString();
  return {
    schemaVersion: 2,
    eventId: id,
    idempotencyKey: `idem:${id}`,
    eventLayer: "raw",
    source: eventType === "screen_view" ? "prototype_adapter" : "runner",
    eventType,
    occurredAt: at,
    receivedAt: at,
    sequence,
    sessionId,
    participantId: `participant-${sessionId}`,
    testId: "test-1",
    testVersionId: "version-1",
    ...(screenId ? { screenId } : {}),
  };
}

function fixture(): AcceptedTrackingEvent[] {
  return [
    raw("s1-start", "s1", 0, "session_started"),
    raw("s1-a", "s1", 1, "screen_view", "A"),
    raw("s1-b", "s1", 2, "screen_view", "B"),
    raw("s1-c", "s1", 3, "screen_view", "C"),
    raw("s1-end", "s1", 4, "session_completed"),

    raw("s2-start", "s2", 0, "session_started"),
    raw("s2-a", "s2", 1, "screen_view", "A"),
    raw("s2-b", "s2", 2, "screen_view", "B"),
    raw("s2-end", "s2", 3, "session_completed"),

    raw("s3-start", "s3", 0, "session_started"),
    raw("s3-a", "s3", 1, "screen_view", "A"),
    raw("s3-end", "s3", 2, "session_abandoned"),

    raw("s4-start", "s4", 0, "session_started"),
    raw("s4-a", "s4", 1, "screen_view", "A"),
    raw("s4-b", "s4", 2, "screen_view", "B"),
    raw("s4-c", "s4", 3, "screen_view", "C"),
    raw("s4-tech", "s4", 4, "session_technical_blocked"),
  ];
}

test("Task 48 parses only a versioned, ordered, unique funnel definition", () => {
  assert.deepEqual(parseFunnelDefinition({ version: FUNNEL_SCHEMA_VERSION, screenIds: [" A ", "B", "C"] }), {
    version: FUNNEL_SCHEMA_VERSION,
    screenIds: ["A", "B", "C"],
  });
  assert.equal(parseFunnelDefinition({ version: FUNNEL_SCHEMA_VERSION, screenIds: ["A"] }), null);
  assert.equal(parseFunnelDefinition({ version: FUNNEL_SCHEMA_VERSION, screenIds: ["A", "A"] }), null);
  assert.equal(parseFunnelDefinition({ version: "unknown", screenIds: ["A", "B"] }), null);
});

test("Task 48 computes step conversion and largest drop from eligible canonical screen evidence", () => {
  const definition = parseFunnelDefinition({ version: FUNNEL_SCHEMA_VERSION, screenIds: ["A", "B", "C"] });
  assert.ok(definition);
  const funnel = deriveFunnel(fixture(), definition);

  assert.equal(funnel.eligibleSessionCount, 3);
  assert.equal(funnel.technicalBlockedSessionCount, 1);
  assert.equal(funnel.transitions.length, 2);

  const [first, second] = funnel.transitions;
  assert.deepEqual(
    { from: first.fromScreenId, to: first.toScreenId, entered: first.entered, reached: first.reached, dropped: first.dropped },
    { from: "A", to: "B", entered: 3, reached: 2, dropped: 1 },
  );
  assert.ok(first.conversionRate !== null && Math.abs(first.conversionRate - (200 / 3)) < 1e-10);
  assert.ok(first.dropOffRate !== null && Math.abs(first.dropOffRate - (100 / 3)) < 1e-10);

  assert.deepEqual(
    { from: second.fromScreenId, to: second.toScreenId, entered: second.entered, reached: second.reached, dropped: second.dropped },
    { from: "B", to: "C", entered: 2, reached: 1, dropped: 1 },
  );
  assert.equal(second.conversionRate, 50);
  assert.equal(second.dropOffRate, 50);

  assert.equal(funnel.largestDrop?.fromScreenId, "B");
  assert.equal(funnel.largestDrop?.toScreenId, "C");
  assert.equal(funnel.largestDrop?.dropOffRate, 50);
});

test("Task 48 requires ordered progression and preserves No Data", () => {
  const definition = parseFunnelDefinition({ version: FUNNEL_SCHEMA_VERSION, screenIds: ["A", "B", "Z"] });
  assert.ok(definition);
  const events: AcceptedTrackingEvent[] = [
    raw("order-start", "order", 0, "session_started"),
    raw("order-b", "order", 1, "screen_view", "B"),
    raw("order-a", "order", 2, "screen_view", "A"),
  ];
  const funnel = deriveFunnel(events, definition);
  assert.equal(funnel.transitions[0].entered, 1);
  assert.equal(funnel.transitions[0].reached, 0);
  assert.equal(funnel.transitions[0].conversionRate, 0);
  assert.equal(funnel.transitions[1].entered, 0);
  assert.equal(funnel.transitions[1].reached, 0);
  assert.equal(funnel.transitions[1].conversionRate, null);

  const noEntry = deriveFunnel(events, { version: FUNNEL_SCHEMA_VERSION, screenIds: ["X", "Y"] });
  assert.equal(noEntry.transitions[0].entered, 0);
  assert.equal(noEntry.transitions[0].conversionRate, null);
  assert.equal(noEntry.transitions[0].dropOffRate, null);
  assert.equal(noEntry.largestDrop, null);
});

test("Task 48 Results model exposes funnel only when the published version carries a definition", () => {
  const definition = parseFunnelDefinition({ version: FUNNEL_SCHEMA_VERSION, screenIds: ["A", "B", "C"] });
  assert.ok(definition);
  const configured = buildResultsModel({ testVersionId: "version-1", events: fixture(), tasks: [], funnelDefinition: definition });
  assert.ok(configured.funnel);
  assert.equal(configured.unsupported.funnel, false);
  assert.equal(configured.funnel.largestDrop?.dropOffRate, 50);

  const absent = buildResultsModel({ testVersionId: "version-1", events: fixture(), tasks: [] });
  assert.equal(absent.funnel, null);
  assert.equal(absent.unsupported.funnel, true);
});
