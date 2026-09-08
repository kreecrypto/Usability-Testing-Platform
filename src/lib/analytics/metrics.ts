export interface TaskMetricInput {
  started: number;
  successDirect: number;
  successIndirect: number;
  failed: number;
  giveUp: number;
  technicalBlocked: number;
}

export type PercentageMetric = number | null;

export function percentage(
  numerator: number,
  denominator: number,
): PercentageMetric {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new RangeError("metric inputs must be finite numbers");
  }
  if (numerator < 0 || denominator < 0) {
    throw new RangeError("metric inputs must be non-negative");
  }
  if (denominator === 0) return null;
  return (numerator / denominator) * 100;
}

export function eligibleTaskSessions(
  input: Pick<TaskMetricInput, "started" | "technicalBlocked">,
): number {
  if (!Number.isFinite(input.started) || !Number.isFinite(input.technicalBlocked)) {
    throw new RangeError("task counts must be finite numbers");
  }
  if (input.started < 0 || input.technicalBlocked < 0) {
    throw new RangeError("task counts must be non-negative");
  }
  if (input.technicalBlocked > input.started) {
    throw new RangeError("technicalBlocked cannot exceed started");
  }
  return input.started - input.technicalBlocked;
}

export function completionRate(input: TaskMetricInput): PercentageMetric {
  return percentage(
    input.successDirect + input.successIndirect,
    eligibleTaskSessions(input),
  );
}

export function giveUpRate(input: TaskMetricInput): PercentageMetric {
  return percentage(input.giveUp, eligibleTaskSessions(input));
}

export function failureRate(input: TaskMetricInput): PercentageMetric {
  return percentage(input.failed, eligibleTaskSessions(input));
}

export function misclickRate(
  misclicks: number,
  eligiblePointerInteractions: number,
): PercentageMetric {
  return percentage(misclicks, eligiblePointerInteractions);
}

export function dropOffRate(
  enteredStep: number,
  reachedNextStep: number,
): PercentageMetric {
  if (!Number.isFinite(enteredStep) || !Number.isFinite(reachedNextStep)) {
    throw new RangeError("funnel counts must be finite numbers");
  }
  if (enteredStep < 0 || reachedNextStep < 0) {
    throw new RangeError("funnel counts must be non-negative");
  }
  if (enteredStep === 0) return null;
  if (reachedNextStep > enteredStep) {
    throw new RangeError("reachedNextStep cannot exceed enteredStep");
  }
  return percentage(enteredStep - reachedNextStep, enteredStep);
}

export function durationMs(
  startOccurredAt: string,
  terminalOccurredAt: string,
): number {
  const start = Date.parse(startOccurredAt);
  const end = Date.parse(terminalOccurredAt);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new RangeError("timestamps must be valid RFC 3339/ISO-8601 values");
  }
  if (end < start) {
    throw new RangeError("terminalOccurredAt cannot be earlier than startOccurredAt");
  }

  return end - start;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  if (p < 0 || p > 1) throw new RangeError("p must be between 0 and 1");

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function median(values: number[]): number | null {
  return percentile(values, 0.5);
}

export function p75(values: number[]): number | null {
  return percentile(values, 0.75);
}

export function p90(values: number[]): number | null {
  return percentile(values, 0.9);
}
