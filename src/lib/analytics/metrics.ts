export interface TaskMetricInput {
  started: number;
  successDirect: number;
  successIndirect: number;
  failed: number;
  giveUp: number;
  technicalBlocked: number;
}

export function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function eligibleTaskSessions(input: Pick<TaskMetricInput, "started" | "technicalBlocked">): number {
  return Math.max(input.started - input.technicalBlocked, 0);
}

export function completionRate(input: TaskMetricInput): number {
  return percentage(
    input.successDirect + input.successIndirect,
    eligibleTaskSessions(input),
  );
}

export function giveUpRate(input: TaskMetricInput): number {
  return percentage(input.giveUp, eligibleTaskSessions(input));
}

export function failureRate(input: TaskMetricInput): number {
  return percentage(input.failed, eligibleTaskSessions(input));
}

export function misclickRate(misclicks: number, eligiblePointerInteractions: number): number {
  return percentage(misclicks, eligiblePointerInteractions);
}

export function dropOffRate(enteredStep: number, reachedNextStep: number): number {
  if (enteredStep <= 0) return 0;
  return percentage(Math.max(enteredStep - reachedNextStep, 0), enteredStep);
}

export function durationMs(startOccurredAt: string, terminalOccurredAt: string): number {
  const start = Date.parse(startOccurredAt);
  const end = Date.parse(terminalOccurredAt);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new RangeError("timestamps must be valid RFC 3339/ISO-8601 values");
  }

  return Math.max(end - start, 0);
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
