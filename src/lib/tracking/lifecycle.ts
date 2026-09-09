import type { RawEventSource, RawEventType, RawTrackingEvent } from "./events.ts";
import { EVENT_SCHEMA_VERSION } from "./events.ts";

export type RunnerTaskContract = Readonly<{ id: string }>;

type RunnerSessionContext = Readonly<{
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
}>;

type EventSink = (event: RawTrackingEvent) => void | Promise<void>;

export function createRunnerLifecycle(options: {
  session: RunnerSessionContext;
  emit: EventSink;
  initialSequence?: number;
  initialSessionStarted?: boolean;
  initialSessionTerminal?: boolean;
  initialActiveTaskId?: string | null;
  initialActiveTaskTerminal?: boolean;
  now?: () => Date;
  eventIdFactory?: () => string;
}) {
  let sequence = options.initialSequence ?? 0;
  let sessionStarted = options.initialSessionStarted ?? false;
  let sessionTerminal = options.initialSessionTerminal ?? false;
  let activeTask: RunnerTaskContract | null = options.initialActiveTaskId
    ? Object.freeze({ id: options.initialActiveTaskId })
    : null;
  let activeTaskTerminal = options.initialActiveTaskTerminal ?? false;
  const now = options.now ?? (() => new Date());
  const eventIdFactory = options.eventIdFactory ?? (() => globalThis.crypto.randomUUID());

  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("initialSequence must be a non-negative safe integer");
  }

  async function sink(event: RawTrackingEvent): Promise<RawTrackingEvent> {
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

  async function startSession() {
    if (sessionStarted || sessionTerminal) return null;
    const event = await raw("session_started", "runner");
    sessionStarted = true;
    return event;
  }

  async function startTask(task: RunnerTaskContract) {
    if (!sessionStarted || sessionTerminal || (activeTask && !activeTaskTerminal)) return null;
    activeTask = Object.freeze({ id: task.id });
    activeTaskTerminal = false;
    return raw("task_started", "runner", task.id);
  }

  async function acceptExternalRaw(event: RawTrackingEvent): Promise<RawTrackingEvent> {
    if (!sessionStarted || sessionTerminal) throw new Error("session_not_active");
    if (
      event.sessionId !== options.session.sessionId ||
      event.participantId !== options.session.participantId ||
      event.testId !== options.session.testId ||
      event.testVersionId !== options.session.testVersionId
    ) throw new Error("external_event_context_mismatch");
    if (event.sequence !== sequence + 1) throw new Error("external_event_sequence_mismatch");
    if (activeTask && event.taskId !== activeTask.id) throw new Error("external_event_task_mismatch");
    await sink(event);
    sequence = event.sequence;
    return event;
  }

  function markTaskTerminal(taskId: string): void {
    if (!activeTask || activeTask.id !== taskId) throw new Error("active_task_mismatch");
    activeTaskTerminal = true;
  }

  async function rawTaskTerminal(
    eventType: "task_give_up" | "task_timeout" | "task_abandoned" | "task_technical_blocked",
    source: "runner" | "system",
    metadata?: Record<string, unknown>,
  ) {
    if (!activeTask || activeTaskTerminal || sessionTerminal) return null;
    const event = await raw(eventType, source, activeTask.id, metadata);
    activeTaskTerminal = true;
    return event;
  }

  async function completeSession() {
    if (!sessionStarted || sessionTerminal || (activeTask && !activeTaskTerminal)) return null;
    const event = await raw("session_completed", "runner");
    sessionTerminal = true;
    return event;
  }

  async function abandonSession(reason = "participant_exit") {
    if (!sessionStarted || sessionTerminal) return null;
    if (activeTask && !activeTaskTerminal) {
      await rawTaskTerminal("task_abandoned", "system", { reason });
    }
    const event = await raw("session_abandoned", "system", undefined, { reason });
    sessionTerminal = true;
    return event;
  }

  async function technicalBlock(reason: string) {
    if (!sessionStarted || sessionTerminal) return null;
    if (activeTask && !activeTaskTerminal) {
      const event = await rawTaskTerminal("task_technical_blocked", "system", { reason });
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
    markTaskTerminal,
    giveUp: () => rawTaskTerminal("task_give_up", "runner"),
    timeout: () => rawTaskTerminal("task_timeout", "system"),
    abandonTask: () => rawTaskTerminal("task_abandoned", "system"),
    technicalBlock,
    completeSession,
    abandonSession,
    getState: () => Object.freeze({
      sequence,
      sessionStarted,
      sessionTerminal,
      activeTaskId: activeTask?.id ?? null,
      activeTaskTerminal,
    }),
  });
}
