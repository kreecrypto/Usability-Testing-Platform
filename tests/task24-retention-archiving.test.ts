import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDir)
  .sort()
  .find((name) => name.endsWith("_task24_retention_archiving.sql"));

assert.ok(migrationName, "Task 24 retention migration must exist");

const sql = readFileSync(join(migrationsDir, migrationName), "utf8");

test("Task 24 adds task-scoped event and answer query indexes", () => {
  assert.match(sql, /create index if not exists events_session_task_occurred_idx[\s\S]*?\(session_id, task_id, occurred_at, received_at\)/i);
  assert.match(sql, /create index if not exists answers_session_task_created_idx[\s\S]*?\(session_id, task_id, created_at\)/i);
  assert.match(sql, /create index if not exists sessions_delete_after_idx/i);
});

test("Task 24 defaults retention to 90 days after authoritative completion", () => {
  assert.match(sql, /new\.completed_at is not null and new\.delete_after is null/i);
  assert.match(sql, /new\.delete_after := new\.completed_at \+ interval '90 days'/i);
  assert.match(sql, /before insert or update of completed_at, delete_after/i);
  assert.match(sql, /where completed_at is not null[\s\S]*?and delete_after is null/i);
});

test("Task 24 expiry removes reconstructable finding evidence before session cascade", () => {
  const evidenceDelete = sql.indexOf("delete from public.finding_evidence");
  const sessionDelete = sql.indexOf("delete from public.sessions");
  assert.ok(evidenceDelete >= 0, "finding evidence cleanup must exist");
  assert.ok(sessionDelete > evidenceDelete, "evidence must be removed before session cascade");
  assert.match(sql, /fe\.session_id = target_session_id/i);
  assert.match(sql, /from public\.events e[\s\S]*?e\.session_id = target_session_id/i);
  assert.match(sql, /from public\.answers a[\s\S]*?a\.session_id = target_session_id/i);
});

test("Task 24 purge is bounded and service-role only", () => {
  assert.match(sql, /max_rows integer default 500/i);
  assert.match(sql, /max_rows < 1 or max_rows > 5000/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /revoke all on function private\.purge_expired_sessions\(timestamptz, integer\)[\s\S]*?from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function private\.purge_expired_sessions\(timestamptz, integer\)[\s\S]*?to service_role/i);
});
