export interface TaskMetricInput {
  started: number;
  successDirect: number;
  successIndirect: number;
  giveUp: number;
}

export function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function completionRate(input: TaskMetricInput): number {
  return percentage(input.successDirect + input.successIndirect, input.started);
}

export function giveUpRate(input: TaskMetricInput): number {
  return percentage(input.giveUp, input.started);
}

export function misclickRate(misclicks: number, eligibleInteractions: number): number {
  return percentage(misclicks, eligibleInteractions);
}

export function dropOffRate(enteredStep: number, reachedNextStep: number): number {
  if (enteredStep <= 0) return 0;
  return percentage(Math.max(enteredStep - reachedNextStep, 0), enteredStep);
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
