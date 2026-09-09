import type { DerivedTrackingEvent, RawEventSource, RawEventType, RawTrackingEvent, TrackingEvent } from "./events.ts";
import { EVENT_SCHEMA_VERSION } from "./events.ts";

export const TASK_OUTCOME_RULE_VERSION = "task-outcome-v1" as const;

export type RunnerTaskContract = Readonly<{
  id: string;
  expectedPath: readonly unknown[];
  successRule: Readonly<Record<string, unknown>>;
  failureRule: Readonly<Record<string, unknown>>;
}>;

type RunnerSessionContext = Readonly<{
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
}>;

type EventSink = (event: TrackingEvent) => void | Promise<void>;

function nodeIds(rule: Readonly<Record<string, unknown>>): readonly string[] {
  if (rule.type !== "presented_node" || !Array.isArray(rule.nodeIds)) return [];
  return Object.freeze(rule.nodeIds.filter((value): value is string => typeof value === "string" && value.trim() !== ""));
}

function expectedNodePath(path: readonly unknown[]): readonly string[] {
  return Object.freeze(path.filter((value): value is string => typeof value === "string" && value.trim() !== ""));
}

function samePath(actual: readonly string[], expected: readonly string[]): boolean {
  if (expected.length === 0) return true;
  return actual.length === expected.length && actual.every((nodeId, index) => nodeId === expected[index]);
}

export function createRunnerLifecycle(options: {
  session: RunnerSessionContext;
  emit: EventSink;
  initialSequence?: number;
  now?: () => Date;
  eventIdFactory?: () => string;
}) {
  let sequence = options.initialSequence ?? 0;
  let sessionStarted = false;
  let sessionTerminal = false;
  let activeTask: RunnerTaskContract | null = null;
  let activeTaskTerminal = false;
  let screenPath: string[] = [];
  const now = options.now ?? (() => new Date());
  const eventIdFactory = options.eventIdFactory ?? (() => globalThis.crypto.randomUUID());

  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("initialSequence must be a non-negative safe integer");

  async function sink(event: TrackingEvent): Promise<TrackingEvent> {
    await options.emit(event);
    return event;
  }

  async function raw(
    eventType: RawEventType,
    source: RawEventSource,
    taskId?: string,
    metadata?: Record<string, unknown>,
    screenId?: string,
  ): Promise<RawTrackingEvent> {
    const next = sequence + 1;
    const event: RawTrackingEvent = Object.freeze({
      schemaVersion: EVENT_SCHEMA_VERSION,
      eventId: eventIdFactory(),
      idempotencyKey: `${options.session.sessionId}:${source}:${next}:${eventType}`,
      eventLayer: "raw",
      source,
      eventType,
      occurredAt: now().toISOString(),
      sequence: next,
      ...options.session,
      ...(taskId ? { taskId } : {}),
      ...(screenId ? { screenId } : {}),
      ...(metadata ? { metadata: Object.freeze({ ...metadata }) } : {}),
    });
    await sink(event);
    sequence = next;
    return event;
  }

  async function derivedTerminal(kind: "task_success" | "task_failed", trigger: RawTrackingEvent, outcome?: "success_direct" | "success_indirect") {
    if (!activeTask || activeTaskTerminal) return null;
    const event: DerivedTrackingEvent = Object.freeze({
      schemaVersion: EVENT_SCHEMA_VERSION,
      eventId: eventIdFactory(),
      idempotencyKey: `${options.session.sessionId}:derived:${activeTask.id}:${trigger.eventId}:${kind}`,
      eventLayer: "derived",
      source: "rules_engine",
      eventType: kind,
      occurredAt: trigger.occurredAt,
      ...options.session,
      taskId: activeTask.id,
      derivedFromEventIds: Object.freeze([trigger.eventId]),
      ruleVersion: TASK_OUTCOME_RULE_VERSION,
      ...(kind === "task_success" ? { metadata: Object.freeze({ outcome }) } : {}),
    });
    await sink(event);
    activeTaskTerminal = true;
    return event;
  }

  async function startSession() {
    if (sessionStarted || sessionTerminal) return null;
    const event = await raw("session_started", "runner");
    sessionStarted = true;
    return event;
  }

  async function startTask(task: RunnerTaskContract) {
    if (!sessionStarted || sessionTerminal || (activeTask && !activeTaskTerminal)) return null;
    activeTask = task;
    activeTaskTerminal = false;
    screenPath = [];
    return raw("task_started", "runner", task.id);
  }

  async function acceptExternalRaw(event: RawTrackingEvent) {
    if (!sessionStarted || sessionTerminal) throw new Error("session_not_active");
    if (event.sessionId !== options.session.sessionId || event.participantId !== options.session.participantId || event.testId !== options.session.testId || event.testVersionId !== options.session.testVersionId) {
      throw new Error("external_event_context_mismatch");
    }
    if (event.sequence !== sequence + 1) throw new Error("external_event_sequence_mismatch");
    if (activeTask && event.taskId !== activeTask.id) throw new Error("external_event_task_mismatch");
    await sink(event);
    sequence = event.sequence;

    if (activeTask && !activeTaskTerminal && event.eventType === "screen_view" && event.screenId) {
      screenPath.push(event.screenId);
      const failures = nodeIds(activeTask.failureRule);
      const successes = nodeIds(activeTask.successRule);
      if (failures.includes(event.screenId)) return derivedTerminal("task_failed", event);
      if (successes.includes(event.screenId)) {
        const expected = expectedNodePath(activeTask.expectedPath);
        return derivedTerminal("task_success", event, samePath(screenPath, expected) ? "success_direct" : "success_indirect");
      }
    }
    return event;
  }

  async function rawTaskTerminal(eventType: "task_give_up" | "task_timeout" | "task_abandoned" | "task_technical_blocked", source: "runner" | "system") {
    if (!activeTask || activeTaskTerminal || sessionTerminal) return null;
    const event = await raw(eventType, source, activeTask.id);
    activeTaskTerminal = true;
    return event;
  }

  async function completeSession() {
    if (!sessionStarted || sessionTerminal || (activeTask && !activeTaskTerminal)) return null;
    const event = await raw("session_completed", "runner");
    sessionTerminal = true;
    return event;
  }

  async function abandonSession() {
    if (!sessionStarted || sessionTerminal) return null;
    if (activeTask && !activeTaskTerminal) await rawTaskTerminal("task_abandoned", "system");
    const event = await raw("session_abandoned", "system");
    sessionTerminal = true;
    return event;
  }

  async function technicalBlock(reason: string) {
    if (!sessionStarted || sessionTerminal) return null;
    if (activeTask && !activeTaskTerminal) {
      const event = await raw("task_technical_blocked", "system", activeTask.id, { reason });
      activeTaskTerminal = true;
      await raw("session_technical_blocked", "system", undefined, { reason });
      sessionTerminal = true;
      return event;
    }
    const event = await raw("session_technical_blocked", "system", undefined, { reason });
    sessionTerminal = true;
    return event;
  }

  return Object.freeze({
    startSession,
    startTask,
    acceptExternalRaw,
    giveUp: () => rawTaskTerminal("task_give_up", "runner"),
    timeout: () => rawTaskTerminal("task_timeout", "system"),
    abandonTask: () => rawTaskTerminal("task_abandoned", "system"),
    technicalBlock,
    completeSession,
    abandonSession,
    getState: () => Object.freeze({ sequence, sessionStarted, sessionTerminal, activeTaskId: activeTask?.id ?? null, activeTaskTerminal, screenPath: Object.freeze([...screenPath]) }),
  });
}
