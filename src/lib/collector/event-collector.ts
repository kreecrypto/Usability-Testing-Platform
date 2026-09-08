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

export type PersistAcceptedEvent = (
  event: AcceptedTrackingEvent<RawTrackingEvent>,
) => Promise<void>;

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
}) {
  const now = options.now ?? (() => new Date());

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

    const validation = validateRawTrackingEvent(body);
    if (!validation.ok) {
      return jsonResponse({ error: "invalid_event", details: validation.errors }, 400);
    }

    const receivedAt = now().toISOString();
    const acceptedEvent: AcceptedTrackingEvent<RawTrackingEvent> = {
      ...validation.event,
      receivedAt,
    };

    try {
      await options.persist(acceptedEvent);
    } catch {
      // Never echo provider/database credentials, binding values, or raw error text.
      return jsonResponse({ error: "ingestion_unavailable" }, 503);
    }

    return jsonResponse(
      {
        eventId: acceptedEvent.eventId,
        receivedAt: acceptedEvent.receivedAt,
        status: "accepted",
      },
      202,
    );
  };
}
