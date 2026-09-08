import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDir).find((name) => name.endsWith("_initial_v1_schema.sql"));

assert.ok(migrationName, "initial_v1_schema migration must exist");
const sql = readFileSync(join(migrationsDir, migrationName), "utf8");

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
    assert.match(sql, new RegExp(`create table public\\.${table}\\s*\\(`, "i"), `missing public.${table}`);
  }
});

test("published Figma test versions persist immutable publish identifiers", () => {
  for (const column of ["figma_file_key", "figma_version_id", "figma_start_node_id", "published_at"]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, "i"), `missing ${column}`);
  }
  assert.match(sql, /unique\s*\(test_id,\s*version_no\)/i);
});

test("event storage enforces Event Contract v2 ordering and idempotency", () => {
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
    assert.match(sql, new RegExp(`\\b${column}\\b`, "i"), `missing events.${column}`);
  }
  assert.match(sql, /unique\s*\(session_id,\s*idempotency_key\)/i);
  assert.match(sql, /create unique index events_session_raw_sequence_uq/i);
});

test("workspace roles and product personas remain separate", () => {
  assert.match(sql, /system_role[\s\S]*?'owner'[\s\S]*?'admin'[\s\S]*?'member'/i);
  assert.match(sql, /product_persona[\s\S]*?'researcher'[\s\S]*?'designer'[\s\S]*?'product_viewer'/i);
});

test("all public V1 tables enable RLS before Task 21 adds policies", () => {
  for (const table of requiredTables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`, "i"), `RLS not enabled for ${table}`);
  }
  assert.doesNotMatch(sql, /create\s+policy/i, "Task 20 must not pre-empt Task 21 policy design");
});

test("participant/session storage follows privacy baseline", () => {
  assert.match(sql, /anonymous_key\s+uuid/i);
  assert.match(sql, /consent_version\s+text\s+not null/i);
  assert.match(sql, /consented_at\s+timestamptz\s+not null/i);
  assert.match(sql, /delete_after\s+timestamptz/i);
  assert.doesNotMatch(sql, /\bparticipants[\s\S]{0,600}\b(email|phone|full_name)\b/i);
});
