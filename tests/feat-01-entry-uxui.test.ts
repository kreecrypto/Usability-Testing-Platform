import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../src/app/api/projects/[projectId]/overview/route.ts";

const projectId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const testId = "33333333-3333-4333-8333-333333333333";
const versionId = "44444444-4444-4444-8444-444444444444";

test("project overview requires a researcher session", async () => {
  const response = await GET(new Request(`https://utp.example.com/api/projects/${projectId}/overview`), { params: Promise.resolve({ projectId }) });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});

test("project overview scopes every read to the project and links results to its published version", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const calls: Array<{ url: URL; headers: Headers }> = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, headers: new Headers(init?.headers) });
    const rows = url.pathname.endsWith("/projects")
      ? [{ id: projectId, workspace_id: workspaceId, name: "UAT", status: "active" }]
      : url.pathname.endsWith("/tests")
        ? [{ id: testId, workspace_id: workspaceId, project_id: projectId, title: "Checkout", status: "published" }]
        : url.pathname.endsWith("/test_versions")
          ? [{ id: versionId, test_id: testId, version_no: 2, lifecycle_status: "published", study_mode: "usability" }]
          : [{ id: "finding-1", title: "Navigation", severity: "high", status: "open", test_version_id: versionId }];
    return Response.json(rows, {headers:{"content-range":`0-${rows.length - 1}/${rows.length}`}});
  };
  try {
    const response = await GET(new Request(`https://utp.example.com/api/projects/${projectId}/overview`, { headers: { cookie: "utp_access_token=researcher-jwt" } }), { params: Promise.resolve({ projectId }) });
    assert.equal(response.status, 200);
    const body = await response.json() as { tests: Array<{ latestPublishedVersionId: string }>; findings: unknown[] };
    assert.equal(body.tests[0]?.latestPublishedVersionId, versionId);
    assert.equal(body.findings.length, 1);
    assert.equal(calls.length, 4);
    for (const call of calls) {
      assert.equal(call.headers.get("authorization"), "Bearer researcher-jwt");
      assert.equal(call.headers.get("apikey"), "public-key");
    }
    assert.equal(calls.find((call) => call.url.pathname.endsWith("/tests"))?.url.searchParams.get("project_id"), `eq.${projectId}`);
    const findings = calls.find((call) => call.url.pathname.endsWith("/findings"))?.url;
    assert.equal(findings?.searchParams.get("workspace_id"), `eq.${workspaceId}`);
    assert.equal(findings?.searchParams.get("project_id"), `eq.${projectId}`);
    assert.equal(calls.find((call) => call.url.pathname.endsWith("/test_versions"))?.url.searchParams.get("test_id"), `eq.${testId}`);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});
