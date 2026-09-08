import {
  EVENT_SCHEMA_VERSION,
  isDerivedEventType,
  isRawEventType,
  type AcceptedTrackingEvent,
  type DerivedEventSource,
  type RawEventSource,
} from "./events.ts";

export type EventStorageRow = Readonly<{
  event_id: string;
  workspace_id: string;
  session_id: string;
  participant_id: string;
  test_id: string;
  test_version_id: string;
  task_id: string | null;
  screen_id: string | null;
  idempotency_key: string;
  event_name: string;
  event_layer: "raw" | "derived";
  source: string;
  schema_version: number;
  occurred_at: string;
  received_at: string;
  sequence: number | null;
  payload: Record<string, unknown>;
  derived_from_event_ids: string[];
  rule_version: string | null;
}>;

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

function isRawSource(value: string): value is RawEventSource {
  return value === "runner" || value === "prototype_adapter" || value === "system";
}

function isDerivedSource(value: string): value is DerivedEventSource {
  return value === "rules_engine" || value === "analytics";
}

function optionalMetadata(
  payload: Record<string, unknown>,
): { metadata?: Record<string, unknown> } {
  return Object.keys(payload).length > 0 ? { metadata: payload } : {};
}

export function toEventStorageRow(
  workspaceId: string,
  event: AcceptedTrackingEvent,
): EventStorageRow {
  const base = {
    event_id: required(event.eventId, "eventId"),
    workspace_id: required(workspaceId, "workspaceId"),
    session_id: required(event.sessionId, "sessionId"),
    participant_id: required(event.participantId, "participantId"),
    test_id: required(event.testId, "testId"),
    test_version_id: required(event.testVersionId, "testVersionId"),
    task_id: event.taskId?.trim() || null,
    screen_id: event.screenId?.trim() || null,
    idempotency_key: required(event.idempotencyKey, "idempotencyKey"),
    event_name: event.eventType,
    event_layer: event.eventLayer,
    source: event.source,
    schema_version: event.schemaVersion,
    occurred_at: required(event.occurredAt, "occurredAt"),
    received_at: required(event.receivedAt, "receivedAt"),
    payload: event.metadata ?? {},
  } as const;

  if (event.eventLayer === "raw") {
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) {
      throw new RangeError("raw event sequence must be a non-negative safe integer");
    }
    return Object.freeze({
      ...base,
      sequence: event.sequence,
      derived_from_event_ids: [],
      rule_version: null,
    });
  }

  if (event.derivedFromEventIds.length === 0) {
    throw new Error("derivedFromEventIds must not be empty");
  }

  return Object.freeze({
    ...base,
    sequence: null,
    derived_from_event_ids: [...event.derivedFromEventIds],
    rule_version: required(event.ruleVersion, "ruleVersion"),
  });
}

export function fromEventStorageRow(row: EventStorageRow): AcceptedTrackingEvent {
  if (row.schema_version !== EVENT_SCHEMA_VERSION) {
    throw new Error(
      `unsupported event schema version ${row.schema_version}; expected ${EVENT_SCHEMA_VERSION}`,
    );
  }

  const common = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventId: required(row.event_id, "event_id"),
    idempotencyKey: required(row.idempotency_key, "idempotency_key"),
    occurredAt: required(row.occurred_at, "occurred_at"),
    receivedAt: required(row.received_at, "received_at"),
    sessionId: required(row.session_id, "session_id"),
    participantId: required(row.participant_id, "participant_id"),
    testId: required(row.test_id, "test_id"),
    testVersionId: required(row.test_version_id, "test_version_id"),
    ...(row.task_id ? { taskId: row.task_id } : {}),
    ...(row.screen_id ? { screenId: row.screen_id } : {}),
    ...optionalMetadata(row.payload),
  } as const;

  if (row.event_layer === "raw") {
    if (!isRawEventType(row.event_name)) {
      throw new Error(`invalid raw event_name: ${row.event_name}`);
    }
    if (!isRawSource(row.source)) {
      throw new Error(`invalid raw event source: ${row.source}`);
    }
    if (row.sequence === null || !Number.isSafeInteger(row.sequence) || row.sequence < 0) {
      throw new Error("raw storage row requires a non-negative sequence");
    }
    return Object.freeze({
      ...common,
      eventLayer: "raw" as const,
      eventType: row.event_name,
      source: row.source,
      sequence: row.sequence,
    });
  }

  if (!isDerivedEventType(row.event_name)) {
    throw new Error(`invalid derived event_name: ${row.event_name}`);
  }
  if (!isDerivedSource(row.source)) {
    throw new Error(`invalid derived event source: ${row.source}`);
  }
  if (row.derived_from_event_ids.length === 0) {
    throw new Error("derived storage row requires provenance event IDs");
  }

  return Object.freeze({
    ...common,
    eventLayer: "derived" as const,
    eventType: row.event_name,
    source: row.source,
    derivedFromEventIds: [...row.derived_from_event_ids],
    ruleVersion: required(row.rule_version ?? "", "rule_version"),
  });
}
