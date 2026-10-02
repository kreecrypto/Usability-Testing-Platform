import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { POST as login } from "../src/app/api/auth/login/route.ts";
import { POST as signup } from "../src/app/api/auth/signup/route.ts";
import { POST as refresh } from "../src/app/api/auth/refresh/route.ts";
import { POST as recover } from "../src/app/api/auth/recover/route.ts";
import { POST as password } from "../src/app/api/auth/password/route.ts";
import { GET as callback } from "../src/app/auth/callback/route.ts";

const tokens = { access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600, user: { id: "researcher-one", email: "researcher@example.test" } };
function setup(t: TestContext, fetchImpl: typeof fetch) {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  });
  t.mock.method(globalThis, "fetch", fetchImpl);
}
function request(path: string, body: unknown, cookie?: string) {
  return new Request(`https://utp.test${path}`, { method: "POST", headers: { origin: "https://utp.test", "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}
test("login returns public identity only, keeps token pair in HttpOnly cookies, and enforces reauth identity", async t => {
  const calls: string[] = [];
  setup(t, async input => { calls.push(String(input)); return Response.json(String(input).includes("logout") ? {} : tokens); });
  const ok = await login(request("/api/auth/login", { email: "researcher@example.test", password: "fixture-only" }));
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { user: tokens.user });
  assert.equal(ok.headers.getSetCookie().length, 2);
  const denied = await login(request("/api/auth/login", { email: "researcher@example.test", password: "fixture-only", expectedUserId: "different-researcher" }));
  assert.equal(denied.status, 409); assert.equal(denied.headers.getSetCookie().length, 0);
  assert.ok(calls.some(url => url.endsWith("logout?scope=local")));
});
test("signup confirmation accepts GoTrue raw user response and completes a browser-bound callback", async t => {
  let challenge = "";
  setup(t, async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body));
    if (url.pathname.endsWith("signup")) {
      assert.equal(url.searchParams.get("redirect_to"), "https://utp.test/auth/callback");
      assert.equal(body.code_challenge_method, "s256"); challenge = body.code_challenge;
      return Response.json(tokens.user);
    }
    assert.equal(url.searchParams.get("grant_type"), "pkce");
    assert.equal(body.auth_code, "fixture-code"); assert.equal(body.code_verifier.length, 64);
    return Response.json(tokens);
  });
  const result = await signup(request("/api/auth/signup", { email: "researcher@example.test", password: "fixture-only", next: "/results/version" }));
  assert.equal(result.status, 202); assert.deepEqual(await result.json(), { confirmationRequired: true });
  assert.ok(challenge.length > 40);
  const cookie = result.headers.getSetCookie()[0].split(";")[0];
  const completed = await callback(new Request("https://utp.test/auth/callback?code=fixture-code", { headers: { cookie } }));
  assert.equal(completed.headers.get("location"), "https://utp.test/results/version");
  assert.equal(completed.headers.getSetCookie().length, 3);
  assert.equal(completed.headers.get("cache-control"), "private, no-store");
});
test("callback without matching browser flow fails closed without contacting Auth", async t => {
  setup(t, async () => { throw new Error("must not exchange unbound code"); });
  const response = await callback(new Request("https://utp.test/auth/callback?code=stolen&next=https://evil.test"));
  assert.equal(response.headers.get("location"), "https://utp.test/login?notice=link_invalid");
  assert.equal(response.headers.getSetCookie().length, 1);
});
test("recovery gives neutral confirmation and password update requires authenticated user", async t => {
  const calls: string[] = [];
  setup(t, async (input, init) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    if (url.pathname.endsWith("recover")) { assert.equal(url.searchParams.get("redirect_to"), "https://utp.test/auth/callback"); return Response.json({}); }
    if (init?.method === "PUT") { assert.equal((init.headers as Record<string,string>).authorization, "Bearer private-access"); assert.deepEqual(JSON.parse(String(init.body)), { password: "new-fixture-only" }); return Response.json(tokens.user); }
    return Response.json(tokens.user);
  });
  const result = await recover(request("/api/auth/recover", { email: "unknown@example.test" }));
  assert.deepEqual(await result.json(), { status: "requested" });
  assert.equal((await password(request("/api/auth/password", { password: "new-fixture-only" }))).status, 401);
  assert.equal(calls.length, 1);
  assert.equal((await password(request("/api/auth/password", { password: "new-fixture-only" }, "utp_access_token=private-access"))).status, 200);
});
test("invalid refresh clears both cookies while provider outage preserves them for retry", async t => {
  let outage = false;
  setup(t, async () => Response.json({}, { status: outage ? 503 : 400 }));
  const response = await refresh(request("/api/auth/refresh", {}, "utp_refresh_token=expired"));
  assert.equal(response.status, 401); assert.equal(response.headers.getSetCookie().length, 2);
  outage = true;
  const retry = await refresh(request("/api/auth/refresh", {}, "utp_refresh_token=valid"));
  assert.equal(retry.status, 503); assert.equal(retry.headers.getSetCookie().length, 0);
});
