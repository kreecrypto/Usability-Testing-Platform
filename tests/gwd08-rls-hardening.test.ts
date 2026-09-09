import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const task21Name = readdirSync(migrationsDir).find((name) => name.endsWith("_task21_workspace_auth_rls.sql"));
const gwd08Name = readdirSync(migrationsDir).find((name) => name.endsWith("_gwd08_grants_rls_views_hardening.sql"));
assert.ok(task21Name);
assert.ok(gwd08Name);
const authSql = readFileSync(join(migrationsDir, task21Name), "utf8");
const hardeningSql = readFileSync(join(migrationsDir, gwd08Name), "utf8");

const tables = [
  "users", "workspaces", "workspace_members", "projects", "tests", "test_versions", "tasks",
  "participants", "sessions", "task_sessions", "events", "answers", "findings", "finding_evidence", "retests",
];

test("all V1 public tables are force-RLS hardened", () => {
  for (const table of tables) {
    assert.match(hardeningSql, new RegExp(`alter table public\\.${table} force row level security`, "i"));
  }
});

test("anon has no direct table, sequence or function surface", () => {
  assert.match(hardeningSql, /revoke all on all tables in schema public from anon/i);
  assert.match(hardeningSql, /revoke all on all sequences in schema public from anon/i);
  assert.match(hardeningSql, /revoke execute on all functions in schema public from anon/i);
  assert.match(hardeningSql, /alter default privileges in schema public revoke all on tables from anon/i);
  assert.match(hardeningSql, /alter default privileges in schema public revoke execute on functions from public, anon/i);
});

test("authenticated operations remain explicit and RLS-backed", () => {
  for (const table of ["projects", "tests", "test_versions", "tasks", "findings", "retests"]) {
    assert.match(authSql, new RegExp(`create policy ${table}_select_member`, "i"));
    assert.match(authSql, new RegExp(`create policy ${table}_insert_editor`, "i"));
    assert.match(authSql, new RegExp(`create policy ${table}_update_editor`, "i"));
    assert.match(authSql, new RegExp(`create policy ${table}_delete_editor`, "i"));
  }
  for (const table of ["participants", "sessions", "events", "answers"]) {
    assert.match(authSql, new RegExp(`create policy ${table}_select_research_editor`, "i"));
    assert.doesNotMatch(authSql, new RegExp(`create policy ${table}_(insert|update|delete)_`, "i"));
  }
});

test("cross-workspace access is mediated by trusted membership helpers", () => {
  assert.match(authSql, /private\.is_workspace_member\(workspace_id\)/i);
  assert.match(authSql, /private\.is_research_editor\(workspace_id\)/i);
  assert.match(authSql, /wm\.workspace_id = target_workspace_id[\s\S]*?wm\.user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(authSql, /user_metadata|raw_user_meta_data/i);
});

test("private helpers fail closed and authenticated gets only explicit RLS helpers", () => {
  assert.match(hardeningSql, /revoke all on schema private from public, anon/i);
  assert.match(hardeningSql, /revoke execute on all functions in schema private from public, anon, authenticated/i);
  assert.match(hardeningSql, /grant usage on schema private to authenticated, service_role/i);
  assert.doesNotMatch(hardeningSql, /grant execute on all functions in schema private to authenticated/i);
  for (const fn of ["is_workspace_member", "is_workspace_admin", "is_workspace_owner", "is_research_editor", "can_read_sensitive_workspace", "can_read_session", "can_edit_finding", "can_read_finding_evidence"]) {
    assert.match(hardeningSql, new RegExp(`grant execute on function private\\.${fn}\\(uuid\\) to authenticated, service_role`, "i"));
  }
});

test("service-role secret is not embedded in database migrations", () => {
  const combined = `${authSql}\n${hardeningSql}`;
  assert.doesNotMatch(combined, /SUPABASE_SERVICE_ROLE_KEY|service_role_key|eyJ[a-zA-Z0-9_-]{20,}/);
});
