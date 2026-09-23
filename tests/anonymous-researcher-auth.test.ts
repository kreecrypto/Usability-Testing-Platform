import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AuthSessionError,
  publicSupabaseConfig,
  signInAnonymously,
} from "../src/lib/auth/session.ts";

const config = Object.freeze({
  url: "https://example.supabase.co",
  key: "sb_publishable_test",
});


test("UTP project falls back only to its public publishable key when Vercel public-key env is absent", () => {
  const resolved = publicSupabaseConfig({
    NODE_ENV: "test",
    SUPABASE_URL: "https://qryvrcwbsehrzpersuoc.supabase.co",
  } as NodeJS.ProcessEnv);
  assert.equal(resolved.url, "https://qryvrcwbsehrzpersuoc.supabase.co");
  assert.match(resolved.key, /^sb_publishable_/);

  assert.throws(
    () => publicSupabaseConfig({
      NODE_ENV: "test",
      SUPABASE_URL: "https://other-project.supabase.co",
    } as NodeJS.ProcessEnv),
    (error: unknown) => error instanceof AuthSessionError &&
      error.code === "config_missing" &&
      error.message === "SUPABASE_PUBLISHABLE_KEY missing",
  );
});

test("anonymous researcher auth uses Supabase signup without email or password", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const session = await signInAnonymously({
    config,
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json({
        access_token: "temporary-access-token",
        expires_in: 3600,
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          is_anonymous: true,
        },
      });
    },
  });

  assert.equal(capturedUrl, "https://example.supabase.co/auth/v1/signup");
  assert.equal(capturedInit?.method, "POST");
  const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
  assert.equal("email" in body, false);
  assert.equal("password" in body, false);
  assert.deepEqual(body.data, { utp_mode: "temporary_researcher" });

  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.apikey, "sb_publishable_test");
  assert.equal(session.user.email, null);
  assert.equal(session.accessToken, "temporary-access-token");
});

test("anonymous auth disabled fails closed without falling back to service role", async () => {
  await assert.rejects(
    () => signInAnonymously({
      config,
      fetchImpl: async () => Response.json(
        { message: "Anonymous sign-ins are disabled" },
        { status: 422 },
      ),
    }),
    (error: unknown) => error instanceof AuthSessionError &&
      error.code === "anonymous_auth_unavailable" &&
      error.status === 503,
  );
});

test("guest route stores only the anonymous user JWT in HttpOnly session cookie", () => {
  const route = readFileSync(
    new URL("../src/app/api/auth/guest/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /signInAnonymously/);
  assert.match(route, /accessCookieHeader/);
  assert.match(route, /temporary_researcher/);
  assert.match(route, /cache-control/);
  assert.doesNotMatch(route, /service_role|SUPABASE_SECRET_KEY/);
});
