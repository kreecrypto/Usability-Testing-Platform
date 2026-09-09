export function belongsToTest(
  context: { testId: string; testVersionId: string },
  test: { testId: string; testVersionId: string },
): boolean {
  return context.testId === test.testId && context.testVersionId === test.testVersionId;
}

export function remainingTaskTime(startedAt: string | null, seconds: number, now: number): number | null {
  if (!startedAt || !Number.isFinite(seconds) || seconds <= 0) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  return Math.max(0, start + seconds * 1000 - now);
}
