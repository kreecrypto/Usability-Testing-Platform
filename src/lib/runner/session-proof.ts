import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOMAIN = "utp-runner-session-v1";

export type RunnerSessionProofClaims = Readonly<{
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  exp: number;
}>;

function signature(payload: string, key: string): Buffer {
  return createHmac("sha256", key).update(`${DOMAIN}.${payload}`).digest();
}

function validClaims(value: unknown): value is RunnerSessionProofClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const claims = value as Record<string, unknown>;
  return ["sessionId", "participantId", "testId", "testVersionId"].every(
    (key) => typeof claims[key] === "string" && UUID_PATTERN.test(claims[key] as string),
  ) && typeof claims.exp === "number" && Number.isSafeInteger(claims.exp);
}

export function mintRunnerSessionProof(options: {
  signingKey: string;
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  expiresAt: Date;
}): string {
  if (!options.signingKey.trim()) throw new Error("runner_signing_key_required");
  const claims: RunnerSessionProofClaims = Object.freeze({
    sessionId: options.sessionId,
    participantId: options.participantId,
    testId: options.testId,
    testVersionId: options.testVersionId,
    exp: Math.floor(options.expiresAt.getTime() / 1000),
  });
  if (!validClaims(claims)) throw new Error("invalid_runner_session_claims");
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${signature(payload, options.signingKey).toString("base64url")}`;
}

export function verifyRunnerSessionProof(options: {
  proof: string;
  signingKey: string;
  now?: Date;
}): RunnerSessionProofClaims | null {
  if (!options.signingKey.trim()) return null;
  const [payload, encodedSignature, extra] = options.proof.split(".");
  if (!payload || !encodedSignature || extra !== undefined) return null;
  let actual: Buffer;
  let parsed: unknown;
  try {
    actual = Buffer.from(encodedSignature, "base64url");
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const expected = signature(payload, options.signingKey);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !validClaims(parsed)) return null;
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  return parsed.exp > now ? parsed : null;
}
