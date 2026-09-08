export const EVENT_SCHEMA_VERSION = 1 as const;

export const eventTypes = [
  "session_started",
  "session_completed",
  "session_abandoned",
  "task_started",
  "task_success",
  "task_failed",
  "task_give_up",
  "task_timeout",
  "task_abandoned",
  "screen_view",
  "frame_change",
  "back",
  "forward",
  "click",
  "tap",
  "misclick",
  "rage_click",
  "scroll",
  "question_viewed",
  "question_answered",
] as const;

export type EventType = (typeof eventTypes)[number];

export interface TrackingEvent<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  eventId: string;
  idempotencyKey: string;
  eventType: EventType;
  timestamp: string;
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  taskId?: string;
  screenId?: string;
  sequence: number;
  metadata?: TMetadata;
}

export interface PointMetadata extends Record<string, unknown> {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  viewportWidth: number;
  viewportHeight: number;
  frameWidth?: number;
  frameHeight?: number;
  elementId?: string;
  elementName?: string;
}

export type TaskOutcome =
  | "success_direct"
  | "success_indirect"
  | "failed"
  | "give_up"
  | "timeout"
  | "abandoned";

export function isEventType(value: string): value is EventType {
  return (eventTypes as readonly string[]).includes(value);
}

export function isNormalizedPoint(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
