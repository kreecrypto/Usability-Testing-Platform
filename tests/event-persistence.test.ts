import assert from "node:assert/strict";
import test from "node:test";

import {
  fromEventStorageRow,
  toEventStorageRow,
} from "../src/lib/tracking/persistence.ts";
import type { AcceptedTrackingEvent } from "../src/lib/tracking/events.ts";

const rawEvent: AcceptedTrackingEvent = {
  schemaVersion: 2,
  eventId: "11111111-1111-1111-1111-111111111111",
  idempotencyKey: "session-1:42",
  eventLayer: "raw",
  source: "runner",
  eventType: "screen_view",
  occurredAt: "2026-09-08T10:00:00.000Z",
  receivedAt: "2026-09-08T10:00:00.100Z",
  sequence: 42,
  sessionId: "22222222-2222-2222-2222-222222222222",
  participantId: "33333333-3333-3333-3333-333333333333",
  testId: "44444444-4444-4444-4444-444444444444",
  testVersionId: "55555555-5555-5555-5555-555555555555",
  taskId: "66666666-6666-6666-6666-666666666666",
  screenId: "checkout",
  metadata: {
    previousScreenId: "cart",
    currentScreenId: "checkout",
    navigationSource: "prototype",
  },
};

test("raw event round-trips through the canonical storage mapping", () => {
  const row = toEventStorageRow(
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    rawEvent,
  );

  assert.equal(row.schema_version, 2);
  assert.equal(row.participant_id, rawEvent.participantId);
  assert.equal(row.test_id, rawEvent.testId);
  assert.equal(row.test_version_id, rawEvent.testVersionId);
  assert.equal(row.screen_id, rawEvent.screenId);
  assert.equal(row.sequence, 42);

  assert.deepEqual(fromEventStorageRow(row), rawEvent);
});

test("derived event round-trips with provenance and rule version", () => {
  const derived: AcceptedTrackingEvent = {
    schemaVersion: 2,
    eventId: "77777777-7777-7777-7777-777777777777",
    idempotencyKey: "derived:task-success:1",
    eventLayer: "derived",
    source: "rules_engine",
    eventType: "task_success",
    occurredAt: "2026-09-08T10:00:05.000Z",
    receivedAt: "2026-09-08T10:00:05.050Z",
    sessionId: rawEvent.sessionId,
    participantId: rawEvent.participantId,
    testId: rawEvent.testId,
    testVersionId: rawEvent.testVersionId,
    taskId: rawEvent.taskId,
    metadata: { outcome: "success_direct" },
    derivedFromEventIds: [rawEvent.eventId],
    ruleVersion: "success-v1",
  };

  const row = toEventStorageRow(
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    derived,
  );

  assert.equal(row.sequence, null);
  assert.deepEqual(row.derived_from_event_ids, [rawEvent.eventId]);
  assert.equal(row.rule_version, "success-v1");
  assert.deepEqual(fromEventStorageRow(row), derived);
});

test("storage decoder rejects schema drift and malformed event-layer combinations", () => {
  const row = toEventStorageRow(
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    rawEvent,
  );

  assert.throws(
    () => fromEventStorageRow({ ...row, schema_version: 3 }),
    /unsupported event schema version/,
  );
  assert.throws(
    () => fromEventStorageRow({ ...row, event_name: "task_success" }),
    /invalid raw event_name/,
  );
});
