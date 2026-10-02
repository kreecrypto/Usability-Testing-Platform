import type { MetricObservation } from "../analytics/observations.ts";
import type { MetricSnapshot } from "./model.ts";

export function metricSnapshotFromObservation(observation: MetricObservation): MetricSnapshot {
  return Object.freeze({
    metricKey: observation.metricKey,
    value: observation.value,
    sampleSize: observation.sampleSize,
    technicalBlockedCount: observation.technicalBlockedCount,
    testVersionId: observation.testVersionId,
    aggregationVersion: observation.aggregationVersion,
    ruleVersions: observation.ruleVersions,
    sourceEventIds: observation.evidenceRefs,
    metricDefinitionVersion: observation.metricDefinitionVersion,
    targetProvider: observation.targetProvider,
    targetSnapshotVersion: observation.targetSnapshotVersion,
    requiredCapabilities: observation.requiredCapabilities,
    availability: observation.availability,
    scope: observation.scope,
    taskId: observation.taskId,
    numerator: observation.numerator,
    denominator: observation.denominator,
  });
}
