import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDir)
  .sort()
  .find((name) => name.endsWith("_task21_workspace_auth_rls.sql"));

assert.ok(migrationName, "Task 21 workspace auth/RLS migration must exist");
const sql = readFileSync(join(migrationsDir, migrationName), "utf8");

test("Task 21 uses explicit workspace authorization helpers outside public schema", () => {
  for (const helper of [
    "private.is_workspace_member",
    "private.is_workspace_admin",
    "private.is_workspace_owner",
    "private.is_research_editor",
    "private.can_read_sensitive_workspace",
    "private.can_read_session",
    "private.can_read_finding_evidence",
    "private.can_edit_finding",
  ]) {
    assert.match(sql, new RegExp(helper.replaceAll(".", "\\."), "i"), `missing ${helper}`);
  }
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on schema private from public/i);
  assert.match(sql, /grant usage on schema private to authenticated, service_role/i);
});

test("authorization never trusts user-editable JWT metadata or deprecated auth.role", () => {
  assert.doesNotMatch(sql, /user_metadata|raw_user_meta_data/i);
  assert.doesNotMatch(sql, /auth\.role\s*\(/i);
});

test("anonymous clients have no direct V1 table access", () => {
  assert.match(sql, /revoke all on table[\s\S]*?from anon, authenticated;/i);
  assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete)[\s\S]{0,300}\bto anon\b/i);
});

test("Product Viewer is database-enforced read-only for research objects", () => {
  assert.match(
    sql,
    /product_persona in \('researcher', 'designer'\)/i,
    "research write helper must exclude product_viewer",
  );
  for (const table of ["projects", "tests", "test_versions", "tasks", "findings", "retests"]) {
    assert.match(sql, new RegExp(`create policy ${table}_select_member`, "i"));
    assert.match(sql, new RegExp(`create policy ${table}_insert_editor`, "i"));
    assert.match(sql, new RegExp(`create policy ${table}_update_editor`, "i"));
  }
});

test("sensitive participant/session evidence is not readable by Product Viewer", () => {
  for (const table of ["participants", "sessions", "events", "answers"]) {
    assert.match(
      sql,
      new RegExp(`create policy ${table}_select_research_editor[\\s\\S]*?private\\.can_read_sensitive_workspace\\(workspace_id\\)`, "i"),
      `${table} must use sensitive research-editor read policy`,
    );
  }
  assert.match(sql, /task_sessions_select_research_editor[\s\S]*?private\.can_read_session\(session_id\)/i);
  assert.match(sql, /finding_evidence_select_research_editor[\s\S]*?private\.can_read_finding_evidence\(finding_id\)/i);
});

test("participant collection tables remain read-only to authenticated researcher clients", () => {
  assert.match(
    sql,
    /grant select on table[\s\S]*?public\.participants,[\s\S]*?public\.sessions,[\s\S]*?public\.task_sessions,[\s\S]*?public\.events,[\s\S]*?public\.answers[\s\S]*?to authenticated;/i,
  );
  for (const table of ["participants", "sessions", "task_sessions", "events", "answers"]) {
    assert.doesNotMatch(
      sql,
      new RegExp(`create policy ${table}_(insert|update|delete)_`, "i"),
      `${table} must not gain direct authenticated write policies`,
    );
  }
});

test("workspace admin and owner bootstrap policies are explicit", () => {
  assert.match(sql, /workspace_members_insert_admin_or_owner_bootstrap/i);
  assert.match(sql, /private\.is_workspace_owner\(workspace_id\)/i);
  assert.match(sql, /system_role = 'owner'/i);
  assert.match(sql, /workspace_members_update_admin/i);
  assert.match(sql, /workspace_members_delete_admin/i);
});

test("UPDATE authorization uses USING and WITH CHECK", () => {
  for (const policy of [
    "users_update_self",
    "workspaces_update_admin",
    "workspace_members_update_admin",
    "projects_update_editor",
    "tests_update_editor",
    "test_versions_update_editor",
    "tasks_update_editor",
    "findings_update_editor",
    "retests_update_editor",
    "finding_evidence_update_editor",
  ]) {
    assert.match(
      sql,
      new RegExp(`create policy ${policy}[\\s\\S]*?for update[\\s\\S]*?using \\([\\s\\S]*?with check \\(`, "i"),
      `${policy} must include USING and WITH CHECK`,
    );
  }
});
