import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("MAJOR-A zero-state workspace bootstrap stays authenticated and RLS-backed", () => {
  const migration = read("supabase/migrations/20260923113000_major_a_workspace_bootstrap.sql");
  const route = read("src/app/api/workspaces/route.ts");

  assert.match(migration, /security invoker/i);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /insert into public\.users/);
  assert.match(migration, /insert into public\.workspaces/);
  assert.match(migration, /insert into public\.workspace_members/);
  assert.match(migration, /'owner'/);
  assert.match(migration, /grant execute .* authenticated/is);
  assert.doesNotMatch(migration, /security definer/i);

  assert.match(route, /accessTokenFromRequest/);
  assert.match(route, /rpc\/create_owned_workspace/);
  assert.match(route, /Bearer \$\{auth\.accessToken\}/);
  assert.doesNotMatch(route, /service_role|SUPABASE_SECRET_KEY/);
});

test("MAJOR-A public session consumes the immutable provider-neutral target snapshot", () => {
  const publicSession = read("src/lib/runner/public-session.ts");
  const participant = read("src/app/t/[testVersionId]/participant-runner-client.tsx");

  assert.match(publicSession, /publicTargetFromSnapshot/);
  assert.match(publicSession, /target_provider,target_snapshot/);
  assert.match(publicSession, /target: PublicRunnerTarget/);
  assert.doesNotMatch(publicSession, /prototypeFromVersion/);

  assert.match(participant, /snapshot\.target\.provider/);
  assert.match(participant, /snapshot\.target\.launchMode/);
  assert.match(participant, /first_party_web/);
  assert.doesNotMatch(participant, /snapshot\.prototype/);
  assert.doesNotMatch(participant, /mark.*success|manual.*success/i);
});
