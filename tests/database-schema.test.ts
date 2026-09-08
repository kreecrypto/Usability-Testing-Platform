import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationNames = readdirSync(migrationsDir).sort();
const initialMigrationName = migrationNames.find((name) =>
  name.endsWith("_initial_v1_schema.sql"),
);
const contractMigrationName = migrationNames.find((name) =>
  name.endsWith("_contract_integrity_fixes.sql"),
);

assert.ok(initialMigrationName, "initial_v1_schema migration must exist");
assert.ok(contractMigrationName, "contract_integrity_fixes migration must exist");

const initialSql = readFileSync(
  join(migrationsDir, initialMigrationName),
  "utf8",
);
const contractSql = readFileSync(
  join(migrationsDir, contractMigrationName),
  "utf8",
);
const combinedSql = migrationNames
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n");

const requiredTables = [
  "users",
  "workspaces",
  "workspace_members",
  "projects",
  "tests",
  "test_versions",
  "tasks",
  "participants",
  "sessions",
  "task_sessions",
  "events",
  "answers",
  "findings",
  "finding_evidence",
  "retests",
];

test("Task 20 migration includes the complete V1 research model", () => {
  for (const table of requiredTables) {
    assert.match(
      initialSql,
      new RegExp(`create table public\\.${table}\\s*\\(`, "i"),
      `missing public.${table}`,
    );
  }
});

test("published Figma test versions persist immutable publish identifiers", () => {
  for (const column of [
    "figma_file_key",
    "figma_version_id",
    "figma_start_node_id",
    "published_at",
  ]) {
    assert.match(initialSql, new RegExp(`\\b${column}\\b`, "i"), `missing ${column}`);
  }
  assert.match(initialSql, /unique\s*\(test_id,\s*version_no\)/i);
});

test("final event storage enforces Event Contract v2 ordering and idempotency", () => {
  for (const column of [
    "event_id",
    "idempotency_key",
    "event_name",
    "event_layer",
    "schema_version",
    "occurred_at",
    "received_at",
    "sequence",
    "derived_from_event_ids",
    "rule_version",
  ]) {
    assert.match(combinedSql, new RegExp(`\\b${column}\\b`, "i"), `missing events.${column}`);
  }
  assert.match(initialSql, /unique\s*\(session_id,\s*idempotency_key\)/i);
  assert.match(initialSql, /create unique index events_session_raw_sequence_uq/i);
});

test("event schema version is canonical numeric v2 in final persistence", () => {
  assert.match(
    contractSql,
    /alter column event_schema_version type smallint[\s\S]*?set default 2/i,
  );
  assert.match(
    contractSql,
    /alter column schema_version type smallint[\s\S]*?set default 2/i,
  );
  assert.match(contractSql, /events_schema_version_positive/i);
});

test("events persist the complete canonical identity and bind it to one session context", () => {
  for (const column of ["participant_id", "test_id", "test_version_id", "screen_id"]) {
    assert.match(contractSql, new RegExp(`add column ${column}\\b`, "i"));
  }
  assert.match(contractSql, /events_workspace_session_context_fk/i);
  assert.match(
    contractSql,
    /foreign key \(workspace_id, session_id, test_id, test_version_id, participant_id\)/i,
  );
  assert.match(contractSql, /events_workspace_task_version_scope_fk/i);
});

test("tenant consistency is structurally enforced for workspace-scoped relations", () => {
  for (const constraint of [
    "tests_workspace_project_scope_fk",
    "test_versions_workspace_test_scope_fk",
    "tasks_workspace_version_scope_fk",
    "participants_workspace_test_scope_fk",
    "sessions_workspace_version_scope_fk",
    "sessions_workspace_participant_scope_fk",
    "answers_workspace_session_scope_fk",
    "answers_workspace_task_scope_fk",
    "findings_workspace_project_scope_fk",
    "findings_workspace_version_scope_fk",
    "retests_workspace_finding_scope_fk",
    "retests_workspace_original_version_scope_fk",
    "retests_workspace_retest_version_scope_fk",
  ]) {
    assert.match(contractSql, new RegExp(`\\b${constraint}\\b`, "i"), `missing ${constraint}`);
  }
});

test("workspace roles and product personas remain separate", () => {
  assert.match(initialSql, /system_role[\s\S]*?'owner'[\s\S]*?'admin'[\s\S]*?'member'/i);
  assert.match(initialSql, /product_persona[\s\S]*?'researcher'[\s\S]*?'designer'[\s\S]*?'product_viewer'/i);
});

test("all public V1 tables enable RLS before Task 21 adds policies", () => {
  for (const table of requiredTables) {
    assert.match(
      initialSql,
      new RegExp(`alter table public\\.${table} enable row level security;`, "i"),
      `RLS not enabled for ${table}`,
    );
  }
  assert.doesNotMatch(initialSql, /create\s+policy/i, "Task 20 must not pre-empt Task 21 policy design");
});

test("participant/session storage follows privacy baseline", () => {
  assert.match(initialSql, /anonymous_key\s+uuid/i);
  assert.match(initialSql, /consent_version\s+text\s+not null/i);
  assert.match(initialSql, /consented_at\s+timestamptz\s+not null/i);
  assert.match(initialSql, /delete_after\s+timestptz|delete_after\s+timestamptz/i);
  assert.doesNotMatch(initialSql, /\bparticipants[\s\S]{0,600}\b(email|phone|full_name)\b/i);
});
