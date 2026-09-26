import type { ResultsModel, TaskDetailResult } from "../analytics/results.ts";
import type { EvidenceAvailability, ResultsStudyContext, ResultsTargetContext } from "../analytics/context.ts";
import { buildMetricObservations, capabilityState, unique } from "../analytics/observations.ts";
import type { MetricObservation } from "../analytics/observations.ts";
import type { FindingEvidenceRecord, FindingRecord, RetestMetricComparison } from "../findings/model.ts";

export type ReportAvailability = EvidenceAvailability;
export type ReportTargetContext = ResultsTargetContext;
export type ReportStudyContext = ResultsStudyContext;

export const USABILITY_REPORT_VERSION = "mt10-report-v1" as const;
export { METRIC_DEFINITION_VERSION } from "../analytics/observations.ts";
export type { MetricObservation } from "../analytics/observations.ts";
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
  if (input.results.context && JSON.stringify(input.results.context) !== JSON.stringify(input.context)) {
    throw new Error("report_results_context_mismatch");
  }
  if (input.findings.some((finding) => finding.testVersionId !== input.context.testVersionId)) {
    throw new Error("report_finding_version_mismatch");
  }

  const allObservations = input.results.context
    ? input.results.metrics
    : buildMetricObservations(input.results, input.context.target);
  const taskEntries = input.results.taskDetails.map((task) => Object.freeze({
    taskId: task.taskId,
    title: task.title,
    ordinal: task.ordinal,
    observations: Object.freeze(allObservations.filter((item) => item.taskId === task.taskId)),
    outcomes: task.outcomes,
  }));

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
