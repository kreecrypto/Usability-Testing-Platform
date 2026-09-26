import type { MetricObservation } from "./observations.ts";
import type { ResultsModel } from "./results.ts";

export type MetricDisplay = Readonly<{
  availability: "Available" | "Partial" | "Unsupported" | "No Data";
  value: string;
  detail: string;
  provenance: string;
  evidenceRefs: readonly string[];
}>;

const labels = {
  Available: "มีข้อมูล",
  Partial: "ข้อมูลบางส่วน",
  Unsupported: "ไม่รองรับ",
  "No Data": "ยังไม่มีข้อมูล",
} as const;

export function capabilityAvailability(results: ResultsModel, ...capabilities: string[]): MetricDisplay["availability"] {
  const target = results.context?.target;
  if (!target?.provider || target.snapshotVersion === null) return "Partial";
  const states = capabilities.map((key) => target.capabilities[key]);
  if (states.includes("Unsupported")) return "Unsupported";
  if (states.some((state) => !state || state === "Partial")) return "Partial";
  if (states.includes("No Data")) return "No Data";
  return "Available";
}

export function presentMetric(
  observation: MetricObservation | undefined,
  formatter: (value: number) => string,
): MetricDisplay {
  if (!observation) return Object.freeze({ availability: "No Data", value: labels["No Data"], detail: "ไม่มี metric observation", provenance: "ไม่มี trace", evidenceRefs: [] });
  const hasEvidence = observation.evidenceRefs.length > 0
    && (observation.denominator === null ? observation.sampleSize > 0 : observation.denominator > 0);
  const availability = observation.availability === "Available" && !hasEvidence ? "Partial" : observation.availability;
  const canShowNumber = availability === "Available" && observation.value !== null;
  const sample = `n=${observation.sampleSize}`;
  const fraction = observation.denominator === null ? "" : ` · ${observation.numerator ?? "–"}/${observation.denominator}`;
  const version = observation.targetProvider && observation.targetSnapshotVersion !== null
    ? ` · ${observation.targetProvider} v${observation.targetSnapshotVersion}` : " · target context ไม่ครบ";
  const provenance = [
    `testVersionId ${observation.testVersionId}`,
    `metric ${observation.metricDefinitionVersion}`,
    `aggregation ${observation.aggregationVersion ?? "ไม่ทราบ"}`,
    `rules ${observation.ruleVersions.join(", ") || "ไม่มี"}`,
  ].join(" · ");
  return Object.freeze({
    availability,
    value: canShowNumber ? formatter(observation.value!) : labels[availability],
    detail: `${sample}${fraction} · technical ${observation.technicalBlockedCount}${version}`,
    provenance,
    evidenceRefs: observation.evidenceRefs,
  });
}

export function observationFor(results: ResultsModel, metricKey: string, taskId: string | null = null): MetricObservation | undefined {
  return results.metrics.find((item) => item.metricKey === metricKey && item.taskId === taskId);
}
