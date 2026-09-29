import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("production researcher entry uses the existing password login", () => {
  const home = read("src/app/page.tsx");
  const login = read("src/app/login/page.tsx");
  const projects = read("src/app/projects/page.tsx");
  const highFi = read("src/app/high-fi/page.tsx");

  assert.match(home, /href=["']\/login["']/);
  assert.match(home, /href:\s*["']\/projects["']/);

  assert.match(login, /\/api\/auth\/login/);
  assert.match(login, /type="email"/);
  assert.match(login, /type="password"/);
  assert.match(login, /role="alert"/);

  assert.match(projects, /\/api\/auth\/session/);
  assert.match(projects, /session\.ok.*\/login/);
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

test("password researcher auth preserves JWT + RLS boundary", () => {
  const session = read("src/lib/auth/session.ts");
  const authRoute = read("src/app/api/auth/session/route.ts");
  const loginRoute = read("src/app/api/auth/login/route.ts");
  const projectApi = read("src/lib/project-test-api.ts");
  const workspaceRoute = read("src/app/api/workspaces/route.ts");

  assert.match(session, /accessTokenFromRequest/);
  assert.match(session, /validateAccessToken/);
  assert.match(session, /signInWithPassword/);
  assert.match(authRoute, /validateAccessToken|session/i);
  assert.match(loginRoute, /signInWithPassword/);
  assert.match(loginRoute, /accessCookieHeader/);
  assert.match(projectApi, /accessTokenFromRequest/);
  assert.match(projectApi, /authentication_required/);
  assert.match(workspaceRoute, /create_owned_workspace/);
  assert.doesNotMatch(loginRoute + workspaceRoute, /service_role|SUPABASE_SECRET_KEY/);
  assert.equal(existsSync(new URL("../src/app/api/auth/guest/route.ts", import.meta.url)), false);
});
