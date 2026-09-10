import { FIGMA_HEATMAP_TRANSFORM_VERSION } from "../figma/heatmap-transform.ts";
import { isNormalizedPoint, type AcceptedTrackingEvent, type TaskOutcome } from "../tracking/events.ts";

export type ScreenHeatmapPoint = Readonly<{
  eventId: string;
  sessionId: string;
  taskId: string | null;
  screenId: string;
  geometryVersionId: string;
  transformVersion: typeof FIGMA_HEATMAP_TRANSFORM_VERSION;
  normalizedX: number;
  normalizedY: number;
  frameWidth: number;
  frameHeight: number;
  deviceClass: string | null;
  terminalOutcome: TaskOutcome | null;
}>;

export type ScreenHeatmapDataset = Readonly<{
  testVersionId: string;
  status: "available" | "no_data" | "unsupported";
  reason: "canonical_geometry_unavailable" | null;
  rawPointerCount: number;
  canonicalPointerCount: number;
  points: readonly ScreenHeatmapPoint[];
  filters: Readonly<{
    taskIds: readonly string[];
    screenIds: readonly string[];
    deviceClasses: readonly string[];
    outcomes: readonly TaskOutcome[];
  }>;
}>;

export type ScreenHeatmapFilters = Readonly<{
  testVersionId?: string;
  taskId?: string;
  screenId?: string;
  deviceClass?: string;
  outcome?: TaskOutcome;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function rawAnchor(event: AcceptedTrackingEvent, index: ReadonlyMap<string, AcceptedTrackingEvent>): number {
  if (event.eventLayer === "raw") return event.sequence;
  const anchors = event.derivedFromEventIds.flatMap((id) => {
    const raw = index.get(id);
    return raw?.eventLayer === "raw" ? [raw.sequence] : [];
  });
  return anchors.length ? Math.max(...anchors) : Number.MAX_SAFE_INTEGER;
}

function taskOutcomes(events: readonly AcceptedTrackingEvent[]): ReadonlyMap<string, TaskOutcome> {
  const index = new Map(events.map((event) => [event.eventId, event]));
  const candidates = new Map<string, Array<{ outcome: TaskOutcome; anchor: number; at: number; id: string }>>();
  const add = (event: AcceptedTrackingEvent, outcome: TaskOutcome) => {
    if (!event.taskId) return;
    const key = `${event.sessionId}\u0000${event.taskId}`;
    const group = candidates.get(key) ?? [];
    group.push({ outcome, anchor: rawAnchor(event, index), at: Date.parse(event.occurredAt), id: event.eventId });
    candidates.set(key, group);
  };

  for (const event of events) {
    if (event.eventLayer === "raw") {
      const outcome: Partial<Record<typeof event.eventType, TaskOutcome>> = {
        task_give_up: "give_up",
        task_timeout: "timeout",
        task_abandoned: "abandoned",
        task_technical_blocked: "technical_blocked",
      };
      const value = outcome[event.eventType];
      if (value) add(event, value);
      continue;
    }
    if (event.eventType === "task_failed") add(event, "failed");
    if (event.eventType === "task_success") {
      add(event, event.metadata?.outcome === "success_indirect" ? "success_indirect" : "success_direct");
    }
  }

  const resolved = new Map<string, TaskOutcome>();
  for (const [key, group] of candidates) {
    group.sort((a, b) => a.anchor - b.anchor || a.at - b.at || a.id.localeCompare(b.id));
    if (group[0]) resolved.set(key, group[0].outcome);
  }
  return resolved;
}

function sessionDeviceClasses(events: readonly AcceptedTrackingEvent[]): ReadonlyMap<string, string> {
  const output = new Map<string, string>();
  for (const event of events) {
    if (event.eventLayer !== "raw" || event.eventType !== "session_started" || output.has(event.sessionId)) continue;
    const deviceClass = isRecord(event.metadata) ? text(event.metadata.deviceClass) : null;
    if (deviceClass) output.set(event.sessionId, deviceClass);
  }
  return output;
}

function canonicalPoint(event: AcceptedTrackingEvent): Omit<ScreenHeatmapPoint, "eventId" | "sessionId" | "taskId" | "screenId" | "deviceClass" | "terminalOutcome"> | null {
  if (event.eventLayer !== "raw" || event.eventType !== "pointer_interaction") return null;
  if (!isRecord(event.metadata) || !isRecord(event.metadata.canonicalPoint)) return null;
  const point = event.metadata.canonicalPoint;
  const geometryVersionId = text(point.geometryVersionId);
  const presentedNodeId = text(point.presentedNodeId);
  const normalizedX = typeof point.normalizedX === "number" ? point.normalizedX : Number.NaN;
  const normalizedY = typeof point.normalizedY === "number" ? point.normalizedY : Number.NaN;
  const frameWidth = positiveNumber(point.frameWidth);
  const frameHeight = positiveNumber(point.frameHeight);
  if (
    point.transformVersion !== FIGMA_HEATMAP_TRANSFORM_VERSION ||
    !geometryVersionId || geometryVersionId !== event.testVersionId ||
    !presentedNodeId || presentedNodeId !== event.screenId ||
    !isNormalizedPoint(normalizedX) || !isNormalizedPoint(normalizedY) ||
    frameWidth === null || frameHeight === null
  ) return null;
  return Object.freeze({
    geometryVersionId,
    transformVersion: FIGMA_HEATMAP_TRANSFORM_VERSION,
    normalizedX,
    normalizedY,
    frameWidth,
    frameHeight,
  });
}

function unique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

export function buildScreenHeatmap(testVersionId: string, events: readonly AcceptedTrackingEvent[]): ScreenHeatmapDataset {
  const scoped = events.filter((event) => event.testVersionId === testVersionId);
  const outcomes = taskOutcomes(scoped);
  const sessionDevices = sessionDeviceClasses(scoped);
  const rawPointers = scoped.filter((event) => event.eventLayer === "raw" && event.eventType === "pointer_interaction");
  const points: ScreenHeatmapPoint[] = [];

  for (const event of rawPointers) {
    const point = canonicalPoint(event);
    if (!point || !event.screenId) continue;
    const eventDevice = isRecord(event.metadata) ? text(event.metadata.deviceClass) : null;
    const terminalOutcome = event.taskId ? outcomes.get(`${event.sessionId}\u0000${event.taskId}`) ?? null : null;
    points.push(Object.freeze({
      eventId: event.eventId,
      sessionId: event.sessionId,
      taskId: event.taskId ?? null,
      screenId: event.screenId,
      ...point,
      deviceClass: eventDevice ?? sessionDevices.get(event.sessionId) ?? null,
      terminalOutcome,
    }));
  }

  const status = rawPointers.length === 0 ? "no_data" : points.length === 0 ? "unsupported" : "available";
  return Object.freeze({
    testVersionId,
    status,
    reason: status === "unsupported" ? "canonical_geometry_unavailable" : null,
    rawPointerCount: rawPointers.length,
    canonicalPointerCount: points.length,
    points: Object.freeze(points),
    filters: Object.freeze({
      taskIds: Object.freeze(unique(points.map((point) => point.taskId))),
      screenIds: Object.freeze(unique(points.map((point) => point.screenId)),),
      deviceClasses: Object.freeze(unique(points.map((point) => point.deviceClass))),
      outcomes: Object.freeze([...new Set(points.map((point) => point.terminalOutcome).filter((value): value is TaskOutcome => Boolean(value)))].sort()),
    }),
  });
}

export function filterScreenHeatmap(dataset: ScreenHeatmapDataset, filters: ScreenHeatmapFilters): readonly ScreenHeatmapPoint[] {
  if (filters.testVersionId && filters.testVersionId !== dataset.testVersionId) return Object.freeze([]);
  return Object.freeze(dataset.points.filter((point) =>
    (!filters.taskId || point.taskId === filters.taskId)
    && (!filters.screenId || point.screenId === filters.screenId)
    && (!filters.deviceClass || point.deviceClass === filters.deviceClass)
    && (!filters.outcome || point.terminalOutcome === filters.outcome)
  ));
}
