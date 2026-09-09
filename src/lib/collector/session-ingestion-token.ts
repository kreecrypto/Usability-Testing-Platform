import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SessionIngestionTokenClaims {
  sessionId: string;
  testVersionId: string;
  exp: number;
  jti: string;
}

export type ConsumeIngestionToken = (claims: SessionIngestionTokenClaims) => Promise<"accepted" | "replayed" | "rate_limited">;

function sign(encodedPayload: string, signingKey: string): Buffer {
  return createHmac("sha256", signingKey).update(encodedPayload).digest();
}

function isClaims(value: unknown): value is SessionIngestionTokenClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const claims = value as Record<string, unknown>;
  return typeof claims.sessionId === "string" && UUID_PATTERN.test(claims.sessionId) && typeof claims.testVersionId === "string" && UUID_PATTERN.test(claims.testVersionId) && typeof claims.exp === "number" && Number.isSafeInteger(claims.exp) && typeof claims.jti === "string" && claims.jti.length >= 16;
}

export function mintSessionIngestionToken(options: { signingKey: string; sessionId: string; testVersionId: string; expiresAt: Date; tokenId: string }): string {
  if (!options.signingKey) throw new Error("token_signing_key_required");
  const claims: SessionIngestionTokenClaims = { sessionId: options.sessionId, testVersionId: options.testVersionId, exp: Math.floor(options.expiresAt.getTime() / 1000), jti: options.tokenId };
  if (!isClaims(claims)) throw new Error("invalid_token_claims");
  const encodedPayload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, options.signingKey).toString("base64url")}`;
}

export function verifySessionIngestionToken(options: { token: string; signingKey: string; now?: Date }): SessionIngestionTokenClaims | null {
  if (!options.signingKey) return null;
  const [encodedPayload, encodedSignature, extra] = options.token.split(".");
  if (!encodedPayload || !encodedSignature || extra !== undefined) return null;
  let suppliedSignature: Buffer;
  let payload: unknown;
  try {
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch { return null; }
  const expectedSignature = sign(encodedPayload, options.signingKey);
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature) || !isClaims(payload)) return null;
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  return payload.exp > nowSeconds ? payload : null;
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}
