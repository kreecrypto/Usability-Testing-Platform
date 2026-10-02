import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  accessTokenFromRequest,
  AuthSessionError,
  publicSupabaseConfig,
} from "../src/lib/auth/session.ts";

test("UTP falls back only to its own public publishable key", () => {
  const resolved = publicSupabaseConfig({
    NODE_ENV: "test",
    SUPABASE_URL: "https://qryvrcwbsehrzpersuoc.supabase.co",
  } as NodeJS.ProcessEnv);
  assert.match(resolved.key, /^sb_publishable_/);
  assert.throws(
    () => publicSupabaseConfig({ NODE_ENV: "test", SUPABASE_URL: "https://other-project.supabase.co" } as NodeJS.ProcessEnv),
    (error: unknown) => error instanceof AuthSessionError && error.code === "config_missing",
  );
});

test("researcher boundary rejects anonymous JWTs before protected API access", () => {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const anonymous = Buffer.from(JSON.stringify({ sub: "guest", is_anonymous: true })).toString("base64url");
  const token = `${header}.${anonymous}.unsigned`;
  assert.equal(accessTokenFromRequest(new Request("https://utp.test", {
    headers: { authorization: `Bearer ${token}` },
  })), null);
  assert.equal(existsSync(new URL("../src/app/api/auth/guest/route.ts", import.meta.url)), false);
});
