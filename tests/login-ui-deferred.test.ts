import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public entry offers Demo and authenticated researcher workspace", () => {
  const home = read("src/app/page.tsx");
  const login = read("src/app/login/page.tsx");
  const projects = read("src/app/projects/page.tsx");
  const highFi = read("src/app/high-fi/page.tsx");

  assert.match(home, /href=["']\/demo\/projects["']/);
  assert.match(home, /href=["']\/login["']/);

  assert.match(login, /AuthForm/);
  assert.match(login, /เข้าสู่ระบบ UTP/);
  assert.doesNotMatch(login, /\/api\/auth\/guest/);

  assert.match(projects, /\/api\/auth\/session/);
  assert.doesNotMatch(projects, /\/api\/auth\/guest/);
  assert.match(projects, /\/api\/workspaces/);
  assert.match(projects, /\/api\/projects/);
  assert.match(projects, /\/api\/tests/);
  assert.match(projects, /\/prototype/);
  assert.match(projects, /\/tasks/);
  assert.match(projects, /\/publish/);
  assert.doesNotMatch(projects, /redirect\(["']\/high-fi["']\)/);

  // Design QA remains available, but it is explicitly not production research data.
  assert.match(highFi, /design-only:no-production-data/);
});

test("public demo does not create a guest account and protected APIs retain JWT + RLS boundary", () => {
  const session = read("src/lib/auth/session.ts");
  const authRoute = read("src/app/api/auth/session/route.ts");
  const projectApi = read("src/lib/project-test-api.ts");
  const workspaceRoute = read("src/app/api/workspaces/route.ts");

  assert.match(session, /accessTokenFromRequest/);
  assert.match(session, /validateAccessToken/);
  assert.match(authRoute, /validateAccessToken|session/i);
  assert.match(projectApi, /accessTokenFromRequest/);
  assert.match(projectApi, /authentication_required/);
  assert.match(workspaceRoute, /create_owned_workspace/);
  assert.doesNotMatch(workspaceRoute, /service_role|SUPABASE_SECRET_KEY/);
});
