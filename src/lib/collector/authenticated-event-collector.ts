import type { ConsumeIngestionToken } from "./session-ingestion-token.ts";
import { bearerToken, verifySessionIngestionToken } from "./session-ingestion-token.ts";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function eventContexts(body: unknown): Array<{ sessionId: unknown; testVersionId: unknown }> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const events = Array.isArray(record.events) ? record.events : [record];
  return events.map((event) => {
    const item = event && typeof event === "object" && !Array.isArray(event) ? event as Record<string, unknown> : {};
    return { sessionId: item.sessionId, testVersionId: item.testVersionId };
  });
}

export function withSessionIngestionAuth(options: {
  handler: (request: Request) => Promise<Response>;
  secret: string;
  consume: ConsumeIngestionToken;
  now?: () => Date;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return options.handler(request);

    const token = bearerToken(request);
    if (!token) return jsonResponse({ error: "unauthorized" }, 401);
    const claims = verifySessionIngestionToken({ token, secret: options.secret, now: options.now?.() });
    if (!claims) return jsonResponse({ error: "unauthorized" }, 401);

    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      return options.handler(request);
    }

    const contexts = eventContexts(body);
    if (!contexts || contexts.length === 0 || contexts.some((context) => context.sessionId !== claims.sessionId || context.testVersionId !== claims.testVersionId)) {
      return jsonResponse({ error: "token_context_mismatch" }, 403);
    }

    let consumed: Awaited<ReturnType<ConsumeIngestionToken>>;
    try {
      consumed = await options.consume(claims);
    } catch {
      return jsonResponse({ error: "ingestion_unavailable" }, 503);
    }
    if (consumed === "replayed") return jsonResponse({ error: "token_replayed" }, 409);
    if (consumed === "rate_limited") return jsonResponse({ error: "rate_limited" }, 429);

    return options.handler(request);
  };
}
