import {
  EVENT_SCHEMA_VERSION,
  isRawEventType,
  type AcceptedTrackingEvent,
  type RawTrackingEvent,
  type RawEventSource,
} from "../tracking/events.ts";

const RAW_EVENT_SOURCES = new Set<RawEventSource>([
  "runner",
  "prototype_adapter",
  "system",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_UTC_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export interface CollectorValidationError {
  field: string;
  code: string;
  message: string;
}

export type CollectorValidationResult =
  | { ok: true; event: RawTrackingEvent }
  | { ok: false; errors: CollectorValidationError[] };

export type PersistAcceptedEventResult = "accepted" | "duplicate";

export type PersistAcceptedEvent = (
  event: AcceptedTrackingEvent<RawTrackingEvent>,
) => Promise<PersistAcceptedEventResult | void>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addRequiredStringError(
  errors: CollectorValidationError[],
  input: Record<string, unknown>,
  field: string,
): void {
  if (typeof input[field] !== "string" || input[field].trim() === "") {
    errors.push({
      field,
      code: "required_string",
      message: `${field} must be a non-empty string`,
    });
  }
}

function addUuidError(
  errors: CollectorValidationError[],
  input: Record<string, unknown>,
  field: string,
): void {
  const value = input[field];
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    errors.push({ field, code: "invalid_uuid", message: `${field} must be a UUID` });
  }
}

export function validateRawTrackingEvent(input: unknown): CollectorValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ field: "$", code: "invalid_body", message: "event must be a JSON object" }],
    };
  }

  const errors: CollectorValidationError[] = [];

  if (input.schemaVersion !== EVENT_SCHEMA_VERSION) {
    errors.push({
      field: "schemaVersion",
      code: "unsupported_schema_version",
      message: `schemaVersion must be ${EVENT_SCHEMA_VERSION}`,
    });
  }

  if (input.eventLayer !== "raw") {
    errors.push({
      field: "eventLayer",
      code: "invalid_event_layer",
      message: "collector accepts raw events only",
    });
  }

  if (typeof input.source !== "string" || !RAW_EVENT_SOURCES.has(input.source as RawEventSource)) {
    errors.push({
      field: "source",
      code: "invalid_source",
      message: "source must be runner, prototype_adapter, or system",
    });
  }

  if (typeof input.eventType !== "string" || !isRawEventType(input.eventType)) {
    errors.push({
      field: "eventType",
      code: "invalid_event_type",
      message: "eventType must be a canonical raw event type",
    });
  }

  addRequiredStringError(errors, input, "eventId");
  addRequiredStringError(errors, input, "idempotencyKey");

  for (const field of ["sessionId", "participantId", "testId", "testVersionId"] as const) {
    addUuidError(errors, input, field);
  }

  for (const field of ["taskId", "screenId"] as const) {
    if (input[field] !== undefined && input[field] !== null) {
      addUuidError(errors, input, field);
    }
  }

  if (
    typeof input.occurredAt !== "string" ||
    !RFC3339_UTC_PATTERN.test(input.occurredAt) ||
    Number.isNaN(Date.parse(input.occurredAt))
  ) {
    errors.push({
      field: "occurredAt",
      code: "invalid_timestamp",
      message: "occurredAt must be a valid RFC 3339 UTC timestamp",
    });
  }

  if (!Number.isSafeInteger(input.sequence) || Number(input.sequence) < 0) {
    errors.push({
      field: "sequence",
      code: "invalid_sequence",
      message: "sequence must be a non-negative safe integer",
    });
  }

  if (input.metadata !== undefined && !isRecord(input.metadata)) {
    errors.push({
      field: "metadata",
      code: "invalid_metadata",
      message: "metadata must be a JSON object when provided",
    });
  }

  if (Object.prototype.hasOwnProperty.call(input, "receivedAt")) {
    errors.push({
      field: "receivedAt",
      code: "server_owned_field",
      message: "receivedAt is assigned by the collector and must not be supplied by clients",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, event: input as unknown as RawTrackingEvent };
}

type CollectorPayload =
  | { ok: true; events: RawTrackingEvent[]; mode: "single" | "batch" }
  | { ok: false; errors: CollectorValidationError[] };

function parseCollectorPayload(body: unknown): CollectorPayload {
  if (isRecord(body) && Array.isArray(body.events)) {
    if (body.events.length === 0) {
      return {
        ok: false,
        errors: [
          {
            field: "events",
            code: "empty_batch",
            message: "events must contain at least one event",
          },
        ],
      };
    }

    if (body.events.length > 100) {
      return {
        ok: false,
        errors: [
          {
            field: "events",
            code: "batch_too_large",
            message: "events must contain at most 100 events",
          },
        ],
      };
    }

    const events: RawTrackingEvent[] = [];
    const errors: CollectorValidationError[] = [];

    body.events.forEach((event, index) => {
      const validation = validateRawTrackingEvent(event);
      if (validation.ok) {
        events.push(validation.event);
        return;
      }

      errors.push(
        ...validation.errors.map((error) => ({
          ...error,
          field: `events[${index}].${error.field}`,
        })),
      );
    });

    return errors.length > 0 ? { ok: false, errors } : { ok: true, events, mode: "batch" };
  }

  const validation = validateRawTrackingEvent(body);
  return validation.ok
    ? { ok: true, events: [validation.event], mode: "single" }
    : { ok: false, errors: validation.errors };
}

async function persistWithRetry(
  persist: PersistAcceptedEvent,
  event: AcceptedTrackingEvent<RawTrackingEvent>,
  maxAttempts: number,
): Promise<PersistAcceptedEventResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return (await persist(event)) ?? "accepted";
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("event_persist_failed");
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function createEventCollectorHandler(options: {
  persist: PersistAcceptedEvent;
  now?: () => Date;
  maxPersistenceAttempts?: number;
}) {
  const now = options.now ?? (() => new Date());
  const maxPersistenceAttempts = options.maxPersistenceAttempts ?? 3;

  return async function handleEventCollectorRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/v1/events") {
      return jsonResponse({ error: "not_found" }, 404);
    }

    if (request.method !== "POST") {
      return new Response(null, {
        status: 405,
        headers: { allow: "POST", "cache-control": "no-store" },
      });
    }

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) {
      return jsonResponse({ error: "unsupported_media_type" }, 415);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    const payload = parseCollectorPayload(body);
    if (!payload.ok) {
      return jsonResponse({ error: "invalid_event", details: payload.errors }, 400);
    }

    const accepted: Array<{ eventId: string; receivedAt: string; status: "accepted" }> = [];
    const duplicates: Array<{ eventId: string; receivedAt: string; status: "duplicate" }> = [];
    const seenBatchKeys = new Set<string>();

    try {
      for (const event of payload.events) {
        const receivedAt = now().toISOString();
        const acceptedEvent: AcceptedTrackingEvent<RawTrackingEvent> = {
          ...event,
          receivedAt,
        };
        const batchKey = `${acceptedEvent.sessionId}:${acceptedEvent.idempotencyKey}`;

        if (seenBatchKeys.has(batchKey)) {
          duplicates.push({
            eventId: acceptedEvent.eventId,
            receivedAt: acceptedEvent.receivedAt,
            status: "duplicate",
          });
          continue;
        }

        seenBatchKeys.add(batchKey);
        const persisted = await persistWithRetry(
          options.persist,
          acceptedEvent,
          maxPersistenceAttempts,
        );

        if (persisted === "duplicate") {
          duplicates.push({
            eventId: acceptedEvent.eventId,
            receivedAt: acceptedEvent.receivedAt,
            status: "duplicate",
          });
        } else {
          accepted.push({
            eventId: acceptedEvent.eventId,
            receivedAt: acceptedEvent.receivedAt,
            status: "accepted",
          });
        }
      }
    } catch {
      // Never echo provider/database credentials, binding values, or raw error text.
      return jsonResponse({ error: "ingestion_unavailable" }, 503);
    }

    if (payload.mode === "single") {
      return jsonResponse(accepted[0] ?? duplicates[0], 202);
    }

    return jsonResponse(
      {
        status: "accepted",
        accepted,
        duplicates,
        summary: {
          received: payload.events.length,
          accepted: accepted.length,
          duplicate: duplicates.length,
        },
      },
      202,
    );
  };
}
