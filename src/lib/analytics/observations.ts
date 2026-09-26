import type { ResultsModel, TaskDetailResult } from "./results.ts";
import type { ResultsTargetContext, EvidenceAvailability } from "./context.ts";

export const METRIC_DEFINITION_VERSION = "analytics-v1" as const;
export type MetricObservation = Readonly<{
  metricKey: string;
  metricDefinitionVersion: typeof METRIC_DEFINITION_VERSION | "seq-7-v1";
  scope: "overall" | "task";
  taskId: string | null;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  sampleSize: number;
  technicalBlockedCount: number;
  availability: EvidenceAvailability;
  requiredCapabilities: readonly string[];
  testVersionId: string;
  targetProvider: string | null;
  targetSnapshotVersion: number | null;
  aggregationVersion: string | null;
  ruleVersions: readonly string[];
  evidenceRefs: readonly string[];
}>;

type ResultsMetricsSource = Pick<ResultsModel, "testVersionId" | "overview" | "taskDetails">;
type TraceLike = Readonly<{
  aggregationVersion: string;
  eventIds: readonly string[];
  ruleVersions: readonly string[];
}>;

export function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function capabilityState(target: ResultsTargetContext, capability: string): EvidenceAvailability | null {
  return target.capabilities[capability] ?? null;
}

function availability(input: Readonly<{
  target: ResultsTargetContext;
  requiredCapabilities: readonly string[];
  value: number | null;
  evidenceCount: number;
}>): EvidenceAvailability {
  if (!input.target.provider || input.target.snapshotVersion === null) return "Partial";
  const states = input.requiredCapabilities.map((name) => capabilityState(input.target, name));
  if (states.some((state) => state === "Unsupported")) return "Unsupported";
  if (states.some((state) => state === "Partial" || state === null)) return "Partial";
  if (states.some((state) => state === "No Data")) return "No Data";
  if (input.value === null || input.evidenceCount <= 0) return "No Data";
  return "Available";
}

function combineTrace(traces: readonly TraceLike[]): Readonly<{
  aggregationVersion: string | null;
  ruleVersions: readonly string[];
  evidenceRefs: readonly string[];
}> {
  const versions = unique(traces.map((trace) => trace.aggregationVersion));
  return Object.freeze({
    aggregationVersion: versions.length === 1 ? versions[0] : versions.length > 1 ? `mixed:${versions.join(",")}` : null,
    ruleVersions: Object.freeze(unique(traces.flatMap((trace) => [...trace.ruleVersions]))),
    evidenceRefs: Object.freeze(unique(traces.flatMap((trace) => [...trace.eventIds]))),
  });
}

function taskTrace(task: TaskDetailResult, key: string): TraceLike {
  if (key === "misclickRate") return task.trace.misclick;
  if (key === "medianSuccessfulDurationMs" || key === "p75SuccessfulDurationMs" || key === "p90SuccessfulDurationMs") return task.trace.timeOnTask;
  return task.trace.completion;
}

function observation(input: Readonly<{
  results: ResultsMetricsSource;
  target: ResultsTargetContext;
  metricKey: string;
  taskId: string | null;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  sampleSize: number;
  technicalBlockedCount: number;
  requiredCapabilities?: readonly string[];
  traces?: readonly TraceLike[];
  evidenceRefs?: readonly string[];
  metricDefinitionVersion?: typeof METRIC_DEFINITION_VERSION | "seq-7-v1";
}>): MetricObservation {
  const traces = input.traces ?? [];
  const combined = combineTrace(traces);
  const explicitRefs = input.evidenceRefs ?? [];
  const evidenceRefs = unique([...combined.evidenceRefs, ...explicitRefs]);
  const evidenceCount = input.denominator ?? input.sampleSize ?? evidenceRefs.length;
  const requiredCapabilities = input.requiredCapabilities ?? [];
  return Object.freeze({
    metricKey: input.metricKey,
    metricDefinitionVersion: input.metricDefinitionVersion ?? METRIC_DEFINITION_VERSION,
    scope: input.taskId ? "task" : "overall",
    taskId: input.taskId,
    value: input.value,
    numerator: input.numerator,
    denominator: input.denominator,
    sampleSize: input.sampleSize,
    technicalBlockedCount: input.technicalBlockedCount,
    availability: availability({
      target: input.target,
      requiredCapabilities,
      value: input.value,
      evidenceCount,
    }),
    requiredCapabilities: Object.freeze([...requiredCapabilities]),
    testVersionId: input.results.testVersionId,
    targetProvider: input.target.provider,
    targetSnapshotVersion: input.target.snapshotVersion,
    aggregationVersion: combined.aggregationVersion,
    ruleVersions: combined.ruleVersions,
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}

function overallObservations(results: ResultsMetricsSource, target: ResultsTargetContext): MetricObservation[] {
  const taskTraces = (key: string) => results.taskDetails.map((task) => taskTrace(task, key));
  const successCount = results.taskDetails.reduce(
    (sum, task) => sum + task.outcomes.success_direct + task.outcomes.success_indirect,
    0,
  );
  return [
    observation({
      results, target, metricKey: "completionRate", taskId: null,
      value: results.overview.completionRate, numerator: successCount,
      denominator: results.overview.eligibleTaskCount,
      sampleSize: results.overview.eligibleTaskCount,
      technicalBlockedCount: results.overview.technicalBlockedTaskCount,
      traces: taskTraces("completionRate"),
    }),
    observation({
      results, target, metricKey: "medianSuccessfulDurationMs", taskId: null,
      value: results.overview.medianSuccessfulDurationMs, numerator: null, denominator: null,
      sampleSize: results.overview.successfulDurationSampleSize,
      technicalBlockedCount: results.overview.technicalBlockedTaskCount,
      traces: taskTraces("medianSuccessfulDurationMs"),
    }),
    observation({
      results, target, metricKey: "p75SuccessfulDurationMs", taskId: null,
      value: results.overview.p75SuccessfulDurationMs, numerator: null, denominator: null,
      sampleSize: results.overview.successfulDurationSampleSize,
      technicalBlockedCount: results.overview.technicalBlockedTaskCount,
      traces: taskTraces("p75SuccessfulDurationMs"),
    }),
    observation({
      results, target, metricKey: "p90SuccessfulDurationMs", taskId: null,
      value: results.overview.p90SuccessfulDurationMs, numerator: null, denominator: null,
      sampleSize: results.overview.successfulDurationSampleSize,
      technicalBlockedCount: results.overview.technicalBlockedTaskCount,
      traces: taskTraces("p90SuccessfulDurationMs"),
    }),
    observation({
      results, target, metricKey: "giveUpRate", taskId: null,
      value: results.overview.giveUpRate, numerator: results.overview.giveUpCount,
      denominator: results.overview.eligibleTaskCount,
      sampleSize: results.overview.eligibleTaskCount,
      technicalBlockedCount: results.overview.technicalBlockedTaskCount,
      traces: taskTraces("giveUpRate"),
    }),
    observation({
      results, target, metricKey: "misclickRate", taskId: null,
      value: results.overview.misclickRate, numerator: results.overview.misclickCount,
      denominator: results.overview.eligiblePointerInteractionCount,
      sampleSize: results.overview.eligiblePointerInteractionCount,
      technicalBlockedCount: results.overview.technicalBlockedTaskCount,
      requiredCapabilities: ["pointer"],
      traces: taskTraces("misclickRate"),
    }),
  ];
}

function taskObservations(results: ResultsMetricsSource, target: ResultsTargetContext, task: TaskDetailResult): MetricObservation[] {
  const successCount = task.outcomes.success_direct + task.outcomes.success_indirect;
  const seqValues = task.seqResponses.map((response) => response.value);
  return [
    observation({
      results, target, metricKey: "completionRate", taskId: task.taskId,
      value: task.completionRate, numerator: successCount, denominator: task.eligible,
      sampleSize: task.eligible, technicalBlockedCount: task.technicalBlockedCount,
      traces: [task.trace.completion],
    }),
    observation({
      results, target, metricKey: "medianSuccessfulDurationMs", taskId: task.taskId,
      value: task.successfulDuration.medianMs, numerator: null, denominator: null,
      sampleSize: task.successfulDuration.sampleSize, technicalBlockedCount: task.technicalBlockedCount,
      traces: [task.trace.timeOnTask],
    }),
    observation({
      results, target, metricKey: "p75SuccessfulDurationMs", taskId: task.taskId,
      value: task.successfulDuration.p75Ms, numerator: null, denominator: null,
      sampleSize: task.successfulDuration.sampleSize, technicalBlockedCount: task.technicalBlockedCount,
      traces: [task.trace.timeOnTask],
    }),
    observation({
      results, target, metricKey: "p90SuccessfulDurationMs", taskId: task.taskId,
      value: task.successfulDuration.p90Ms, numerator: null, denominator: null,
      sampleSize: task.successfulDuration.sampleSize, technicalBlockedCount: task.technicalBlockedCount,
      traces: [task.trace.timeOnTask],
    }),
    observation({
      results, target, metricKey: "giveUpRate", taskId: task.taskId,
      value: task.giveUpRate, numerator: task.outcomes.give_up, denominator: task.eligible,
      sampleSize: task.eligible, technicalBlockedCount: task.technicalBlockedCount,
      traces: [task.trace.completion],
    }),
    observation({
      results, target, metricKey: "misclickRate", taskId: task.taskId,
      value: task.misclickRate, numerator: task.misclickCount, denominator: task.eligiblePointerInteractions,
      sampleSize: task.eligiblePointerInteractions, technicalBlockedCount: task.technicalBlockedCount,
      requiredCapabilities: ["pointer"], traces: [task.trace.misclick],
    }),
    observation({
      results, target, metricKey: "seqMedian", taskId: task.taskId,
      value: median(seqValues), numerator: null, denominator: null,
      sampleSize: task.seqSampleSize, technicalBlockedCount: task.technicalBlockedCount,
      evidenceRefs: task.seqResponses.map((response) => response.answerId),
      metricDefinitionVersion: "seq-7-v1",
    }),
  ];
}

export function buildMetricObservations(results: ResultsMetricsSource, target: ResultsTargetContext): readonly MetricObservation[] {
  return Object.freeze([
    ...overallObservations(results, target),
    ...results.taskDetails.flatMap((task) => taskObservations(results, target, task)),
  ]);
}

export function buildTaskMetricObservations(results: ResultsMetricsSource, target: ResultsTargetContext, task: TaskDetailResult): readonly MetricObservation[] {
  return Object.freeze(taskObservations(results, target, task));
}
