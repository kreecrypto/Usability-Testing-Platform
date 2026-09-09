export const EVENT_SCHEMA_VERSION = 2 as const;

export const rawEventTypes = [
  "session_started",
  "session_completed",
  "session_abandoned",
  "session_technical_blocked",
  "task_started",
  "task_give_up",
  "task_timeout",
  "task_abandoned",
  "task_technical_blocked",
  "screen_view",
  "pointer_interaction",
  "component_state_changed",
  "scroll",
  "question_viewed",
  "question_answered",
] as const;

export const derivedEventTypes = [
  "task_success",
  "task_failed",
  "misclick",
  "rage_click",
  "backtrack",
] as const;

export const eventTypes = [...rawEventTypes, ...derivedEventTypes] as const;

export type RawEventType = (typeof rawEventTypes)[number];
export type DerivedEventType = (typeof derivedEventTypes)[number];
export type EventType = RawEventType | DerivedEventType;

export type RawEventSource = "runner" | "prototype_adapter" | "system";
export type DerivedEventSource = "rules_engine" | "analytics";

interface BaseTrackingEvent<
  TEventType extends EventType,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  eventId: string;
  idempotencyKey: string;
  eventType: TEventType;
  occurredAt: string;
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  taskId?: string;
  screenId?: string;
  metadata?: TMetadata;
}

export interface RawTrackingEvent<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends BaseTrackingEvent<RawEventType, TMetadata> {
  eventLayer: "raw";
  source: RawEventSource;
  sequence: number;
}

export interface DerivedTrackingEvent<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends BaseTrackingEvent<DerivedEventType, TMetadata> {
  eventLayer: "derived";
  source: DerivedEventSource;
  derivedFromEventIds: string[];
  ruleVersion: string;
}

export type TrackingEvent<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = RawTrackingEvent<TMetadata> | DerivedTrackingEvent<TMetadata>;

export type AcceptedTrackingEvent<TEvent extends TrackingEvent = TrackingEvent> = TEvent & {
  /** Assigned by the collector/database. Never trusted from participant input. */
  receivedAt: string;
};

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
  | "abandoned"
  | "technical_blocked";

export type UsabilityTaskOutcome = Exclude<TaskOutcome, "technical_blocked">;

export function isRawEventType(value: string): value is RawEventType {
  return (rawEventTypes as readonly string[]).includes(value);
}

export function isDerivedEventType(value: string): value is DerivedEventType {
  return (derivedEventTypes as readonly string[]).includes(value);
}

export function isEventType(value: string): value is EventType {
  return isRawEventType(value) || isDerivedEventType(value);
}

export function isNormalizedPoint(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
