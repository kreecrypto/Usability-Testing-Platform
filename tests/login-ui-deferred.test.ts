import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("current product surface does not expose researcher login", () => {
  const home = read("src/app/page.tsx");
  const login = read("src/app/login/page.tsx");
  const projects = read("src/app/projects/page.tsx");
  const inventory = read("docs/screen-inventory.md");
  const screenMap = JSON.parse(read("docs/design-system/screen-component-map.json")) as {
    screens: Array<{ id: string; name: string; states: string[]; componentFamilies: string[] }>;
  };
  const entry = screenMap.screens.find((screen) => screen.id === "S01");

  assert.doesNotMatch(home, /href=["']\/login["']/);
  assert.doesNotMatch(home, /href=["']\/projects["']/);
  assert.match(home, /href=["']\/high-fi["']/);

  assert.match(login, /redirect\("\/"\)/);
  assert.doesNotMatch(login, /password|email|sign in/i);
  assert.match(projects, /redirect\("\/high-fi"\)/);
  assert.doesNotMatch(projects, /sign out|authenticated researcher|\/api\/auth\/session/i);

  assert.ok(entry);
  assert.equal(entry.name, "App Entry");
  assert.deepEqual(entry.states, ["Default", "Loading", "Error"]);
  assert.equal(entry.componentFamilies.includes("AuthShell"), false);
  assert.equal(entry.componentFamilies.includes("TextInput"), false);
  assert.match(inventory, /S01 \| App Entry \| default, loading, error/);
  assert.doesNotMatch(inventory, /S01 \| Login/);
});

test("authorization backend remains available while login UI is deferred", () => {
  const session = read("src/lib/auth/session.ts");
  const authRoute = read("src/app/api/auth/session/route.ts");
  const projectApi = read("src/app/api/projects/route.ts");

  assert.match(session, /accessTokenFromRequest/);
  assert.match(session, /validateAccessToken/);
  assert.match(authRoute, /validateAccessToken|session/i);
  assert.match(projectApi, /accessTokenFromRequest|authentication_required|accessToken/i);
});
