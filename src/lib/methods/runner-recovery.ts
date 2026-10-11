export type TreeAttempt = { promptId: string; path: string[]; trace: string[]; selectedNodeId: string; durationMs: number };
export type TreeSubmission = { attempts: TreeAttempt[] };

// Retry the first selected final answer, including its original elapsed time.
export function prepareTreeSubmission(pending: TreeSubmission | null, attempts: TreeAttempt[], final: TreeAttempt): TreeSubmission {
  return pending ?? structuredClone({ attempts: [...attempts, final] });
}

export function scaleAnswer(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}
