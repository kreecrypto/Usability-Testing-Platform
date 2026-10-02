import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("researcher flow requires login and never creates a guest identity", () => {
  const home = read("src/app/page.tsx");
  const login = read("src/app/login/page.tsx") + read("src/components/auth/auth-form.tsx");
  const projects = read("src/app/projects/page.tsx");
  const session = read("src/lib/auth/session.ts");

  assert.match(home, /href=["']\/login["']/);
  assert.match(login, /\/api\/auth\/session/);
  assert.match(login, /\/api\/auth\/\$\{/);
  assert.match(login, /type="email"/);
  assert.match(login, /"current-password"/);
  assert.match(login, /role="alert"/);
  assert.match(projects, /authenticatedFetch/);
  assert.doesNotMatch(login + projects + session, /\/api\/auth\/guest|signInAnonymously|temporary_researcher/);
  assert.equal(existsSync(new URL("../src/app/api/auth/guest/route.ts", import.meta.url)), false);

  assert.match(projects, /\/api\/workspaces/);
  assert.match(projects, /\/api\/projects/);
  assert.match(projects, /\/api\/tests/);
  for (const label of ["ชื่อพื้นที่ทำงานใหม่", "ชื่อโปรเจกต์ใหม่", "ชื่อแบบทดสอบใหม่"]) {
    assert.match(projects, new RegExp(`aria-label="${label}"`));
  }
});

test("researcher login keeps the JWT and RLS boundary", () => {
  const loginRoute = read("src/app/api/auth/login/route.ts");
  const sessionRoute = read("src/app/api/auth/session/route.ts");
  const projectApi = read("src/lib/project-test-api.ts");
  const workspaceRoute = read("src/app/api/workspaces/route.ts");

  assert.match(loginRoute, /signInWithPassword/);
  assert.match(loginRoute, /setSessionCookies/);
  assert.match(read("src/lib/auth/lifecycle.ts"), /accessCookieHeader/);
  assert.match(sessionRoute, /validateAccessToken/);
  assert.match(projectApi, /accessTokenFromRequest/);
  assert.match(projectApi, /authentication_required/);
  assert.match(workspaceRoute, /create_owned_workspace/);
  assert.doesNotMatch(loginRoute + workspaceRoute, /service_role|SUPABASE_SECRET_KEY/);
});
