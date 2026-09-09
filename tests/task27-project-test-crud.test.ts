import assert from "node:assert/strict";
import test from "node:test";

import {
  bearerAccessToken,
  createProjectTestCrud,
  CrudValidationError,
} from "../src/lib/project-test-crud.ts";
import { crudErrorResponse } from "../src/lib/project-test-api.ts";
import { CrudProviderError } from "../src/lib/project-test-crud.ts";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const projectId = "20000000-0000-4000-8000-000000000001";
const testId = "30000000-0000-4000-8000-000000000001";

const projectRow = {
  id: projectId,
  workspace_id: workspaceId,
  name: "Checkout research",
  description: null,
  status: "active",
  created_at: "2026-09-09T03:00:00.000Z",
  updated_at: "2026-09-09T03:00:00.000Z",
};

const testRow = {
  id: testId,
  workspace_id: workspaceId,
  project_id: projectId,
  title: "Checkout flow",
  description: null,
  status: "draft",
  created_at: "2026-09-09T03:00:00.000Z",
  updated_at: "2026-09-09T03:00:00.000Z",
};

test("bearer access token is required from the request instead of a global shared secret", () => {
  assert.equal(bearerAccessToken(new Request("https://app.example/api/projects")), null);
  assert.equal(
    bearerAccessToken(new Request("https://app.example/api/projects", {
      headers: { authorization: "Bearer user-jwt" },
    })),
    "user-jwt",
  );
});

test("project creation validates input and delegates authorization to Supabase RLS with the user JWT", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify([projectRow]), { status: 201 });
  };
  const crud = createProjectTestCrud({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "public-anon-key",
    accessToken: "user-jwt",
    fetchImpl,
  });

  const created = await crud.createProject({ workspaceId, name: "  Checkout research  " });
  assert.equal(created.id, projectId);
  assert.equal(calls.length, 1);
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.apikey, "public-anon-key");
  assert.equal(headers.authorization, "Bearer user-jwt");
  assert.equal(JSON.stringify(calls[0].init).includes("service_role"), false);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    workspace_id: workspaceId,
    name: "Checkout research",
  });
});

test("project and test names reject blank values before any provider write", async () => {
  let calls = 0;
  const crud = createProjectTestCrud({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "public-anon-key",
    accessToken: "user-jwt",
    fetchImpl: async () => {
      calls += 1;
      return new Response("[]");
    },
  });

  await assert.rejects(
    () => crud.createProject({ workspaceId, name: "   " }),
    (error: unknown) => error instanceof CrudValidationError && error.field === "name",
  );
  await assert.rejects(
    () => crud.createTest({ workspaceId, projectId, title: "" }),
    (error: unknown) => error instanceof CrudValidationError && error.field === "title",
  );
  assert.equal(calls, 0);
});

test("archive operations use schema-supported archived status rather than destructive delete", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const row = String(input).includes("/projects?")
      ? { ...projectRow, status: "archived" }
      : { ...testRow, status: "archived" };
    return new Response(JSON.stringify([row]), { status: 200 });
  };
  const crud = createProjectTestCrud({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "public-anon-key",
    accessToken: "user-jwt",
    fetchImpl,
  });

  assert.equal((await crud.archiveProject(projectId))?.status, "archived");
  assert.equal((await crud.archiveTest(testId))?.status, "archived");
  for (const call of calls) {
    assert.equal(call.init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(call.init?.body)), { status: "archived" });
  }
});

test("test listing is workspace-scoped and can be project-scoped", async () => {
  let url = "";
  const crud = createProjectTestCrud({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "public-anon-key",
    accessToken: "user-jwt",
    fetchImpl: async (input) => {
      url = String(input);
      return new Response(JSON.stringify([testRow]), { status: 200 });
    },
  });

  const rows = await crud.listTests(workspaceId, projectId);
  assert.equal(rows.length, 1);
  assert.match(url, new RegExp(`workspace_id=eq\\.${workspaceId}`));
  assert.match(url, new RegExp(`project_id=eq\\.${projectId}`));
});

test("provider permission denial stays a permission denial without exposing provider details", async () => {
  const response = crudErrorResponse(new CrudProviderError(403, "postgres detail that must stay hidden"));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "permission_denied" });
});
