import {
  EVENT_SCHEMA_VERSION,
  type AcceptedTrackingEvent,
  type TaskOutcome,
} from "../tracking/events.ts";
import {
  completionRate,
  failureRate,
  giveUpRate,
  median,
  misclickRate,
  p75,
  p90,
} from "./metrics.ts";

export const ANALYTICS_AGGREGATION_VERSION = "task25-v1" as const;

type SessionTerminal = "completed" | "abandoned" | "technical_blocked";

type ProviderEvidence = Readonly<{
  eventId: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetricTrace = Readonly<{
  aggregationVersion: typeof ANALYTICS_AGGREGATION_VERSION;
  eventIds: readonly string[];
  rawEventIds: readonly string[];
  derivedEventIds: readonly string[];
  ruleVersions: readonly string[];
  schemaVersions: readonly number[];
  testVersionIds: readonly string[];
  providerEvidence: readonly ProviderEvidence[];
}>;

export type SuccessfulDurationSummary = Readonly<{
  sampleSize: number;
  medianMs: number | null;
  p75Ms: number | null;
  p90Ms: number | null;
}>;

export type TaskMetricAggregate = Readonly<{
  testId: string;
  testVersionId: string;
  taskId: string;
  started: number;
  eligible: number;
  outcomes: Readonly<Record<TaskOutcome, number>>;
  completionRate: number | null;
  failureRate: number | null;
  giveUpRate: number | null;
  successfulDuration: SuccessfulDurationSummary;
  eligiblePointerInteractions: number;
  misclicks: number;
  misclickRate: number | null;
  trace: Readonly<{
    cohort: MetricTrace;
    completion: MetricTrace;
    timeOnTask: MetricTrace;
    misclick: MetricTrace;
  }>;
}>;

export type SessionAggregate = Readonly<{
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  startedAt: string | null;
  terminal: SessionTerminal | null;
  taskStartedCount: number;
  taskTerminalCount: number;
  eligibleTaskCount: number;
  technicalBlockedTaskCount: number;
  successfulTaskCount: number;
  trace: MetricTrace;
}>;

export type AnalyticsAggregation = Readonly<{
  aggregationVersion: typeof ANALYTICS_AGGREGATION_VERSION;
  taskMetrics: readonly TaskMetricAggregate[];
  sessions: readonly SessionAggregate[];
}>;

type TerminalEvidence = Readonly<{
  outcome: TaskOutcome;
  event: AcceptedTrackingEvent;
  anchorSequence: number;
}>;

type TaskInstance = Readonly<{
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  taskId: string;
  startedEvent: AcceptedTrackingEvent | null;
  terminal: TerminalEvidence | null;
  eligible: boolean;
  durationMs: number | null;
  events: readonly AcceptedTrackingEvent[];
  pointerEvents: readonly AcceptedTrackingEvent[];
  misclickEvents: readonly AcceptedTrackingEvent[];
}>;

function assertSameAcceptedEvent(
  first: AcceptedTrackingEvent,
  next: AcceptedTrackingEvent,
): void {
  const same =
    first.sessionId === next.sessionId &&
    first.idempotencyKey === next.idempotencyKey &&
    first.eventType === next.eventType &&
    first.eventLayer === next.eventLayer &&
    first.occurredAt === next.occurredAt &&
    first.testVersionId === next.testVersionId &&
    first.taskId === next.taskId;

  if (!same) {
    throw new Error(`conflicting accepted event payload for eventId ${first.eventId}`);
  }
}

function dedupeAcceptedEvents(events: readonly AcceptedTrackingEvent[]): AcceptedTrackingEvent[] {
  const byEventId = new Map<string, AcceptedTrackingEvent>();
  const byIdempotency = new Map<string, string>();

  for (const event of events) {
    if (event.schemaVersion !== EVENT_SCHEMA_VERSION) {
      throw new Error(
        `unsupported event schema version ${event.schemaVersion}; expected ${EVENT_SCHEMA_VERSION}`,
      );
    }

    const existing = byEventId.get(event.eventId);
    if (existing) {
      assertSameAcceptedEvent(existing, event);
      continue;
    }

    const idempotencyIdentity = `${event.sessionId}\u0000${event.idempotencyKey}`;
    const previousEventId = byIdempotency.get(idempotencyIdentity);
    if (previousEventId && previousEventId !== event.eventId) {
      throw new Error(
        `conflicting accepted events share idempotency identity ${event.sessionId}/${event.idempotencyKey}`,
      );
    }

    byEventId.set(event.eventId, event);
    byIdempotency.set(idempotencyIdentity, event.eventId);
  }

  return [...byEventId.values()];
}

function validateSessionContexts(events: readonly AcceptedTrackingEvent[]): void {
  const contexts = new Map<
    string,
    { participantId: string; testId: string; testVersionId: string }
  >();

  for (const event of events) {
    const previous = contexts.get(event.sessionId);
    if (!previous) {
      contexts.set(event.sessionId, {
        participantId: event.participantId,
        testId: event.testId,
        testVersionId: event.testVersionId,
      });
      continue;
    }

    if (
      previous.participantId !== event.participantId ||
      previous.testId !== event.testId ||
      previous.testVersionId !== event.testVersionId
    ) {
      throw new Error(`session ${event.sessionId} contains conflicting immutable context`);
    }
  }
}

function compareRawEvents(a: AcceptedTrackingEvent, b: AcceptedTrackingEvent): number {
  if (a.eventLayer !== "raw" || b.eventLayer !== "raw") {
    throw new Error("compareRawEvents requires raw events");
  }
  return (
    a.sequence - b.sequence ||
    Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
    Date.parse(a.receivedAt) - Date.parse(b.receivedAt) ||
    a.eventId.localeCompare(b.eventId)
  );
}

function derivedAnchorSequence(
  event: AcceptedTrackingEvent,
  eventIndex: ReadonlyMap<string, AcceptedTrackingEvent>,
): number {
  if (event.eventLayer !== "derived") {
    throw new Error("derivedAnchorSequence requires a derived event");
  }

  const rawRefs = event.derivedFromEventIds.map((eventId) => {
    const ref = eventIndex.get(eventId);
    if (!ref) {
      throw new Error(
        `derived event ${event.eventId} references missing evidence ${eventId}`,
      );
    }
    if (ref.eventLayer !== "raw") {
      throw new Error(
        `derived event ${event.eventId} must resolve provenance to raw evidence`,
      );
    }
    if (
      ref.sessionId !== event.sessionId ||
      ref.testVersionId !== event.testVersionId ||
      ref.taskId !== event.taskId
    ) {
      throw new Error(
        `derived event ${event.eventId} references evidence outside its task context`,
      );
    }
    return ref.sequence;
  });

  if (rawRefs.length === 0) {
    throw new Error(`derived event ${event.eventId} has no raw provenance`);
  }

  return Math.max(...rawRefs);
}

function terminalCandidate(
  event: AcceptedTrackingEvent,
  eventIndex: ReadonlyMap<string, AcceptedTrackingEvent>,
): TerminalEvidence | null {
  if (event.eventLayer === "raw") {
    const rawOutcome: Partial<Record<typeof event.eventType, TaskOutcome>> = {
      task_give_up: "give_up",
      task_timeout: "timeout",
      task_abandoned: "abandoned",
      task_technical_blocked: "technical_blocked",
    };
    const outcome = rawOutcome[event.eventType];
    return outcome
      ? { outcome, event, anchorSequence: event.sequence }
      : null;
  }

  if (event.eventType === "task_failed") {
    return {
      outcome: "failed",
      event,
      anchorSequence: derivedAnchorSequence(event, eventIndex),
    };
  }

  if (event.eventType === "task_success") {
    const outcome = event.metadata?.outcome;
    if (outcome !== "success_direct" && outcome !== "success_indirect") {
      throw new Error(
        `task_success event ${event.eventId} requires success_direct or success_indirect outcome metadata`,
      );
    }
    return {
      outcome,
      event,
      anchorSequence: derivedAnchorSequence(event, eventIndex),
    };
  }

  return null;
}

function compareTerminalEvidence(a: TerminalEvidence, b: TerminalEvidence): number {
  return (
    a.anchorSequence - b.anchorSequence ||
    Date.parse(a.event.occurredAt) - Date.parse(b.event.occurredAt) ||
    a.event.eventId.localeCompare(b.event.eventId)
  );
}

function durationBetween(startedAt: string, terminalAt: string): number {
  const start = Date.parse(startedAt);
  const terminal = Date.parse(terminalAt);
  if (!Number.isFinite(start) || !Number.isFinite(terminal)) {
    throw new RangeError("task lifecycle timestamps must be valid RFC 3339/ISO-8601 values");
  }
  if (terminal < start) {
    throw new RangeError("terminal task evidence cannot precede task_started");
  }
  return terminal - start;
}

function buildTaskInstances(
  events: readonly AcceptedTrackingEvent[],
  eventIndex: ReadonlyMap<string, AcceptedTrackingEvent>,
): TaskInstance[] {
  const grouped = new Map<string, AcceptedTrackingEvent[]>();

  for (const event of events) {
    if (!event.taskId) continue;
    const key = `${event.sessionId}\u0000${event.testVersionId}\u0000${event.taskId}`;
    const existing = grouped.get(key);
    if (existing) existing.push(event);
    else grouped.set(key, [event]);
  }

  const instances: TaskInstance[] = [];

  for (const taskEvents of grouped.values()) {
    const first = taskEvents[0];
    const rawEvents = taskEvents
      .filter((event) => event.eventLayer === "raw")
      .sort(compareRawEvents);
    const startedEvent =
      rawEvents.find((event) => event.eventType === "task_started") ?? null;

    const candidates = taskEvents
      .map((event) => terminalCandidate(event, eventIndex))
      .filter((candidate): candidate is TerminalEvidence => candidate !== null)
      .sort(compareTerminalEvidence);
    const terminal = candidates[0] ?? null;
    const eligible = terminal?.outcome !== "technical_blocked";
    const durationMs =
      startedEvent && terminal
        ? durationBetween(startedEvent.occurredAt, terminal.event.occurredAt)
        : null;

    const pointerEvents = taskEvents.filter(
      (event) => event.eventLayer === "raw" && event.eventType === "pointer_interaction",
    );
    const misclickEvents = taskEvents.filter(
      (event) => event.eventLayer === "derived" && event.eventType === "misclick",
    );

    instances.push({
      sessionId: first.sessionId,
      participantId: first.participantId,
      testId: first.testId,
      testVersionId: first.testVersionId,
      taskId: first.taskId as string,
      startedEvent,
      terminal,
      eligible,
      durationMs,
      events: taskEvents,
      pointerEvents,
      misclickEvents,
    });
  }

  return instances;
}

function traceEvents(
  selectedEvents: readonly AcceptedTrackingEvent[],
  eventIndex: ReadonlyMap<string, AcceptedTrackingEvent>,
): MetricTrace {
  const expanded = new Map<string, AcceptedTrackingEvent>();

  const include = (event: AcceptedTrackingEvent): void => {
    if (expanded.has(event.eventId)) return;
    expanded.set(event.eventId, event);
    if (event.eventLayer === "derived") {
      for (const sourceId of event.derivedFromEventIds) {
        const source = eventIndex.get(sourceId);
        if (!source) {
          throw new Error(
            `derived event ${event.eventId} references missing evidence ${sourceId}`,
          );
        }
        include(source);
      }
    }
  };

  for (const event of selectedEvents) include(event);

  const all = [...expanded.values()].sort((a, b) => a.eventId.localeCompare(b.eventId));
  const ruleVersions = [...new Set(
    all.flatMap((event) =>
      event.eventLayer === "derived" ? [event.ruleVersion] : [],
    ),
  )].sort();
  const schemaVersions = [...new Set(all.map((event) => event.schemaVersion))].sort(
    (a, b) => a - b,
  );
  const testVersionIds = [...new Set(all.map((event) => event.testVersionId))].sort();
  const providerEvidence = all
    .filter(
      (event) => event.eventLayer === "raw" && event.source === "prototype_adapter",
    )
    .map((event) => ({
      eventId: event.eventId,
      metadata: Object.freeze({ ...(event.metadata ?? {}) }),
    }));

  return Object.freeze({
    aggregationVersion: ANALYTICS_AGGREGATION_VERSION,
    eventIds: Object.freeze(all.map((event) => event.eventId)),
    rawEventIds: Object.freeze(
      all.filter((event) => event.eventLayer === "raw").map((event) => event.eventId),
    ),
    derivedEventIds: Object.freeze(
      all.filter((event) => event.eventLayer === "derived").map((event) => event.eventId),
    ),
    ruleVersions: Object.freeze(ruleVersions),
    schemaVersions: Object.freeze(schemaVersions),
    testVersionIds: Object.freeze(testVersionIds),
    providerEvidence: Object.freeze(providerEvidence),
  });
}

function emptyOutcomeCounts(): Record<TaskOutcome, number> {
  return {
    success_direct: 0,
    success_indirect: 0,
    failed: 0,
    give_up: 0,
    timeout: 0,
    abandoned: 0,
    technical_blocked: 0,
  };
}

function aggregateTaskMetrics(
  instances: readonly TaskInstance[],
  eventIndex: ReadonlyMap<string, AcceptedTrackingEvent>,
): TaskMetricAggregate[] {
  const grouped = new Map<string, TaskInstance[]>();
  for (const instance of instances) {
    const key = `${instance.testId}\u0000${instance.testVersionId}\u0000${instance.taskId}`;
    const existing = grouped.get(key);
    if (existing) existing.push(instance);
    else grouped.set(key, [instance]);
  }

  const aggregates: TaskMetricAggregate[] = [];

  for (const cohort of grouped.values()) {
    const first = cohort[0];
    const startedInstances = cohort.filter((instance) => instance.startedEvent !== null);
    const outcomes = emptyOutcomeCounts();
    for (const instance of startedInstances) {
      if (instance.terminal) outcomes[instance.terminal.outcome] += 1;
    }

    const started = startedInstances.length;
    const technicalBlocked = outcomes.technical_blocked;
    const eligible = started - technicalBlocked;
    const metricInput = {
      started,
      successDirect: outcomes.success_direct,
      successIndirect: outcomes.success_indirect,
      failed: outcomes.failed,
      giveUp: outcomes.give_up,
      technicalBlocked,
    };

    const eligibleInstances = startedInstances.filter((instance) => instance.eligible);
    const successfulInstances = eligibleInstances.filter(
      (instance) =>
        instance.terminal?.outcome === "success_direct" ||
        instance.terminal?.outcome === "success_indirect",
    );
    const successfulDurations = successfulInstances.flatMap((instance) =>
      instance.durationMs === null ? [] : [instance.durationMs],
    );
    const eligiblePointerEvents = eligibleInstances.flatMap(
      (instance) => instance.pointerEvents,
    );
    const eligibleMisclickEvents = eligibleInstances.flatMap(
      (instance) => instance.misclickEvents,
    );

    const cohortEvents = startedInstances.flatMap((instance) => instance.events);
    const completionEvents = startedInstances.flatMap((instance) => [
      ...(instance.startedEvent ? [instance.startedEvent] : []),
      ...(instance.terminal ? [instance.terminal.event] : []),
    ]);
    const timeEvents = successfulInstances.flatMap((instance) => [
      ...(instance.startedEvent ? [instance.startedEvent] : []),
      ...(instance.terminal ? [instance.terminal.event] : []),
    ]);
    const misclickEvents = [...eligiblePointerEvents, ...eligibleMisclickEvents];

    aggregates.push(
      Object.freeze({
        testId: first.testId,
        testVersionId: first.testVersionId,
        taskId: first.taskId,
        started,
        eligible,
        outcomes: Object.freeze({ ...outcomes }),
        completionRate: completionRate(metricInput),
        failureRate: failureRate(metricInput),
        giveUpRate: giveUpRate(metricInput),
        successfulDuration: Object.freeze({
          sampleSize: successfulDurations.length,
          medianMs: median(successfulDurations),
          p75Ms: p75(successfulDurations),
          p90Ms: p90(successfulDurations),
        }),
        eligiblePointerInteractions: eligiblePointerEvents.length,
        misclicks: eligibleMisclickEvents.length,
        misclickRate: misclickRate(
          eligibleMisclickEvents.length,
          eligiblePointerEvents.length,
        ),
        trace: Object.freeze({
          cohort: traceEvents(cohortEvents, eventIndex),
          completion: traceEvents(completionEvents, eventIndex),
          timeOnTask: traceEvents(timeEvents, eventIndex),
          misclick: traceEvents(misclickEvents, eventIndex),
        }),
      }),
    );
  }

  return aggregates.sort(
    (a, b) =>
      a.testVersionId.localeCompare(b.testVersionId) || a.taskId.localeCompare(b.taskId),
  );
}

function sessionTerminal(events: readonly AcceptedTrackingEvent[]): SessionTerminal | null {
  const raw = events
    .filter((event) => event.eventLayer === "raw")
    .sort(compareRawEvents);
  for (const event of raw) {
    if (event.eventType === "session_completed") return "completed";
    if (event.eventType === "session_abandoned") return "abandoned";
    if (event.eventType === "session_technical_blocked") return "technical_blocked";
  }
  return null;
}

function aggregateSessions(
  events: readonly AcceptedTrackingEvent[],
  instances: readonly TaskInstance[],
  eventIndex: ReadonlyMap<string, AcceptedTrackingEvent>,
): SessionAggregate[] {
  const sessionEvents = new Map<string, AcceptedTrackingEvent[]>();
  for (const event of events) {
    const existing = sessionEvents.get(event.sessionId);
    if (existing) existing.push(event);
    else sessionEvents.set(event.sessionId, [event]);
  }

  const bySessionInstances = new Map<string, TaskInstance[]>();
  for (const instance of instances) {
    const existing = bySessionInstances.get(instance.sessionId);
    if (existing) existing.push(instance);
    else bySessionInstances.set(instance.sessionId, [instance]);
  }

  const aggregates: SessionAggregate[] = [];
  for (const [sessionId, scopedEvents] of sessionEvents) {
    const first = scopedEvents[0];
    const raw = scopedEvents
      .filter((event) => event.eventLayer === "raw")
      .sort(compareRawEvents);
    const startedAt =
      raw.find((event) => event.eventType === "session_started")?.occurredAt ?? null;
    const scopedInstances = bySessionInstances.get(sessionId) ?? [];
    const startedInstances = scopedInstances.filter(
      (instance) => instance.startedEvent !== null,
    );
    const terminalInstances = startedInstances.filter(
      (instance) => instance.terminal !== null,
    );

    aggregates.push(
      Object.freeze({
        sessionId,
        participantId: first.participantId,
        testId: first.testId,
        testVersionId: first.testVersionId,
        startedAt,
        terminal: sessionTerminal(scopedEvents),
        taskStartedCount: startedInstances.length,
        taskTerminalCount: terminalInstances.length,
        eligibleTaskCount: startedInstances.filter((instance) => instance.eligible).length,
        technicalBlockedTaskCount: startedInstances.filter(
          (instance) => instance.terminal?.outcome === "technical_blocked",
        ).length,
        successfulTaskCount: startedInstances.filter(
          (instance) =>
            instance.terminal?.outcome === "success_direct" ||
            instance.terminal?.outcome === "success_indirect",
        ).length,
        trace: traceEvents(scopedEvents, eventIndex),
      }),
    );
  }

  return aggregates.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}

export function aggregateAnalytics(
  inputEvents: readonly AcceptedTrackingEvent[],
): AnalyticsAggregation {
  const events = dedupeAcceptedEvents(inputEvents);
  validateSessionContexts(events);
  const eventIndex = new Map(events.map((event) => [event.eventId, event]));
  const instances = buildTaskInstances(events, eventIndex);

  return Object.freeze({
    aggregationVersion: ANALYTICS_AGGREGATION_VERSION,
    taskMetrics: Object.freeze(aggregateTaskMetrics(instances, eventIndex)),
    sessions: Object.freeze(aggregateSessions(events, instances, eventIndex)),
  });
}
