import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("researcher flow requires login and never creates a guest identity", () => {
  const home = read("src/app/page.tsx");
  const login = read("src/app/login/page.tsx");
  const projects = read("src/app/projects/page.tsx");
  const internalValidation = read("src/app/internal-validation/page.tsx");
  const session = read("src/lib/auth/session.ts");

  assert.match(home, /href=["']\/projects["']/);
  assert.match(login, /\/api\/auth\/session/);
  assert.match(login, /\/api\/auth\/login/);
  assert.match(login, /type="email"/);
  assert.match(login, /type="password"/);
  assert.match(login, /role="alert"/);
  assert.match(projects, /session\.status === 401.*\/login/);
  assert.match(internalValidation, /session\.status === 401.*\/login/);
  assert.doesNotMatch(login + projects + internalValidation + session, /\/api\/auth\/guest|signInAnonymously|temporary_researcher/);
  assert.equal(existsSync(new URL("../src/app/api/auth/guest/route.ts", import.meta.url)), false);

  assert.match(projects, /\/api\/workspaces/);
  assert.match(projects, /\/api\/projects/);
  assert.match(projects, /\/api\/tests/);
  assert.match(projects, /\/builder\/\$\{encodeURIComponent\(result\.test\.id\)\}\/prototype/);
  for (const field of ["workspace-select", "workspace-name", "project-select", "project-name", "test-title"]) {
    assert.match(projects, new RegExp(`htmlFor="${field}"`));
    assert.match(projects, new RegExp(`id="${field}"`));
  }
  assert.doesNotMatch(projects, /UTP Internal Validation|Golden Path|MAJOR-A Flow Proven/);
});

test("researcher login keeps the JWT and RLS boundary", () => {
  const loginRoute = read("src/app/api/auth/login/route.ts");
  const sessionRoute = read("src/app/api/auth/session/route.ts");
  const projectApi = read("src/lib/project-test-api.ts");
  const workspaceRoute = read("src/app/api/workspaces/route.ts");

  assert.match(loginRoute, /signInWithPassword/);
  assert.match(loginRoute, /accessCookieHeader/);
  assert.match(sessionRoute, /validateAccessToken/);
  assert.match(projectApi, /accessTokenFromRequest/);
  assert.match(projectApi, /authentication_required/);
  assert.match(workspaceRoute, /create_owned_workspace/);
  assert.doesNotMatch(loginRoute + workspaceRoute, /service_role|SUPABASE_SECRET_KEY/);
});
