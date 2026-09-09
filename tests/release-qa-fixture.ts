import type { AcceptedTrackingEvent, DerivedTrackingEvent, RawTrackingEvent, TaskOutcome } from "../src/lib/tracking/events.ts";
import type { ResultAnswer, ResultTaskDefinition } from "../src/lib/analytics/results.ts";

export const RELEASE_QA_TEST_ID = "release-qa-test";
export const RELEASE_QA_TEST_VERSION_ID = "release-qa-version";
export const RELEASE_QA_TASK_ID = "release-qa-task";

export type ReleaseQaFixture = Readonly<{
  events: readonly AcceptedTrackingEvent[];
  deliveryEventsWithDuplicates: readonly AcceptedTrackingEvent[];
  answers: readonly ResultAnswer[];
  tasks: readonly ResultTaskDefinition[];
  expectedOutcomes: Readonly<Record<TaskOutcome, number>>;
  sessionCount: number;
  uniqueEventCount: number;
}>;

type Raw = AcceptedTrackingEvent<RawTrackingEvent>;
type Derived = AcceptedTrackingEvent<DerivedTrackingEvent>;

function timestamp(sessionIndex: number, ordinal: number): string {
  return new Date(Date.UTC(2026, 8, 9, 2, sessionIndex, ordinal)).toISOString();
}

function raw(
  sessionIndex: number,
  sequence: number,
  eventType: RawTrackingEvent["eventType"],
  options: Readonly<{ screenId?: string; metadata?: Record<string, unknown>; taskScoped?: boolean }> = {},
): Raw {
  const sessionId = `release-session-${String(sessionIndex).padStart(2, "0")}`;
  const eventId = `${sessionId}:raw:${sequence}:${eventType}`;
  return Object.freeze({
    schemaVersion: 2,
    eventId,
    idempotencyKey: `idem:${eventId}`,
    eventLayer: "raw",
    source: eventType === "screen_view" || eventType === "pointer_interaction" || eventType === "component_state_changed" ? "prototype_adapter" : "runner",
    eventType,
    occurredAt: timestamp(sessionIndex, sequence),
    receivedAt: timestamp(sessionIndex, sequence),
    sequence,
    sessionId,
    participantId: `release-participant-${String(sessionIndex).padStart(2, "0")}`,
    testId: RELEASE_QA_TEST_ID,
    testVersionId: RELEASE_QA_TEST_VERSION_ID,
    ...(options.taskScoped === false ? {} : { taskId: RELEASE_QA_TASK_ID }),
    ...(options.screenId ? { screenId: options.screenId } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  });
}

function derived(
  sessionIndex: number,
  index: number,
  eventType: DerivedTrackingEvent["eventType"],
  rawEvidence: readonly Raw[],
  options: Readonly<{ outcome?: "success_direct" | "success_indirect"; ruleVersion?: string }> = {},
): Derived {
  const sessionId = `release-session-${String(sessionIndex).padStart(2, "0")}`;
  const eventId = `${sessionId}:derived:${index}:${eventType}`;
  return Object.freeze({
    schemaVersion: 2,
    eventId,
    idempotencyKey: `idem:${eventId}`,
    eventLayer: "derived",
    source: eventType === "task_success" || eventType === "task_failed" ? "rules_engine" : "analytics",
    eventType,
    occurredAt: rawEvidence.at(-1)?.occurredAt ?? timestamp(sessionIndex, 59 + index),
    receivedAt: rawEvidence.at(-1)?.receivedAt ?? timestamp(sessionIndex, 59 + index),
    sessionId,
    participantId: `release-participant-${String(sessionIndex).padStart(2, "0")}`,
    testId: RELEASE_QA_TEST_ID,
    testVersionId: RELEASE_QA_TEST_VERSION_ID,
    taskId: RELEASE_QA_TASK_ID,
    derivedFromEventIds: rawEvidence.map((event) => event.eventId),
    ruleVersion: options.ruleVersion ?? `${eventType}-qa-v1`,
    ...(options.outcome ? { metadata: { outcome: options.outcome } } : {}),
  });
}

function outcomeFor(index: number): TaskOutcome {
  const outcomes: TaskOutcome[] = [
    "success_direct",
    "success_indirect",
    "failed",
    "give_up",
    "timeout",
    "abandoned",
    "technical_blocked",
  ];
  return outcomes[index % outcomes.length];
}

function buildSession(index: number): { events: AcceptedTrackingEvent[]; outcome: TaskOutcome; answer: ResultAnswer } {
  const outcome = outcomeFor(index);
  const raws: Raw[] = [];
  let sequence = 0;
  raws.push(raw(index, sequence++, "session_started", { taskScoped: false }));
  raws.push(raw(index, sequence++, "task_started"));

  const path = outcome === "success_indirect"
    ? ["A", "X", "B", "C", "C", "B", "C", "C"]
    : outcome === "failed"
      ? ["A", "B", "F", "F", "B", "F", "F", "F"]
      : ["A", "B", "C", "C", "B", "C", "C", "C"];
  const screenEvents: Raw[] = [];
  for (const screenId of path) {
    const event = raw(index, sequence++, "screen_view", { screenId, metadata: { provider: "synthetic_release_qa", fixtureVersion: "release-qa-v1" } });
    raws.push(event);
    screenEvents.push(event);
  }

  const pointerEvents: Raw[] = [];
  for (let pointer = 0; pointer < 12; pointer += 1) {
    const event = raw(index, sequence++, "pointer_interaction", {
      screenId: path[Math.min(pointer % path.length, path.length - 1)],
      metadata: { provider: "synthetic_release_qa", handled: pointer % 5 !== 0, fixtureVersion: "release-qa-v1" },
    });
    raws.push(event);
    pointerEvents.push(event);
  }

  for (let component = 0; component < 3; component += 1) {
    raws.push(raw(index, sequence++, "component_state_changed", { metadata: { componentId: `component-${component}`, state: `state-${index % 3}` } }));
  }
  raws.push(raw(index, sequence++, "question_viewed"));
  raws.push(raw(index, sequence++, "question_answered", { metadata: { questionKey: "seq", score: (index % 7) + 1 } }));

  const events: AcceptedTrackingEvent[] = [...raws];
  let terminalRaw: Raw | null = null;
  if (outcome === "success_direct" || outcome === "success_indirect") {
    events.push(derived(index, 0, "task_success", [screenEvents.at(-1)!], { outcome, ruleVersion: "task-outcome-v1" }));
  } else if (outcome === "failed") {
    events.push(derived(index, 0, "task_failed", [screenEvents.at(-1)!], { ruleVersion: "task-outcome-v1" }));
  } else {
    const terminalType: Record<Exclude<TaskOutcome, "success_direct" | "success_indirect" | "failed">, RawTrackingEvent["eventType"]> = {
      give_up: "task_give_up",
      timeout: "task_timeout",
      abandoned: "task_abandoned",
      technical_blocked: "task_technical_blocked",
    };
    terminalRaw = raw(index, sequence++, terminalType[outcome]);
    events.push(terminalRaw);
  }

  events.push(derived(index, 1, "misclick", [pointerEvents[0]], { ruleVersion: "synthetic-misclick-v1" }));
  events.push(derived(index, 2, "misclick", [pointerEvents[5]], { ruleVersion: "synthetic-misclick-v1" }));
  events.push(derived(index, 3, "rage_click", pointerEvents.slice(0, 3), { ruleVersion: "synthetic-rage-v1" }));
  events.push(derived(index, 4, "backtrack", screenEvents.slice(3, 6), { ruleVersion: "synthetic-backtrack-v1" }));

  if (outcome === "abandoned") {
    events.push(raw(index, sequence++, "session_abandoned", { taskScoped: false }));
  } else if (outcome === "technical_blocked") {
    events.push(raw(index, sequence++, "session_technical_blocked", { taskScoped: false }));
  } else {
    events.push(raw(index, sequence++, "session_completed", { taskScoped: false }));
  }

  const answer: ResultAnswer = Object.freeze({
    id: `release-answer-${index}`,
    sessionId: `release-session-${String(index).padStart(2, "0")}`,
    taskId: RELEASE_QA_TASK_ID,
    questionKey: index % 2 === 0 ? "seq" : "open_feedback",
    answerType: index % 2 === 0 ? "seq" : "text",
    value: index % 2 === 0 ? { score: (index % 7) + 1, scaleVersion: "seq-7-v1" } : `Feedback ${index}`,
    createdAt: timestamp(index, 58),
  });

  return { events, outcome, answer };
}

export function buildReleaseQaFixture(sessionCount = 24): ReleaseQaFixture {
  if (!Number.isInteger(sessionCount) || sessionCount < 20) throw new Error("release QA fixture requires at least 20 sessions");
  const events: AcceptedTrackingEvent[] = [];
  const answers: ResultAnswer[] = [];
  const expectedOutcomes: Record<TaskOutcome, number> = {
    success_direct: 0,
    success_indirect: 0,
    failed: 0,
    give_up: 0,
    timeout: 0,
    abandoned: 0,
    technical_blocked: 0,
  };

  for (let index = 0; index < sessionCount; index += 1) {
    const session = buildSession(index);
    events.push(...session.events);
    answers.push(session.answer);
    expectedOutcomes[session.outcome] += 1;
  }

  if (events.length < 500) throw new Error(`release QA fixture must contain at least 500 events; got ${events.length}`);
  const duplicateSlice = events.slice(0, Math.min(40, events.length));
  return Object.freeze({
    events: Object.freeze(events),
    deliveryEventsWithDuplicates: Object.freeze([...events, ...duplicateSlice]),
    answers: Object.freeze(answers),
    tasks: Object.freeze([{ taskId: RELEASE_QA_TASK_ID, title: "Provider-neutral release QA task", ordinal: 1, expectedPath: Object.freeze(["A", "B", "C"]) }]),
    expectedOutcomes: Object.freeze(expectedOutcomes),
    sessionCount,
    uniqueEventCount: events.length,
  });
}
