import type { AcceptedTrackingEvent } from "../tracking/events.ts";

export const TIME_METRICS_VERSION = "lifecycle-time-v1" as const;

export type ScreenTimeMetric = Readonly<{
  screenId: string;
  enteredAt: string;
  exitedAt: string;
  durationMs: number;
}>;

export type TaskTimeMetrics = Readonly<{
  metricVersion: typeof TIME_METRICS_VERSION;
  sessionId: string;
  taskId: string;
  timeOnTaskMs: number | null;
  screens: readonly ScreenTimeMetric[];
  canonicalScrollEventCount: number;
  idleAdjustedMs: null;
  idleRuleVersion: null;
}>;

const RAW_TASK_TERMINALS = new Set(["task_give_up", "task_timeout", "task_abandoned", "task_technical_blocked"]);
const DERIVED_TASK_TERMINALS = new Set(["task_success", "task_failed"]);

function millis(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid_event_timestamp");
  return parsed;
}

function rawOrder(a: AcceptedTrackingEvent, b: AcceptedTrackingEvent): number {
  const aSequence = a.eventLayer === "raw" ? a.sequence : Number.MAX_SAFE_INTEGER;
  const bSequence = b.eventLayer === "raw" ? b.sequence : Number.MAX_SAFE_INTEGER;
  return aSequence - bSequence || millis(a.occurredAt) - millis(b.occurredAt) || a.eventId.localeCompare(b.eventId);
}

function terminalFor(events: readonly AcceptedTrackingEvent[]): AcceptedTrackingEvent | null {
  const terminals = events.filter((event) =>
    (event.eventLayer === "raw" && RAW_TASK_TERMINALS.has(event.eventType))
    || (event.eventLayer === "derived" && DERIVED_TASK_TERMINALS.has(event.eventType)),
  );
  terminals.sort((a, b) => millis(a.occurredAt) - millis(b.occurredAt) || a.eventId.localeCompare(b.eventId));
  return terminals[0] ?? null;
}

export function deriveTaskTimeMetrics(inputEvents: readonly AcceptedTrackingEvent[]): readonly TaskTimeMetrics[] {
  const groups = new Map<string, AcceptedTrackingEvent[]>();
  for (const event of inputEvents) {
    if (!event.taskId) continue;
    const key = `${event.sessionId}\u0000${event.taskId}`;
    const group = groups.get(key);
    if (group) group.push(event); else groups.set(key, [event]);
  }

  const output: TaskTimeMetrics[] = [];
  for (const events of groups.values()) {
    events.sort(rawOrder);
    const first = events[0];
    const started = events.find((event) => event.eventLayer === "raw" && event.eventType === "task_started") ?? null;
    const terminal = terminalFor(events);
    const startedMs = started ? millis(started.occurredAt) : null;
    const terminalMs = terminal ? millis(terminal.occurredAt) : null;
    if (startedMs !== null && terminalMs !== null && terminalMs < startedMs) throw new Error("terminal_before_task_start");

    const screens = events
      .filter((event) => event.eventLayer === "raw" && event.eventType === "screen_view" && event.screenId)
      .sort(rawOrder);
    const screenTimes: ScreenTimeMetric[] = [];
    for (let index = 0; index < screens.length; index += 1) {
      const current = screens[index];
      const next = screens[index + 1];
      const exitAt = next?.occurredAt ?? terminal?.occurredAt ?? null;
      if (!current.screenId || !exitAt) continue;
      const durationMs = millis(exitAt) - millis(current.occurredAt);
      if (durationMs < 0) throw new Error("screen_exit_before_entry");
      screenTimes.push(Object.freeze({ screenId: current.screenId, enteredAt: current.occurredAt, exitedAt: exitAt, durationMs }));
    }

    const scrollCount = events.filter((event) => event.eventLayer === "raw" && event.eventType === "scroll").length;
    output.push(Object.freeze({
      metricVersion: TIME_METRICS_VERSION,
      sessionId: first.sessionId,
      taskId: first.taskId!,
      timeOnTaskMs: startedMs !== null && terminalMs !== null ? terminalMs - startedMs : null,
      screens: Object.freeze(screenTimes),
      canonicalScrollEventCount: scrollCount,
      idleAdjustedMs: null,
      idleRuleVersion: null,
    }));
  }

  return Object.freeze(output.sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.taskId.localeCompare(b.taskId)));
}
