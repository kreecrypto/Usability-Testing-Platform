import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { safeReturnPath } from "../src/lib/auth/redirect.ts";
import { createAuthenticatedFetch } from "../src/lib/auth/client.ts";
import { createAuthFlow, readAuthFlow, refreshSession, exchangeAuthCode, setSessionCookies, clearSessionCookies, sameOrigin } from "../src/lib/auth/lifecycle.ts";
import { AuthSessionError } from "../src/lib/auth/session.ts";

const config = { url: "https://example.supabase.co", key: "sb_publishable_test" };
const tokens = { access_token: "access", refresh_token: "refresh", expires_in: 3600, user: { id: "researcher", email: "researcher@example.test" } };

test("return destinations keep study context and reject external, auth and malformed URLs", () => {
  assert.equal(safeReturnPath("/tests/study?versionId=v1"), "/tests/study?versionId=v1");
  assert.equal(safeReturnPath("/builder/test/methods?tab=survey#q1"), "/builder/test/methods?tab=survey#q1");
  for (const input of ["https://evil.test", "//evil.test", "/\\evil.test", "/login?next=/login", "/api/auth/logout", "/projects/../../auth/callback", "javascript:alert(1)", "/projects\nfoo", null]) assert.equal(safeReturnPath(input), "/projects");
});
test("PKCE callback binds to a time-limited browser verifier and safe destination", () => {
  const flow = createAuthFlow("signup", "/results/version", true);
  const request = new Request("https://utp.test/auth/callback", { headers: { cookie: flow.cookie.split(";")[0] } });
  const saved = readAuthFlow(request)!;
  assert.equal(saved.next, "/results/version");
  assert.equal(flow.challenge, createHash("sha256").update(saved.verifier).digest("base64url"));
  assert.match(flow.cookie, /HttpOnly; SameSite=Lax; Secure; Max-Age=3600/);
  assert.equal(readAuthFlow(new Request(request.url)), null);
  const stale = { ...saved, createdAt: Date.now() - 3600001 };
  assert.equal(readAuthFlow(new Request(request.url, { headers: { cookie: `utp_auth_flow=${encodeURIComponent(JSON.stringify(stale))}` } })), null);
});
test("refresh rotates a token pair without ever using an elevated key", async () => {
  let sent: Record<string, unknown> = {};
  const session = await refreshSession("old-refresh", { config, fetchImpl: async (input, init) => {
    assert.equal(String(input), `${config.url}/auth/v1/token?grant_type=refresh_token`);
    assert.equal((init?.headers as Record<string, string>).apikey, config.key);
    sent = JSON.parse(String(init?.body)); return Response.json(tokens);
  } });
  assert.deepEqual(sent, { refresh_token: "old-refresh" });
  const response = new Response(); setSessionCookies(response, session, true);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.every(value => value.includes("HttpOnly") && value.includes("Secure") && value.includes("SameSite=Lax")));
  assert.match(cookies[1], /^utp_refresh_token=refresh;/);
  const cleared = new Response(); clearSessionCookies(cleared, true);
  assert.equal(cleared.headers.getSetCookie().filter(value => value.includes("Max-Age=0")).length, 2);
});
test("PKCE code exchange sends the bound verifier and rejects anonymous sessions", async () => {
  const fetchImpl: typeof fetch = async (input, init) => {
    assert.equal(String(input), `${config.url}/auth/v1/token?grant_type=pkce`);
    assert.deepEqual(JSON.parse(String(init?.body)), { auth_code: "code", code_verifier: "verifier" });
    return Response.json({ ...tokens, user: { ...tokens.user, is_anonymous: true } });
  };
  await assert.rejects(exchangeAuthCode("code", "verifier", { config, fetchImpl }), (e) => e instanceof AuthSessionError && e.code === "invalid_session");
});
test("simultaneous expired requests share one refresh then retry each original once", async () => {
  let valid = false; let refreshes = 0; let expired = 0;
  const attempts = new Map<string, number>();
  const fetchImpl: typeof fetch = async (input) => {
    const path = String(input);
    if (path === "/api/auth/session") return Response.json({}, { status: valid ? 200 : 401 });
    if (path === "/api/auth/refresh") { refreshes++; await new Promise(resolve => setTimeout(resolve, 10)); valid = true; return Response.json({ user: tokens.user }); }
    attempts.set(path, (attempts.get(path) ?? 0) + 1);
    return Response.json({}, { status: valid ? 200 : 401 });
  };
  const call = createAuthenticatedFetch(fetchImpl, () => expired++);
  const responses = await Promise.all([call("/api/tests/a"), call("/api/tests/b")]);
  assert.ok(responses.every(response => response.ok)); assert.equal(refreshes, 1); assert.equal(expired, 0);
  assert.deepEqual([...attempts.values()], [2, 2]);
});
test("failed refresh leaves the page in place and does not retry a write", async () => {
  let writes = 0; let expired = 0;
  const call = createAuthenticatedFetch(async (input) => { if (String(input) === "/api/tests/a") writes++; return Response.json({}, { status: 401 }); }, () => expired++);
  const result = await call("/api/tests/a", { method: "POST", body: '{"draft":"keep me"}' });
  assert.equal(result.status, 401); assert.equal(writes, 1); assert.equal(expired, 1);
});
test("temporary refresh failure stays recoverable and forbidden requests never trigger refresh", async () => {
  let calls = 0; let expired = 0;
  const call = createAuthenticatedFetch(async (input) => { calls++; return Response.json({}, { status: String(input) === "/api/auth/refresh" ? 503 : 401 }); }, () => expired++);
  assert.equal((await call("/api/tests/a")).status, 503); assert.equal(expired, 0); assert.equal(calls, 3);
  const denied = createAuthenticatedFetch(async () => Response.json({}, { status: 403 }), () => expired++);
  assert.equal((await denied("/api/tests/a")).status, 403); assert.equal(expired, 0);
});
test("auth mutations reject cross-site origins", () => {
  assert.equal(sameOrigin(new Request("https://utp.test/api/auth/login", { headers: { origin: "https://evil.test" } })), false);
  assert.equal(sameOrigin(new Request("https://utp.test/api/auth/login", { headers: { origin: "https://utp.test" } })), true);
});
