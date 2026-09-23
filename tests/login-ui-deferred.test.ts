import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("production surface skips account creation and boots a temporary researcher session", () => {
  const home = read("src/app/page.tsx");
  const login = read("src/app/login/page.tsx");
  const projects = read("src/app/projects/page.tsx");
  const highFi = read("src/app/high-fi/page.tsx");

  assert.match(home, /href=["']\/login["']/);
  assert.match(home, /href:\s*["']\/projects["']/);

  assert.match(login, /\/api\/auth\/guest/);
  assert.match(login, /Temporary Researcher Session/);
  assert.doesNotMatch(login, /\/api\/auth\/signup/);
  assert.doesNotMatch(login, /type="email"/);
  assert.doesNotMatch(login, /type="password"/);
  assert.doesNotMatch(login, /สร้างบัญชี Researcher/);

  assert.match(projects, /\/api\/auth\/session/);
  assert.match(projects, /\/api\/auth\/guest/);
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

test("temporary researcher auth preserves JWT + RLS boundary", () => {
  const session = read("src/lib/auth/session.ts");
  const authRoute = read("src/app/api/auth/session/route.ts");
  const guestRoute = read("src/app/api/auth/guest/route.ts");
  const projectApi = read("src/lib/project-test-api.ts");
  const workspaceRoute = read("src/app/api/workspaces/route.ts");

  assert.match(session, /accessTokenFromRequest/);
  assert.match(session, /validateAccessToken/);
  assert.match(session, /signInAnonymously/);
  assert.match(session, /\/auth\/v1\/signup/);
  assert.match(session, /temporary_researcher/);
  assert.match(authRoute, /validateAccessToken|session/i);
  assert.match(guestRoute, /signInAnonymously/);
  assert.match(guestRoute, /accessCookieHeader/);
  assert.match(projectApi, /accessTokenFromRequest/);
  assert.match(projectApi, /authentication_required/);
  assert.match(workspaceRoute, /create_owned_workspace/);
  assert.doesNotMatch(guestRoute + workspaceRoute, /service_role|SUPABASE_SECRET_KEY/);
});
