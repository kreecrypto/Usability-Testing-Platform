import { createHash, randomBytes } from "node:crypto";
import { accessCookieHeader, AuthSessionError, clearAccessCookieHeader, cookieMap, publicSupabaseConfig, serializeCookie, type PasswordSession, type PublicSupabaseConfig } from "./session.ts";
import { safeReturnPath } from "./redirect.ts";

const REFRESH_COOKIE = "utp_refresh_token";
const FLOW_COOKIE = "utp_auth_flow";
type Options = { config?: PublicSupabaseConfig; fetchImpl?: typeof fetch };
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" && (!origin || origin === new URL(request.url).origin);
}
export function authJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}
export function authError(error: unknown): Response {
  return error instanceof AuthSessionError ? authJson({ error: error.code }, error.status) : authJson({ error: "auth_unavailable" }, 503);
}
export function setSessionCookies(response: Response, session: PasswordSession, secure: boolean): void {
  response.headers.append("set-cookie", accessCookieHeader(session.accessToken, session.expiresIn, secure));
  response.headers.append("set-cookie", serializeCookie(REFRESH_COOKIE, session.refreshToken ?? "", { secure, ...(session.refreshToken ? {} : { maxAge: 0 }) }));
}
export function clearSessionCookies(response: Response, secure: boolean): void {
  response.headers.append("set-cookie", clearAccessCookieHeader(secure));
  response.headers.append("set-cookie", serializeCookie(REFRESH_COOKIE, "", { secure, maxAge: 0 }));
}
export function refreshFromRequest(request: Request): string | null {
  return cookieMap(request.headers.get("cookie")).get(REFRESH_COOKIE) || null;
}
function parseSession(payload: Record<string, unknown>): PasswordSession {
  const user = payload.user as Record<string, unknown> | undefined;
  if (typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string" ||
      typeof payload.expires_in !== "number" || payload.expires_in <= 0 || typeof user?.id !== "string" || user.is_anonymous === true) {
    throw new AuthSessionError("invalid_session", 401);
  }
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresIn: payload.expires_in,
    user: { id: user.id, email: typeof user.email === "string" ? user.email : null } };
}
export async function authRequest(path: string, init: RequestInit, options: Options = {}): Promise<Record<string, unknown>> {
  const config = options.config ?? publicSupabaseConfig();
  const response = await (options.fetchImpl ?? fetch)(`${config.url}/auth/v1/${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { apikey: config.key, "content-type": "application/json", ...init.headers } });
  if (response.status === 429) throw new AuthSessionError("rate_limited", 429);
  if (response.status === 401 || response.status === 403) throw new AuthSessionError("invalid_session", 401);
  if (!response.ok) {
    if (response.status >= 500) throw new AuthSessionError("auth_unavailable", 503);
    throw new AuthSessionError(path === "user" ? "weak_password" : "invalid_session", 400);
  }
  return response.json().catch(() => ({}));
}
export async function refreshSession(token: string, options: Options = {}): Promise<PasswordSession> {
  return parseSession(await authRequest("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: token }) }, options));
}
export function createAuthFlow(kind: "signup" | "recovery", next: unknown, secure: boolean) {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const cookie = serializeCookie(FLOW_COOKIE, JSON.stringify({ verifier, kind, next: safeReturnPath(next), createdAt: Date.now() }), { secure, maxAge: 3600 });
  return { challenge, cookie };
}
export function readAuthFlow(request: Request): { verifier: string; kind: "signup" | "recovery"; next: string } | null {
  try {
    const value = JSON.parse(cookieMap(request.headers.get("cookie")).get(FLOW_COOKIE) ?? "null");
    if (!value || !/^[A-Za-z0-9_-]{64}$/.test(value.verifier) || !["signup", "recovery"].includes(value.kind) ||
      !Number.isFinite(value.createdAt) || Date.now() - value.createdAt > 3600000 || value.createdAt > Date.now() + 60000) return null;
    return { verifier: value.verifier, kind: value.kind, next: safeReturnPath(value.next) };
  } catch { return null; }
}
export function clearFlowCookie(secure: boolean): string { return serializeCookie(FLOW_COOKIE, "", { secure, maxAge: 0 }); }
export async function exchangeAuthCode(code: string, verifier: string, options: Options = {}): Promise<PasswordSession> {
  return parseSession(await authRequest("token?grant_type=pkce", { method: "POST", body: JSON.stringify({ auth_code: code, code_verifier: verifier }) }, options));
}
