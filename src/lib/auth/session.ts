const ACCESS_COOKIE = "utp_access_token";

export type PublicSupabaseConfig = Readonly<{
  url: string;
  key: string;
}>;

export type AuthenticatedUser = Readonly<{
  id: string;
  email: string | null;
}>;

export type PasswordSession = Readonly<{
  accessToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}>;

export class AuthSessionError extends Error {
  code: "config_missing" | "invalid_credentials" | "invalid_session" | "auth_unavailable";
  status: number;

  constructor(
    code: AuthSessionError["code"],
    status: number,
    message = code,
  ) {
    super(message);
    this.name = "AuthSessionError";
    this.code = code;
    this.status = status;
  }
}

function required(value: string | undefined, field: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new AuthSessionError("config_missing", 503, `${field} missing`);
  return trimmed;
}

export function publicSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): PublicSupabaseConfig {
  const url = required(env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL, "SUPABASE_URL");
  const key = required(
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      env.SUPABASE_ANON_KEY,
    "SUPABASE_PUBLISHABLE_KEY",
  );
  return Object.freeze({ url: url.replace(/\/$/, ""), key });
}

function cookieMap(header: string | null): Map<string, string> {
  const output = new Map<string, string>();
  if (!header) return output;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 1) continue;
    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (!name) continue;
    try {
      output.set(name, decodeURIComponent(value));
    } catch {
      // Ignore malformed cookie values rather than trusting undecodable input.
    }
  }
  return output;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
}

export function accessTokenFromRequest(request: Request): string | null {
  return bearerToken(request) ?? cookieMap(request.headers.get("cookie")).get(ACCESS_COOKIE) ?? null;
}

export function authCookieName(): string {
  return ACCESS_COOKIE;
}

function serializeCookie(
  name: string,
  value: string,
  options: Readonly<{ maxAge?: number; secure?: boolean; expires?: Date }> = {},
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.secure) parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

export function accessCookieHeader(
  accessToken: string,
  expiresIn: number,
  secure: boolean,
): string {
  if (!accessToken.trim()) throw new AuthSessionError("invalid_session", 401);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new AuthSessionError("invalid_session", 401);
  }
  return serializeCookie(ACCESS_COOKIE, accessToken, {
    // Keep a small safety margin so the browser stops sending an expired JWT.
    maxAge: Math.max(1, Math.floor(expiresIn) - 15),
    secure,
  });
}

export function clearAccessCookieHeader(secure: boolean): string {
  return serializeCookie(ACCESS_COOKIE, "", {
    maxAge: 0,
    expires: new Date(0),
    secure,
  });
}

function normalizedEmail(value: unknown): string {
  if (typeof value !== "string") throw new AuthSessionError("invalid_credentials", 401);
  const email = value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AuthSessionError("invalid_credentials", 401);
  return email;
}

function normalizedPassword(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AuthSessionError("invalid_credentials", 401);
  }
  return value;
}

export async function signInWithPassword(
  credentials: Readonly<{ email: unknown; password: unknown }>,
  options: Readonly<{
    config?: PublicSupabaseConfig;
    fetchImpl?: typeof fetch;
  }> = {},
): Promise<PasswordSession> {
  const config = options.config ?? publicSupabaseConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.key,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      email: normalizedEmail(credentials.email),
      password: normalizedPassword(credentials.password),
    }),
    cache: "no-store",
  });

  if (response.status === 400 || response.status === 401 || response.status === 422) {
    throw new AuthSessionError("invalid_credentials", 401);
  }
  if (!response.ok) throw new AuthSessionError("auth_unavailable", 503);

  const payload = (await response.json()) as Record<string, unknown>;
  const user = payload.user as Record<string, unknown> | undefined;
  const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : Number.NaN;
  const userId = typeof user?.id === "string" ? user.id.trim() : "";
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0 || !userId) {
    throw new AuthSessionError("invalid_session", 503);
  }

  return Object.freeze({
    accessToken,
    expiresIn,
    user: Object.freeze({
      id: userId,
      email: typeof user?.email === "string" ? user.email : null,
    }),
  });
}

export async function validateAccessToken(
  accessToken: string,
  options: Readonly<{
    config?: PublicSupabaseConfig;
    fetchImpl?: typeof fetch;
  }> = {},
): Promise<AuthenticatedUser> {
  const token = accessToken.trim();
  if (!token) throw new AuthSessionError("invalid_session", 401);
  const config = options.config ?? publicSupabaseConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) {
    throw new AuthSessionError("invalid_session", 401);
  }
  if (!response.ok) throw new AuthSessionError("auth_unavailable", 503);
  const payload = (await response.json()) as Record<string, unknown>;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) throw new AuthSessionError("invalid_session", 401);
  return Object.freeze({
    id,
    email: typeof payload.email === "string" ? payload.email : null,
  });
}
