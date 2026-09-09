export const FINDING_MODEL_VERSION = "finding-v1" as const;
export const RETEST_COMPARISON_VERSION = "retest-v1" as const;

export const findingSeverities = ["critical", "high", "medium", "low"] as const;
export const findingStatuses = ["open", "fixed", "retest_needed", "verified", "dismissed"] as const;
export const evidenceTypes = ["session", "event", "answer", "path", "heatmap"] as const;

export type FindingSeverity = (typeof findingSeverities)[number];
export type FindingStatus = (typeof findingStatuses)[number];
export type FindingEvidenceType = (typeof evidenceTypes)[number];

export type MetricSnapshot = Readonly<{
  metricKey: string;
  value: number | null;
  sampleSize: number;
  technicalBlockedCount: number;
  testVersionId: string;
  aggregationVersion: string | null;
  ruleVersions: readonly string[];
  sourceEventIds: readonly string[];
}>;

export type FindingRecord = Readonly<{
  id: string;
  workspaceId: string;
  projectId: string;
  testVersionId: string;
  taskId: string | null;
  screenId: string | null;
  title: string;
  problem: string;
  description: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  metricSnapshot: MetricSnapshot;
  createdAt: string;
  updatedAt: string;
}>;

export type FindingEvidenceRecord = Readonly<{
  id: string;
  findingId: string;
  type: FindingEvidenceType;
  sessionId: string | null;
  eventId: string | null;
  answerId: string | null;
  note: string | null;
  payload: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type RetestMetricComparison = Readonly<{
  comparisonVersion: typeof RETEST_COMPARISON_VERSION;
  metricKey: string;
  baseline: Readonly<{
    testVersionId: string;
    value: number | null;
    sampleSize: number;
    technicalBlockedCount: number;
  }>;
  retest: Readonly<{
    testVersionId: string;
    value: number | null;
    sampleSize: number;
    technicalBlockedCount: number;
  }>;
  absoluteDelta: number | null;
  relativeDeltaPercent: number | null;
  statisticalSignificance: null;
}>;

function nonEmptyText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field}_required`);
  return value.trim();
}

function finiteOrNull(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field}_invalid`);
  return value;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${field}_invalid`);
  return value;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim()))].sort();
}

export function normalizeMetricSnapshot(value: unknown, expectedVersionId?: string): MetricSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("metric_snapshot_invalid");
  const testVersionId = nonEmptyText(Reflect.get(value, "testVersionId"), "testVersionId");
  if (expectedVersionId && testVersionId !== expectedVersionId) throw new Error("metric_snapshot_version_mismatch");
  const aggregationVersion = Reflect.get(value, "aggregationVersion");
  return Object.freeze({
    metricKey: nonEmptyText(Reflect.get(value, "metricKey"), "metricKey"),
    value: finiteOrNull(Reflect.get(value, "value"), "metricValue"),
    sampleSize: nonNegativeInteger(Reflect.get(value, "sampleSize"), "sampleSize"),
    technicalBlockedCount: nonNegativeInteger(Reflect.get(value, "technicalBlockedCount"), "technicalBlockedCount"),
    testVersionId,
    aggregationVersion: typeof aggregationVersion === "string" && aggregationVersion.trim() ? aggregationVersion.trim() : null,
    ruleVersions: Object.freeze(stringArray(Reflect.get(value, "ruleVersions"))),
    sourceEventIds: Object.freeze(stringArray(Reflect.get(value, "sourceEventIds"))),
  });
}

export function compareRetestMetric(input: Readonly<{
  baselineVersionId: string;
  retestVersionId: string;
  before: unknown;
  after: unknown;
}>): RetestMetricComparison {
  const baseline = normalizeMetricSnapshot(input.before, input.baselineVersionId);
  const retest = normalizeMetricSnapshot(input.after, input.retestVersionId);
  if (baseline.metricKey !== retest.metricKey) throw new Error("retest_metric_key_mismatch");
  const absoluteDelta = baseline.value === null || retest.value === null ? null : retest.value - baseline.value;
  const relativeDeltaPercent = absoluteDelta === null || baseline.value === null || baseline.value === 0
    ? null
    : (absoluteDelta / Math.abs(baseline.value)) * 100;
  return Object.freeze({
    comparisonVersion: RETEST_COMPARISON_VERSION,
    metricKey: baseline.metricKey,
    baseline: Object.freeze({
      testVersionId: baseline.testVersionId,
      value: baseline.value,
      sampleSize: baseline.sampleSize,
      technicalBlockedCount: baseline.technicalBlockedCount,
    }),
    retest: Object.freeze({
      testVersionId: retest.testVersionId,
      value: retest.value,
      sampleSize: retest.sampleSize,
      technicalBlockedCount: retest.technicalBlockedCount,
    }),
    absoluteDelta,
    relativeDeltaPercent,
    statisticalSignificance: null,
  });
}

export function isFindingSeverity(value: unknown): value is FindingSeverity {
  return typeof value === "string" && (findingSeverities as readonly string[]).includes(value);
}

export function isFindingStatus(value: unknown): value is FindingStatus {
  return typeof value === "string" && (findingStatuses as readonly string[]).includes(value);
}

export function isEvidenceType(value: unknown): value is FindingEvidenceType {
  return typeof value === "string" && (evidenceTypes as readonly string[]).includes(value);
}
