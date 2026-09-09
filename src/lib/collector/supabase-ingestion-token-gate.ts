import type { ConsumeIngestionToken, SessionIngestionTokenClaims } from "./session-ingestion-token.ts";

export function createSupabaseIngestionTokenConsumer(options: {
  supabaseUrl: string;
  secretKey: string;
  rateLimitPerMinute: number;
  fetchImpl?: typeof fetch;
}): ConsumeIngestionToken {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!Number.isSafeInteger(options.rateLimitPerMinute) || options.rateLimitPerMinute <= 0) {
    throw new Error("invalid_ingestion_rate_limit");
  }

  return async (claims: SessionIngestionTokenClaims) => {
    const response = await fetchImpl(`${options.supabaseUrl}/rest/v1/rpc/consume_ingestion_token`, {
      method: "POST",
      headers: {
        apikey: options.secretKey,
        authorization: `Bearer ${options.secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_token_id: claims.jti,
        p_session_id: claims.sessionId,
        p_test_version_id: claims.testVersionId,
        p_expires_at: new Date(claims.exp * 1000).toISOString(),
        p_rate_limit_per_minute: options.rateLimitPerMinute,
      }),
    });

    if (!response.ok) throw new Error("ingestion_token_gate_unavailable");
    const result = (await response.json()) as unknown;
    if (result === "accepted" || result === "replayed" || result === "rate_limited") return result;
    if (result === "expired") return "replayed";
    throw new Error("invalid_ingestion_token_gate_response");
  };
}
