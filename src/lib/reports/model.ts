import type { ResultsModel, TaskDetailResult } from "../analytics/results.ts";
import type { FindingEvidenceRecord, FindingRecord, RetestMetricComparison } from "../findings/model.ts";

export const USABILITY_REPORT_VERSION = "mt10-report-v1" as const;
export const METRIC_DEFINITION_VERSION = "analytics-v1" as const;

export type ReportAvailability = "Available" | "Partial" | "Unsupported" | "No Data";

export type ReportTargetContext = Readonly<{
  provider: string | null;
  sourceUrl: string | null;
  environment: string | null;
  launchMode: string | null;
  snapshotVersion: number | null;
  capabilities: Readonly<Record<string, ReportAvailability>>;
}>;

export type ReportStudyContext = Readonly<{
  testId: string;
  testVersionId: string;
  versionNo: number | null;
  lifecycleStatus: string | null;
  publishedAt: string | null;
  target: ReportTargetContext;
}>;

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
  availability: ReportAvailability;
  requiredCapabilities: readonly string[];
  testVersionId: string;
  targetProvider: string | null;
  targetSnapshotVersion: number | null;
  aggregationVersion: string | null;
  ruleVersions: readonly string[];
  evidenceRefs: readonly string[];
}>;

export type ReportFinding = Readonly<{
  finding: FindingRecord;
  metricObservation: MetricObservation | null;
  evidence: readonly FindingEvidenceRecord[];
  evidenceRefs: readonly string[];
}>;

export type ReportRetest = Readonly<{
  retestId: string;
  findingId: string;
  status: string;
  comparison: RetestMetricComparison;
}>;

export type UsabilityReport = Readonly<{
  reportVersion: typeof USABILITY_REPORT_VERSION;
  generatedAt: string;
  study: Readonly<{
    context: ReportStudyContext;
    participantCount: number;
    sessionCount: number;
    eligibleTaskCount: number;
    technicalBlockedTaskCount: number;
    capabilityCoverage: readonly Readonly<{ capability: string; state: ReportAvailability }>[];
  }>;
  executiveSummary: Readonly<{
    totalFindings: number;
    criticalHighFindings: number;
    openFindings: number;
    researcherAuthoredOnly: true;
  }>;
  metrics: readonly MetricObservation[];
  tasks: readonly Readonly<{
    taskId: string;
    title: string;
    ordinal: number;
    observations: readonly MetricObservation[];
    outcomes: TaskDetailResult["outcomes"];
  }>[];
  findings: readonly ReportFinding[];
  evidenceExplorer: Readonly<{
    sessions: ResultsModel["sessions"];
    paths: ResultsModel["paths"];
    heatmapStatus: ReportAvailability;
    heatmapReason: string | null;
    feedbackCount: number;
  }>;
  retests: readonly ReportRetest[];
}>;

type TraceLike = Readonly<{
  aggregationVersion: string;
  eventIds: readonly string[];
  ruleVersions: readonly string[];
}>;

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function capabilityState(target: ReportTargetContext, capability: string): ReportAvailability | null {
  return target.capabilities[capability] ?? null;
}

function availability(input: Readonly<{
  target: ReportTargetContext;
  requiredCapabilities: readonly string[];
  value: number | null;
  evidenceCount: number;
}>): ReportAvailability {
  if (!input.target.provider || input.target.snapshotVersion === null) return "Partial";
  const states = input.requiredCapabilities.map((name) => capabilityState(input.target, name));
  if (states.some((state) => state === "Unsupported")) return "Unsupported";
  if (states.some((state) => state === "Partial" || state === null)) return "Partial";
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
  results: ResultsModel;
  target: ReportTargetContext;
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

function overallObservations(results: ResultsModel, target: ReportTargetContext): MetricObservation[] {
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

function taskObservations(results: ResultsModel, target: ReportTargetContext, task: TaskDetailResult): MetricObservation[] {
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

function evidenceRef(record: FindingEvidenceRecord): string[] {
  return unique([
    record.id,
    record.sessionId ?? "",
    record.eventId ?? "",
    record.answerId ?? "",
  ]);
}

function heatmapAvailability(results: ResultsModel, target: ReportTargetContext): ReportAvailability {
  const pointer = capabilityState(target, "pointer");
  const coordinates = capabilityState(target, "coordinates");
  if (pointer === "Unsupported" || coordinates === "Unsupported") return "Unsupported";
  if (pointer === "Partial" || coordinates === "Partial" || pointer === null || coordinates === null) return "Partial";
  if (results.heatmap.status === "unsupported") return "Unsupported";
  if (results.heatmap.status === "no_data") return "No Data";
  return "Available";
}

export function buildUsabilityReport(input: Readonly<{
  results: ResultsModel;
  context: ReportStudyContext;
  findings: readonly FindingRecord[];
  evidenceByFinding: Readonly<Record<string, readonly FindingEvidenceRecord[]>>;
  retests: readonly ReportRetest[];
  generatedAt?: string;
}>): UsabilityReport {
  if (input.results.testVersionId !== input.context.testVersionId) throw new Error("report_version_context_mismatch");
  if (input.findings.some((finding) => finding.testVersionId !== input.context.testVersionId)) {
    throw new Error("report_finding_version_mismatch");
  }

  const overall = overallObservations(input.results, input.context.target);
  const taskEntries = input.results.taskDetails.map((task) => Object.freeze({
    taskId: task.taskId,
    title: task.title,
    ordinal: task.ordinal,
    observations: Object.freeze(taskObservations(input.results, input.context.target, task)),
    outcomes: task.outcomes,
  }));
  const allObservations = Object.freeze([
    ...overall,
    ...taskEntries.flatMap((task) => [...task.observations]),
  ]);

  const reportFindings = [...input.findings]
    .sort((a, b) => {
      const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.createdAt.localeCompare(b.createdAt);
    })
    .map((finding) => {
      const evidence = input.evidenceByFinding[finding.id] ?? [];
      const metricObservation = allObservations.find((item) =>
        item.metricKey === finding.metricSnapshot.metricKey
        && item.taskId === finding.taskId,
      ) ?? null;
      return Object.freeze({
        finding,
        metricObservation,
        evidence: Object.freeze([...evidence]),
        evidenceRefs: Object.freeze(unique([
          ...finding.metricSnapshot.sourceEventIds,
          ...(metricObservation?.evidenceRefs ?? []),
          ...evidence.flatMap(evidenceRef),
        ])),
      });
    });

  const feedbackCount = input.results.sessions.reduce(
    (sum, session) => sum + session.timeline.filter((item) => item.kind === "feedback").length,
    0,
  );
  const criticalHighFindings = reportFindings.filter((item) =>
    item.finding.severity === "critical" || item.finding.severity === "high",
  ).length;
  const openFindings = reportFindings.filter((item) =>
    !["verified", "dismissed"].includes(item.finding.status),
  ).length;

  return Object.freeze({
    reportVersion: USABILITY_REPORT_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    study: Object.freeze({
      context: input.context,
      participantCount: input.results.overview.participantCount,
      sessionCount: input.results.overview.sessionCount,
      eligibleTaskCount: input.results.overview.eligibleTaskCount,
      technicalBlockedTaskCount: input.results.overview.technicalBlockedTaskCount,
      capabilityCoverage: Object.freeze(
        Object.entries(input.context.target.capabilities)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([capability, state]) => Object.freeze({ capability, state })),
      ),
    }),
    executiveSummary: Object.freeze({
      totalFindings: reportFindings.length,
      criticalHighFindings,
      openFindings,
      researcherAuthoredOnly: true as const,
    }),
    metrics: allObservations,
    tasks: Object.freeze(taskEntries),
    findings: Object.freeze(reportFindings),
    evidenceExplorer: Object.freeze({
      sessions: input.results.sessions,
      paths: input.results.paths,
      heatmapStatus: heatmapAvailability(input.results, input.context.target),
      heatmapReason: input.results.heatmap.reason,
      feedbackCount,
    }),
    retests: Object.freeze([...input.retests]),
  });
}
