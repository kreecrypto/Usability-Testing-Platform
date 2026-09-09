import {
  EVENT_SCHEMA_VERSION,
  type RawEventType,
  type RawTrackingEvent,
} from "../tracking/events.ts";

export const FIGMA_EMBED_EVENT_TYPES = [
  "MOUSE_PRESS_OR_RELEASE",
  "PRESENTED_NODE_CHANGED",
  "INITIAL_LOAD",
  "NEW_STATE",
  "REQUEST_CLOSE",
  "LOGIN_SCREEN_SHOWN",
  "PASSWORD_SCREEN_SHOWN",
] as const;

export type FigmaEmbedEventType = (typeof FIGMA_EMBED_EVENT_TYPES)[number];

export type FigmaAdapterContext = Readonly<{
  eventId: string;
  idempotencyKey: string;
  occurredAt: string;
  sequence: number;
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  taskId?: string;
  previousScreenId?: string;
  currentScreenId?: string;
}>;

export type FigmaOperationalSignal =
  | "initial_load"
  | "request_close"
  | "login_screen_shown"
  | "password_screen_shown";

export type FigmaAdapterResult =
  | Readonly<{ kind: "tracking"; event: RawTrackingEvent }>
  | Readonly<{
      kind: "operational";
      signal: FigmaOperationalSignal;
      providerEventType: FigmaEmbedEventType;
    }>;

export class FigmaAdapterValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "FigmaAdapterValidationError";
    this.field = field;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new FigmaAdapterValidationError(field, `${field} must be an object`);
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FigmaAdapterValidationError(field, `${field} must be a non-empty string`);
  }
  return value.trim();
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new FigmaAdapterValidationError(field, `${field} must be boolean`);
  }
  return value;
}

function requiredPoint(value: unknown, field: string): Readonly<{ x: number; y: number }> {
  const point = requiredRecord(value, field);
  if (typeof point.x !== "number" || !Number.isFinite(point.x)) {
    throw new FigmaAdapterValidationError(`${field}.x`, `${field}.x must be finite`);
  }
  if (typeof point.y !== "number" || !Number.isFinite(point.y)) {
    throw new FigmaAdapterValidationError(`${field}.y`, `${field}.y must be finite`);
  }
  return Object.freeze({ x: point.x, y: point.y });
}

function requiredStateMappings(value: unknown): Readonly<Record<string, string>> {
  const record = requiredRecord(value, "stateMappings");
  const output: Record<string, string> = {};
  for (const [key, mapping] of Object.entries(record)) {
    if (typeof mapping !== "string") {
      throw new FigmaAdapterValidationError(`stateMappings.${key}`, "state mapping must be a string");
    }
    output[key] = mapping;
  }
  return Object.freeze(output);
}

function isFigmaEmbedEventType(value: string): value is FigmaEmbedEventType {
  return (FIGMA_EMBED_EVENT_TYPES as readonly string[]).includes(value);
}

function trackingEvent(
  context: FigmaAdapterContext,
  eventType: RawEventType,
  metadata: Record<string, unknown>,
  screenId?: string,
): FigmaAdapterResult {
  return Object.freeze({
    kind: "tracking" as const,
    event: Object.freeze({
      schemaVersion: EVENT_SCHEMA_VERSION,
      eventId: context.eventId,
      idempotencyKey: context.idempotencyKey,
      eventLayer: "raw" as const,
      source: "prototype_adapter" as const,
      eventType,
      occurredAt: context.occurredAt,
      sequence: context.sequence,
      sessionId: context.sessionId,
      participantId: context.participantId,
      testId: context.testId,
      testVersionId: context.testVersionId,
      ...(context.taskId ? { taskId: context.taskId } : {}),
      ...(screenId ? { screenId } : {}),
      metadata,
    }),
  });
}

/**
 * Normalize only event types documented as emitted by the Figma Embed API.
 *
 * This adapter deliberately does not synthesize a standalone `scroll` event:
 * Figma's MOUSE_PRESS_OR_RELEASE payload exposes scrolling-frame coordinates and
 * offset at the time of the pointer event, not a provider scroll event.
 *
 * INITIAL_LOAD / REQUEST_CLOSE / login / password screens are operational
 * signals for the embed/preflight layer and are not fabricated as usability
 * interactions.
 */
export function adaptFigmaEmbedEvent(
  providerEventType: string,
  payload: unknown,
  context: FigmaAdapterContext,
): FigmaAdapterResult {
  if (!isFigmaEmbedEventType(providerEventType)) {
    throw new FigmaAdapterValidationError(
      "providerEventType",
      `unsupported Figma Embed API event: ${providerEventType}`,
    );
  }

  if (providerEventType === "INITIAL_LOAD") {
    requiredRecord(payload, "payload");
    return Object.freeze({ kind: "operational", signal: "initial_load", providerEventType });
  }
  if (providerEventType === "REQUEST_CLOSE") {
    requiredRecord(payload, "payload");
    return Object.freeze({ kind: "operational", signal: "request_close", providerEventType });
  }
  if (providerEventType === "LOGIN_SCREEN_SHOWN") {
    requiredRecord(payload, "payload");
    return Object.freeze({ kind: "operational", signal: "login_screen_shown", providerEventType });
  }
  if (providerEventType === "PASSWORD_SCREEN_SHOWN") {
    requiredRecord(payload, "payload");
    return Object.freeze({ kind: "operational", signal: "password_screen_shown", providerEventType });
  }

  const data = requiredRecord(payload, "payload");

  if (providerEventType === "MOUSE_PRESS_OR_RELEASE") {
    const presentedNodeId = requiredString(data.presentedNodeId, "presentedNodeId");
    const handled = requiredBoolean(data.handled, "handled");
    const targetNodeId = requiredString(data.targetNodeId, "targetNodeId");
    const targetNodeMousePosition = requiredPoint(
      data.targetNodeMousePosition,
      "targetNodeMousePosition",
    );
    const nearestScrollingFrameId = requiredString(
      data.nearestScrollingFrameId,
      "nearestScrollingFrameId",
    );
    const nearestScrollingFrameMousePosition = requiredPoint(
      data.nearestScrollingFrameMousePosition,
      "nearestScrollingFrameMousePosition",
    );
    const nearestScrollingFrameOffset = requiredPoint(
      data.nearestScrollingFrameOffset,
      "nearestScrollingFrameOffset",
    );

    return trackingEvent(
      context,
      "pointer_interaction",
      {
        provider: "figma",
        providerEventType,
        presentedNodeId,
        handled,
        targetNodeId,
        targetNodeMousePosition,
        nearestScrollingFrameId,
        nearestScrollingFrameMousePosition,
        nearestScrollingFrameOffset,
      },
      presentedNodeId,
    );
  }

  if (providerEventType === "PRESENTED_NODE_CHANGED") {
    const presentedNodeId = requiredString(data.presentedNodeId, "presentedNodeId");
    const isStoredInHistory = requiredBoolean(data.isStoredInHistory, "isStoredInHistory");
    const stateMappings = requiredStateMappings(data.stateMappings);

    return trackingEvent(
      context,
      "screen_view",
      {
        provider: "figma",
        providerEventType,
        previousScreenId: context.previousScreenId ?? context.currentScreenId ?? null,
        currentScreenId: presentedNodeId,
        navigationSource: "figma_presented_node_changed",
        isStoredInHistory,
        stateMappings,
      },
      presentedNodeId,
    );
  }

  const nodeId = requiredString(data.nodeId, "nodeId");
  const currentVariantId = requiredString(data.currentVariantId, "currentVariantId");
  const newVariantId = requiredString(data.newVariantId, "newVariantId");
  const isStoredInHistory = requiredBoolean(data.isStoredInHistory, "isStoredInHistory");
  const isTimedChange = requiredBoolean(data.isTimedChange, "isTimedChange");

  return trackingEvent(
    context,
    "component_state_changed",
    {
      provider: "figma",
      providerEventType,
      nodeId,
      currentVariantId,
      newVariantId,
      isStoredInHistory,
      isTimedChange,
    },
    context.currentScreenId,
  );
}
