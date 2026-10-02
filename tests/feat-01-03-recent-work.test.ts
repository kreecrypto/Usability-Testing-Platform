import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../src/app/api/recent-work/route.ts";

test("recent work requires a researcher session", async () => {
  const response = await GET(new Request("https://utp.example.com/api/recent-work"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});

test("recent work reads only the authenticated user's RLS-visible rows and limits both lists", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const calls: Array<{ url: URL; headers: Headers }> = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(url.pathname.endsWith("/projects")
      ? [{ id: "p1", workspace_id: "w1", name: "UAT", updated_at: "2026-09-27T00:00:00Z" }]
      : [{ id: "t1", workspace_id: "w1", project_id: "p1", title: "Checkout", status: "draft", updated_at: "2026-09-27T00:00:00Z" }]), { status: 200 });
  };

  try {
    const response = await GET(new Request("https://utp.example.com/api/recent-work", {
      headers: { cookie: "utp_access_token=researcher-jwt" },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json() as { projects: unknown[]; tests: unknown[] };
    assert.equal(body.projects.length, 1);
    assert.equal(body.tests.length, 1);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.headers.get("authorization"), "Bearer researcher-jwt");
      assert.equal(call.headers.get("apikey"), "public-key");
      assert.equal(call.url.searchParams.get("limit"), "5");
      assert.equal(call.url.searchParams.get("order"), "updated_at.desc");
    }
    assert.equal(calls.find((call) => call.url.pathname.endsWith("/projects"))?.url.searchParams.get("status"), "eq.active");
    assert.equal(calls.find((call) => call.url.pathname.endsWith("/tests"))?.url.searchParams.get("status"), "neq.archived");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

test("recent work does not show partial results when either query fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
  globalThis.fetch = async (input) => new Response("[]", { status: String(input).includes("/tests?") ? 503 : 200 });
  try {
    const response = await GET(new Request("https://utp.example.com/api/recent-work", {
      headers: { cookie: "utp_access_token=researcher-jwt" },
    }));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "data_request_failed" });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});
