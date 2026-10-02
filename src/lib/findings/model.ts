export const FINDING_MODEL_VERSION = "finding-v1" as const;
export const RETEST_COMPARISON_VERSION = "retest-v2" as const;

export const findingSeverities = ["critical", "high", "medium", "low"] as const;
export const findingStatuses = ["open", "fixed", "retest_needed", "verified", "dismissed"] as const;
export const evidenceTypes = ["session", "event", "answer", "path", "heatmap", "method_response"] as const;

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
  metricDefinitionVersion?: string | null;
  targetProvider?: string | null;
  targetSnapshotVersion?: number | null;
  requiredCapabilities?: readonly string[];
  availability?: string | null;
  scope?: string | null;
  taskId?: string | null;
  numerator?: number | null;
  denominator?: number | null;
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
  researcherInterpretation: string | null;
  recommendation: string | null;
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
  studyResponseId?: string | null;
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
    metricDefinitionVersion: string | null;
    targetProvider: string | null;
    targetSnapshotVersion: number | null;
    numerator: number | null;
    denominator: number | null;
  }>;
  retest: Readonly<{
    testVersionId: string;
    value: number | null;
    sampleSize: number;
    technicalBlockedCount: number;
    metricDefinitionVersion: string | null;
    targetProvider: string | null;
    targetSnapshotVersion: number | null;
    numerator: number | null;
    denominator: number | null;
  }>;
  comparable: boolean;
  incomparableReasons: readonly string[];
  absoluteDelta: number | null;
  absoluteDeltaUnit: "percentage_points" | "metric_units";
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

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalCount(value: unknown, field: string): number | null {
  return value === undefined || value === null ? null : nonNegativeInteger(value, field);
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
    metricDefinitionVersion: optionalText(Reflect.get(value, "metricDefinitionVersion")),
    targetProvider: optionalText(Reflect.get(value, "targetProvider")),
    targetSnapshotVersion: optionalCount(Reflect.get(value, "targetSnapshotVersion"), "targetSnapshotVersion"),
    requiredCapabilities: Object.freeze(stringArray(Reflect.get(value, "requiredCapabilities"))),
    availability: optionalText(Reflect.get(value, "availability")),
    scope: optionalText(Reflect.get(value, "scope")),
    taskId: optionalText(Reflect.get(value, "taskId")),
    numerator: optionalCount(Reflect.get(value, "numerator"), "numerator"),
    denominator: optionalCount(Reflect.get(value, "denominator"), "denominator"),
  });
}

function context(snapshot: MetricSnapshot) {
  return Object.freeze({
    testVersionId: snapshot.testVersionId,
    value: snapshot.value,
    sampleSize: snapshot.sampleSize,
    technicalBlockedCount: snapshot.technicalBlockedCount,
    metricDefinitionVersion: snapshot.metricDefinitionVersion ?? null,
    targetProvider: snapshot.targetProvider ?? null,
    targetSnapshotVersion: snapshot.targetSnapshotVersion ?? null,
    numerator: snapshot.numerator ?? null,
    denominator: snapshot.denominator ?? null,
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
  const reasons: string[] = [];
  if (!baseline.metricDefinitionVersion || baseline.metricDefinitionVersion !== retest.metricDefinitionVersion) reasons.push("metric_definition_mismatch");
  if (!baseline.aggregationVersion || baseline.aggregationVersion !== retest.aggregationVersion) reasons.push("aggregation_version_mismatch");
  if (!baseline.targetProvider || !retest.targetProvider || !baseline.targetSnapshotVersion || !retest.targetSnapshotVersion) reasons.push("target_context_missing");
  if (baseline.availability !== "Available" || retest.availability !== "Available") reasons.push("evidence_unavailable");
  if (!baseline.scope || baseline.scope !== retest.scope || baseline.taskId !== retest.taskId) reasons.push("scope_mismatch");
  if (JSON.stringify(baseline.ruleVersions) !== JSON.stringify(retest.ruleVersions)) reasons.push("rule_version_mismatch");
  if (JSON.stringify(baseline.requiredCapabilities) !== JSON.stringify(retest.requiredCapabilities)) reasons.push("capability_mismatch");
  if (baseline.sampleSize === 0 || retest.sampleSize === 0 || baseline.value === null || retest.value === null) reasons.push("no_eligible_data");
  const rate = baseline.metricKey.endsWith("Rate");
  if (rate && (!baseline.denominator || !retest.denominator || baseline.numerator == null || retest.numerator == null)) reasons.push("eligibility_context_missing");
  if (rate && baseline.denominator !== null && retest.denominator !== null && (
    baseline.denominator !== baseline.sampleSize || retest.denominator !== retest.sampleSize
    || (baseline.numerator ?? 0) > baseline.denominator || (retest.numerator ?? 0) > retest.denominator
  )) reasons.push("eligibility_context_mismatch");
  const absoluteDelta = reasons.length ? null : retest.value! - baseline.value!;
  const relativeDeltaPercent = absoluteDelta === null || baseline.value === null || baseline.value === 0
    ? null
    : (absoluteDelta / Math.abs(baseline.value)) * 100;
  return Object.freeze({
    comparisonVersion: RETEST_COMPARISON_VERSION,
    metricKey: baseline.metricKey,
    baseline: context(baseline),
    retest: context(retest),
    comparable: reasons.length === 0,
    incomparableReasons: Object.freeze(reasons),
    absoluteDelta,
    absoluteDeltaUnit: rate ? "percentage_points" : "metric_units",
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
