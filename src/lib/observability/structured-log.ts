export type LogLevel = "info" | "warn" | "error";

export type PipelineLogContext = {
  requestId?: string;
  sessionId?: string;
  testVersionId?: string;
  eventId?: string;
  operation?: string;
};

function sanitize(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 128).replace(/[\r\n\t]/g, "_");
}

export function writePipelineLog(
  level: LogLevel,
  message: string,
  context: PipelineLogContext = {},
  error?: unknown,
): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message: sanitize(message) ?? "pipeline_log",
    requestId: sanitize(context.requestId),
    sessionId: sanitize(context.sessionId),
    testVersionId: sanitize(context.testVersionId),
    eventId: sanitize(context.eventId),
    operation: sanitize(context.operation),
    errorType: error instanceof Error ? sanitize(error.name) : error ? "unknown" : undefined,
  };

  // Intentionally omit stack traces, request bodies, tokens and provider/database secrets.
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
