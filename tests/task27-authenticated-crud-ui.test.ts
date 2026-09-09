import assert from "node:assert/strict";
import test from "node:test";

import {
  accessCookieHeader,
  accessTokenFromRequest,
  authCookieName,
  AuthSessionError,
  clearAccessCookieHeader,
  signInWithPassword,
  validateAccessToken,
  type PublicSupabaseConfig,
} from "../src/lib/auth/session.ts";

const config: PublicSupabaseConfig = Object.freeze({
  url: "https://example.supabase.co",
  key: "sb_publishable_test",
});

test("authenticated browser CRUD uses HttpOnly session cookie while bearer API clients still work", () => {
  const cookieRequest = new Request("https://app.example/api/projects", {
    headers: { cookie: `${authCookieName()}=${encodeURIComponent("cookie-user-jwt")}` },
  });
  assert.equal(accessTokenFromRequest(cookieRequest), "cookie-user-jwt");

  const bearerRequest = new Request("https://app.example/api/projects", {
    headers: {
      cookie: `${authCookieName()}=${encodeURIComponent("cookie-user-jwt")}`,
      authorization: "Bearer explicit-api-jwt",
    },
  });
  assert.equal(accessTokenFromRequest(bearerRequest), "explicit-api-jwt");
});

test("session cookie is HttpOnly SameSite Lax and secure on HTTPS", () => {
  const cookie = accessCookieHeader("user-jwt", 3600, true);
  assert.match(cookie, /^utp_access_token=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=3585/);

  const cleared = clearAccessCookieHeader(true);
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
});

test("password sign-in uses current Supabase token endpoint and never sends a service secret", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({
      access_token: "user-access-token",
      expires_in: 3600,
      refresh_token: "server-response-refresh-token",
      user: { id: "10000000-0000-4000-8000-000000000001", email: "user@example.com" },
    });
  };

  const session = await signInWithPassword(
    { email: " user@example.com ", password: "secret-password" },
    { config, fetchImpl },
  );
  assert.equal(session.accessToken, "user-access-token");
  assert.equal(session.user.email, "user@example.com");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.supabase.co/auth/v1/token?grant_type=password");
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.apikey, "sb_publishable_test");
  assert.equal(JSON.stringify(calls[0].init).includes("service_role"), false);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    email: "user@example.com",
    password: "secret-password",
  });
});

test("invalid password response is sanitized to invalid_credentials", async () => {
  await assert.rejects(
    () => signInWithPassword(
      { email: "user@example.com", password: "bad" },
      {
        config,
        fetchImpl: async () => Response.json(
          { msg: "provider detail should not reach UI" },
          { status: 400 },
        ),
      },
    ),
    (error: unknown) =>
      error instanceof AuthSessionError &&
      error.code === "invalid_credentials" &&
      !error.message.includes("provider detail"),
  );
});

test("server verifies cookie JWT against Supabase Auth user endpoint before reporting a session", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const user = await validateAccessToken("user-jwt", {
    config,
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return Response.json({ id: "10000000-0000-4000-8000-000000000001", email: "user@example.com" });
    },
  });
  assert.equal(user.id, "10000000-0000-4000-8000-000000000001");
  assert.equal(calls[0].url, "https://example.supabase.co/auth/v1/user");
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer user-jwt");
  assert.equal(headers.apikey, "sb_publishable_test");
});
