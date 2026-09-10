import { aggregateAnalytics, type TaskMetricAggregate } from "./aggregation.ts";
import { deriveFunnel, type FunnelDefinition, type FunnelResult } from "./funnel.ts";
import { buildScreenHeatmap, type ScreenHeatmapDataset } from "./heatmap.ts";
import { deriveTaskTimeMetrics } from "./time-metrics.ts";
import { median, percentage } from "./metrics.ts";
import type { AcceptedTrackingEvent, TaskOutcome } from "../tracking/events.ts";

export const RESULTS_MODEL_VERSION = "tasks44-49-v2" as const;
export const SEQ_SCALE_VERSION = "seq-7-v1" as const;

export type ResultTaskDefinition = Readonly<{
  taskId: string;
  title: string;
  ordinal: number;
  expectedPath: readonly string[];
}>;

export type ResultAnswer = Readonly<{
  id: string;
  sessionId: string;
  taskId: string | null;
  questionKey: string;
  answerType: string;
  value: unknown;
  createdAt: string;
}>;

export type SeqResponse = Readonly<{
  answerId: string;
  sessionId: string;
  taskId: string;
  value: number;
  scaleVersion: string;
  createdAt: string;
}>;

export type ResultsOverview = Readonly<{
  participantCount: number;
  sessionCount: number;
  eligibleTaskCount: number;
  technicalBlockedTaskCount: number;
  completionRate: number | null;
  medianSuccessfulDurationMs: number | null;
  successfulDurationSampleSize: number;
  giveUpCount: number;
  giveUpRate: number | null;
  misclickCount: number;
  misclickRate: number | null;
  rageClickCount: number;
  backtrackCount: number;
}>;

export type TaskDetailResult = Readonly<{
  taskId: string;
  title: string;
  ordinal: number;
  started: number;
  eligible: number;
  technicalBlockedCount: number;
  outcomes: Readonly<Record<TaskOutcome, number>>;
  completionRate: number | null;
  giveUpRate: number | null;
  misclickCount: number;
  misclickRate: number | null;
  successfulDuration: TaskMetricAggregate["successfulDuration"];
  seqResponses: readonly SeqResponse[];
  seqSampleSize: number;
  trace: TaskMetricAggregate["trace"];
}>;

export type TaskPathResult = Readonly<{
  sessionId: string;
  taskId: string;
  expectedPath: readonly string[];
  actualPath: readonly string[];
  expectedPathMatch: boolean;
  detourCount: number;
  repeatedScreenCount: number;
  backtrackCount: number;
  terminalOutcome: TaskOutcome | null;
}>;

export type SessionTimelineItem = Readonly<{
  kind: "event" | "feedback";
  id: string;
  occurredAt: string;
  taskId: string | null;
  eventType: string;
  layer: "raw" | "derived" | "answer";
  sequence: number | null;
  screenId: string | null;
  ruleVersion: string | null;
  value: unknown;
}>;

export type SessionDetailResult = Readonly<{
  sessionId: string;
  participantId: string;
  terminal: "completed" | "abandoned" | "technical_blocked" | null;
  taskOutcomes: Readonly<Record<string, TaskOutcome | null>>;
  timeline: readonly SessionTimelineItem[];
}>;

export type ResultsModel = Readonly<{
  modelVersion: typeof RESULTS_MODEL_VERSION;
  testId: string | null;
  testVersionId: string;
  overview: ResultsOverview;
  taskDetails: readonly TaskDetailResult[];
  paths: readonly TaskPathResult[];
  sessions: readonly SessionDetailResult[];
  heatmap: ScreenHeatmapDataset;
  funnel: FunnelResult | null;
  unsupported: Readonly<{
    heatmap: boolean;
    funnel: boolean;
    reasons: readonly string[];
  }>;
}>;

function seqValue(value: unknown): { score: number; scaleVersion: string } | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7) {
    return { score: value, scaleVersion: SEQ_SCALE_VERSION };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const score = Reflect.get(value, "score") ?? Reflect.get(value, "value");
  const scaleVersion = Reflect.get(value, "scaleVersion") ?? Reflect.get(value, "scale_version") ?? SEQ_SCALE_VERSION;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 7) return null;
  if (typeof scaleVersion !== "string" || !scaleVersion.trim()) return null;
  return { score, scaleVersion: scaleVersion.trim() };
}

function outcomeForTask(events: readonly AcceptedTrackingEvent[]): TaskOutcome | null {
  const candidates: Array<{ outcome: TaskOutcome; anchor: number; at: number; id: string }> = [];
  const rawById = new Map(
    events.filter((event) => event.eventLayer === "raw").map((event) => [event.eventId, event]),
  );
  for (const event of events) {
    if (!event.taskId) continue;
    if (event.eventLayer === "raw") {
      const outcome: Partial<Record<typeof event.eventType, TaskOutcome>> = {
        task_give_up: "give_up",
        task_timeout: "timeout",
        task_abandoned: "abandoned",
        task_technical_blocked: "technical_blocked",
      };
      const resolved = outcome[event.eventType];
      if (resolved) candidates.push({ outcome: resolved, anchor: event.sequence, at: Date.parse(event.occurredAt), id: event.eventId });
      continue;
    }
    if (event.eventType !== "task_success" && event.eventType !== "task_failed") continue;
    const refs = event.derivedFromEventIds.map((id) => rawById.get(id)).filter((item): item is Extract<AcceptedTrackingEvent, { eventLayer: "raw" }> => Boolean(item));
    if (refs.length !== event.derivedFromEventIds.length || refs.length === 0) continue;
    const anchor = Math.max(...refs.map((item) => item.sequence));
    const outcome = event.eventType === "task_failed"
      ? "failed"
      : event.metadata?.outcome === "success_indirect" ? "success_indirect" : "success_direct";
    candidates.push({ outcome, anchor, at: Date.parse(event.occurredAt), id: event.eventId });
  }
  candidates.sort((a, b) => a.anchor - b.anchor || a.at - b.at || a.id.localeCompare(b.id));
  return candidates[0]?.outcome ?? null;
}

function eventAnchor(event: AcceptedTrackingEvent, index: ReadonlyMap<string, AcceptedTrackingEvent>): number {
  if (event.eventLayer === "raw") return event.sequence;
  const raw = event.derivedFromEventIds.flatMap((id) => {
    const source = index.get(id);
    return source?.eventLayer === "raw" ? [source.sequence] : [];
  });
  return raw.length ? Math.max(...raw) : Number.MAX_SAFE_INTEGER;
}

function orderedTaskEvents(events: readonly AcceptedTrackingEvent[]): AcceptedTrackingEvent[] {
  const index = new Map(events.map((event) => [event.eventId, event]));
  return [...events].sort((a, b) =>
    eventAnchor(a, index) - eventAnchor(b, index)
    || Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
    || (a.eventLayer === "raw" ? 0 : 1) - (b.eventLayer === "raw" ? 0 : 1)
    || a.eventId.localeCompare(b.eventId));
}

function arrayEquals(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function repeatedScreens(path: readonly string[]): number {
  const seen = new Set<string>();
  let repeats = 0;
  for (const screen of path) {
    if (seen.has(screen)) repeats += 1;
    seen.add(screen);
  }
  return repeats;
}

function buildPaths(
  events: readonly AcceptedTrackingEvent[],
  tasks: readonly ResultTaskDefinition[],
): TaskPathResult[] {
  const definitions = new Map(tasks.map((task) => [task.taskId, task]));
  const groups = new Map<string, AcceptedTrackingEvent[]>();
  for (const event of events) {
    if (!event.taskId) continue;
    const key = `${event.sessionId}\u0000${event.taskId}`;
    const group = groups.get(key);
    if (group) group.push(event); else groups.set(key, [event]);
  }
  const output: TaskPathResult[] = [];
  for (const scoped of groups.values()) {
    const first = scoped[0];
    const definition = definitions.get(first.taskId!);
    const expectedPath = definition?.expectedPath ?? [];
    const actualPath = orderedTaskEvents(scoped)
      .filter((event) => event.eventLayer === "raw" && event.eventType === "screen_view" && event.screenId)
      .map((event) => event.screenId!);
    const expectedSet = new Set(expectedPath);
    const backtrackCount = scoped.filter((event) => event.eventLayer === "derived" && event.eventType === "backtrack").length;
    output.push(Object.freeze({
      sessionId: first.sessionId,
      taskId: first.taskId!,
      expectedPath: Object.freeze([...expectedPath]),
      actualPath: Object.freeze(actualPath),
      expectedPathMatch: expectedPath.length > 0 && arrayEquals(expectedPath, actualPath),
      detourCount: expectedPath.length > 0 ? actualPath.filter((screen) => !expectedSet.has(screen)).length : 0,
      repeatedScreenCount: repeatedScreens(actualPath),
      backtrackCount,
      terminalOutcome: outcomeForTask(scoped),
    }));
  }
  return output.sort((a, b) => a.taskId.localeCompare(b.taskId) || a.sessionId.localeCompare(b.sessionId));
}

function buildSessionDetails(
  events: readonly AcceptedTrackingEvent[],
  answers: readonly ResultAnswer[],
): SessionDetailResult[] {
  const bySession = new Map<string, AcceptedTrackingEvent[]>();
  for (const event of events) {
    const group = bySession.get(event.sessionId);
    if (group) group.push(event); else bySession.set(event.sessionId, [event]);
  }
  const answersBySession = new Map<string, ResultAnswer[]>();
  for (const answer of answers) {
    const group = answersBySession.get(answer.sessionId);
    if (group) group.push(answer); else answersBySession.set(answer.sessionId, [answer]);
  }
  const output: SessionDetailResult[] = [];
  for (const [sessionId, scoped] of bySession) {
    const ordered = orderedTaskEvents(scoped);
    const first = ordered[0];
    const taskGroups = new Map<string, AcceptedTrackingEvent[]>();
    for (const event of scoped) {
      if (!event.taskId) continue;
      const group = taskGroups.get(event.taskId);
      if (group) group.push(event); else taskGroups.set(event.taskId, [event]);
    }
    const taskOutcomes: Record<string, TaskOutcome | null> = {};
    for (const [taskId, taskEvents] of taskGroups) taskOutcomes[taskId] = outcomeForTask(taskEvents);
    const eventIndex = new Map(scoped.map((event) => [event.eventId, event]));
    const eventItems: SessionTimelineItem[] = scoped.map((event) => ({
      kind: "event",
      id: event.eventId,
      occurredAt: event.occurredAt,
      taskId: event.taskId ?? null,
      eventType: event.eventType,
      layer: event.eventLayer,
      sequence: event.eventLayer === "raw" ? event.sequence : eventAnchor(event, eventIndex),
      screenId: event.screenId ?? null,
      ruleVersion: event.eventLayer === "derived" ? event.ruleVersion : null,
      value: event.metadata ?? null,
    }));
    const feedbackItems: SessionTimelineItem[] = (answersBySession.get(sessionId) ?? []).map((answer) => ({
      kind: "feedback",
      id: answer.id,
      occurredAt: answer.createdAt,
      taskId: answer.taskId,
      eventType: answer.questionKey,
      layer: "answer",
      sequence: null,
      screenId: null,
      ruleVersion: null,
      value: answer.value,
    }));
    const timeline = [...eventItems, ...feedbackItems].sort((a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
      || (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER)
      || a.id.localeCompare(b.id));
    const sessionAggregate = aggregateAnalytics(scoped).sessions[0];
    output.push(Object.freeze({
      sessionId,
      participantId: first.participantId,
      terminal: sessionAggregate?.terminal ?? null,
      taskOutcomes: Object.freeze(taskOutcomes),
      timeline: Object.freeze(timeline),
    }));
  }
  return output.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}

export function buildResultsModel(input: Readonly<{
  testVersionId: string;
  events: readonly AcceptedTrackingEvent[];
  tasks: readonly ResultTaskDefinition[];
  answers?: readonly ResultAnswer[];
  funnelDefinition?: FunnelDefinition | null;
}>): ResultsModel {
  const scopedEvents = input.events.filter((event) => event.testVersionId === input.testVersionId);
  const answers = input.answers ?? [];
  const analytics = aggregateAnalytics(scopedEvents);
  const taskById = new Map(input.tasks.map((task) => [task.taskId, task]));
  const successfulKeys = new Set(scopedEvents.flatMap((event) =>
    event.eventLayer === "derived" && event.eventType === "task_success" && event.taskId
      ? [`${event.sessionId}\u0000${event.taskId}`] : []));
  const times = deriveTaskTimeMetrics(scopedEvents);
  const successfulDurations = times.flatMap((metric) =>
    metric.timeOnTaskMs !== null && successfulKeys.has(`${metric.sessionId}\u0000${metric.taskId}`)
      ? [metric.timeOnTaskMs] : []);
  const taskMetrics = analytics.taskMetrics;
  const eligibleTaskCount = taskMetrics.reduce((sum, task) => sum + task.eligible, 0);
  const successCount = taskMetrics.reduce((sum, task) => sum + task.outcomes.success_direct + task.outcomes.success_indirect, 0);
  const technicalBlockedTaskCount = taskMetrics.reduce((sum, task) => sum + task.outcomes.technical_blocked, 0);
  const giveUpCount = taskMetrics.reduce((sum, task) => sum + task.outcomes.give_up, 0);
  const eligiblePointers = taskMetrics.reduce((sum, task) => sum + task.eligiblePointerInteractions, 0);
  const misclickCount = taskMetrics.reduce((sum, task) => sum + task.misclicks, 0);
  const participantCount = new Set(analytics.sessions.map((session) => session.participantId)).size;
  const rageClickCount = scopedEvents.filter((event) => event.eventLayer === "derived" && event.eventType === "rage_click").length;
  const backtrackCount = scopedEvents.filter((event) => event.eventLayer === "derived" && event.eventType === "backtrack").length;

  const taskDetails = taskMetrics.map((metric) => {
    const definition = taskById.get(metric.taskId);
    const seqResponses: SeqResponse[] = answers.flatMap((answer) => {
      if (answer.taskId !== metric.taskId || answer.questionKey !== "seq") return [];
      const parsed = seqValue(answer.value);
      return parsed ? [Object.freeze({
        answerId: answer.id,
        sessionId: answer.sessionId,
        taskId: metric.taskId,
        value: parsed.score,
        scaleVersion: parsed.scaleVersion,
        createdAt: answer.createdAt,
      })] : [];
    });
    return Object.freeze({
      taskId: metric.taskId,
      title: definition?.title ?? metric.taskId,
      ordinal: definition?.ordinal ?? Number.MAX_SAFE_INTEGER,
      started: metric.started,
      eligible: metric.eligible,
      technicalBlockedCount: metric.outcomes.technical_blocked,
      outcomes: metric.outcomes,
      completionRate: metric.completionRate,
      giveUpRate: metric.giveUpRate,
      misclickCount: metric.misclicks,
      misclickRate: metric.misclickRate,
      successfulDuration: metric.successfulDuration,
      seqResponses: Object.freeze(seqResponses.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))),
      seqSampleSize: seqResponses.length,
      trace: metric.trace,
    });
  }).sort((a, b) => a.ordinal - b.ordinal || a.taskId.localeCompare(b.taskId));

  const heatmap = buildScreenHeatmap(input.testVersionId, scopedEvents);
  const funnel = input.funnelDefinition ? deriveFunnel(scopedEvents, input.funnelDefinition) : null;
  const unsupportedReasons = [
    ...(heatmap.status === "unsupported" ? ["Canonical heatmap geometry is unavailable for the recorded pointer evidence."] : []),
    ...(funnel ? [] : ["No funnel definition is stored with this published test version."]),
  ];

  return Object.freeze({
    modelVersion: RESULTS_MODEL_VERSION,
    testId: scopedEvents[0]?.testId ?? null,
    testVersionId: input.testVersionId,
    overview: Object.freeze({
      participantCount,
      sessionCount: analytics.sessions.length,
      eligibleTaskCount,
      technicalBlockedTaskCount,
      completionRate: percentage(successCount, eligibleTaskCount),
      medianSuccessfulDurationMs: median(successfulDurations),
      successfulDurationSampleSize: successfulDurations.length,
      giveUpCount,
      giveUpRate: percentage(giveUpCount, eligibleTaskCount),
      misclickCount,
      misclickRate: percentage(misclickCount, eligiblePointers),
      rageClickCount,
      backtrackCount,
    }),
    taskDetails: Object.freeze(taskDetails),
    paths: Object.freeze(buildPaths(scopedEvents, input.tasks)),
    sessions: Object.freeze(buildSessionDetails(scopedEvents, answers)),
    heatmap,
    funnel,
    unsupported: Object.freeze({
      heatmap: heatmap.status === "unsupported",
      funnel: funnel === null,
      reasons: Object.freeze(unsupportedReasons),
    }),
  });
}
