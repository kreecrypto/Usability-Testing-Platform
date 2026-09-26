import test from "node:test";
import assert from "node:assert/strict";
import { presentMetric } from "../src/lib/analytics/presentation.ts";
import type { MetricObservation } from "../src/lib/analytics/observations.ts";

const metric = (availability: MetricObservation["availability"], value: number | null, denominator: number | null): MetricObservation => ({
  metricKey: "completionRate", metricDefinitionVersion: "analytics-v1", scope: "overall", taskId: null,
  value, numerator: 0, denominator, sampleSize: denominator ?? 0, technicalBlockedCount: 1,
  availability, requiredCapabilities: [], testVersionId: "version", targetProvider: "first_party_web",
  targetSnapshotVersion: 1, aggregationVersion: "aggregation-v1", ruleVersions: [], evidenceRefs: ["raw-1"],
});

test("supported zero is shown only with an available denominator", () => {
  const value = presentMetric(metric("Available", 0, 2), (n) => `${n}%`);
  assert.equal(value.value, "0%");
  assert.match(value.detail, /0\/2/);
  assert.deepEqual(value.evidenceRefs, ["raw-1"]);
  assert.match(value.provenance, /testVersionId version/);
  assert.match(value.provenance, /aggregation-v1/);
});

test("partial, unsupported and no-data never display numeric zero", () => {
  for (const state of ["Partial", "Unsupported", "No Data"] as const) {
    const presented = presentMetric(metric(state, 0, 0), (n) => `${n}%`);
    assert.equal(presented.availability, state);
    assert.notEqual(presented.value, "0%");
  }
  assert.equal(presentMetric(undefined, (n) => `${n}%`).availability, "No Data");
  const unsupportedEvidence = presentMetric(metric("Available", 0, 0), (n) => `${n}%`);
  assert.equal(unsupportedEvidence.availability, "Partial");
  assert.notEqual(unsupportedEvidence.value, "0%");
});
