/** Client-only request classification; no changes to public API responses. */
export class RunnerRequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}

export async function readRunnerJson<T>(response: Response): Promise<T> {
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new RunnerRequestError(response.status, "invalid_response"); }
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "request_failed";
    throw new RunnerRequestError(response.status, code);
  }
  return body as T;
}

export function invalidParticipantLink(error: unknown): boolean {
  return error instanceof RunnerRequestError && (
    error.status === 404 || error.status === 410 ||
    (error.status === 400 && error.code === "invalid_version_id")
  );
}
