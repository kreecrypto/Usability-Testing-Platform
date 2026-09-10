import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createTaskScenarioBuilder,
  TaskBuilderError,
} from "../src/lib/builder/task-scenario-builder.ts";

const TEST_ID = "10000000-0000-4000-8000-000000000001";
const VERSION_ID = "20000000-0000-4000-8000-000000000002";
const WORKSPACE_ID = "30000000-0000-4000-8000-000000000003";
const TASK_A = "40000000-0000-4000-8000-000000000004";
const TASK_B = "50000000-0000-4000-8000-000000000005";

const version = { id: VERSION_ID, workspace_id: WORKSPACE_ID, test_id: TEST_ID, lifecycle_status: "draft" };
const a = { id: TASK_A, workspace_id: WORKSPACE_ID, test_version_id: VERSION_ID, ordinal: 1, title: "Find checkout", scenario: "You are ready to buy.", instruction: "Complete checkout." };
const b = { id: TASK_B, workspace_id: WORKSPACE_ID, test_version_id: VERSION_ID, ordinal: 2, title: "Find receipt", scenario: null, instruction: "Open the receipt." };

function storeWith(responses: Response[], calls: Array<{ url: string; init?: RequestInit }>) {
  let index = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return responses[index++] ?? Response.json({ error: "unexpected" }, { status: 500 });
  };
  return createTaskScenarioBuilder({
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
    accessToken: "user-jwt",
    fetchImpl,
  });
}

test("listTasks is scoped to the current draft test version", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = storeWith([Response.json([version]), Response.json([a, b])], calls);
  const tasks = await store.listTasks(TEST_ID);
  assert.deepEqual(tasks.map((task) => task.id), [TASK_A, TASK_B]);
  assert.match(calls[0].url, /lifecycle_status=eq\.draft/);
  assert.match(calls[1].url, new RegExp(`test_version_id=eq\\.${VERSION_ID}`));
  for (const call of calls) {
    const headers = call.init?.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer user-jwt");
    assert.equal(headers.apikey, "sb_publishable_test");
    assert.equal(JSON.stringify(call.init).includes("service_role"), false);
  }
});

test("createTask appends title, scenario and instruction to the draft without touching rule fields", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const created = { ...a, id: TASK_B, ordinal: 2, title: "Task B", scenario: "Context", instruction: "Do it" };
  const store = storeWith([Response.json([version]), Response.json([a]), Response.json([created])], calls);
  const task = await store.createTask(TEST_ID, { title: " Task B ", scenario: " Context ", instruction: " Do it " });
  assert.equal(task.title, "Task B");
  const body = JSON.parse(String(calls[2].init?.body));
  assert.deepEqual(body, {
    workspace_id: WORKSPACE_ID,
    test_version_id: VERSION_ID,
    ordinal: 2,
    title: "Task B",
    scenario: "Context",
    instruction: "Do it",
  });
  assert.equal("success_rule" in body, false);
  assert.equal("failure_rule" in body, false);
});

test("updateTask preserves identity/order and edits only participant task content", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const edited = { ...a, title: "Updated", scenario: "New scenario", instruction: "New instruction" };
  const store = storeWith([Response.json([version]), Response.json([edited])], calls);
  const task = await store.updateTask(TEST_ID, TASK_A, { title: "Updated", scenario: "New scenario", instruction: "New instruction" });
  assert.equal(task.ordinal, 1);
  assert.match(calls[1].url, new RegExp(`id=eq\\.${TASK_A}`));
  assert.match(calls[1].url, new RegExp(`test_version_id=eq\\.${VERSION_ID}`));
  const body = JSON.parse(String(calls[1].init?.body));
  assert.equal(body.title, "Updated");
  assert.equal(body.scenario, "New scenario");
  assert.equal(body.instruction, "New instruction");
  assert.equal(body.ordinal, undefined);
});

test("reorderTasks uses one atomic RPC and returns canonical order", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const reordered = [{ ...b, ordinal: 1 }, { ...a, ordinal: 2 }];
  const store = storeWith([Response.json([version]), new Response(null, { status: 204 }), Response.json(reordered)], calls);
  const tasks = await store.reorderTasks(TEST_ID, [TASK_B, TASK_A]);
  assert.deepEqual(tasks.map((task) => task.id), [TASK_B, TASK_A]);
  assert.match(calls[1].url, /rpc\/reorder_draft_tasks$/);
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { p_test_version_id: VERSION_ID, p_task_ids: [TASK_B, TASK_A] });
});

test("invalid task order and empty title fail before data mutation", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = storeWith([Response.json([version])], calls);
  await assert.rejects(
    () => store.reorderTasks(TEST_ID, [TASK_A, TASK_A]),
    (error: unknown) => error instanceof TaskBuilderError && error.code === "invalid_task_order",
  );
  const createStore = storeWith([Response.json([version]), Response.json([])], calls);
  await assert.rejects(
    () => createStore.createTask(TEST_ID, { title: "   " }),
    (error: unknown) => error instanceof TaskBuilderError && error.code === "invalid_title",
  );
});

test("Task 29 migration keeps reorder atomic under RLS and removes anonymous RPC execution", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260909081424_task29_task_instruction_and_atomic_reorder.sql", import.meta.url), "utf8");
  assert.match(migration, /add column if not exists instruction text/i);
  assert.match(migration, /deferrable initially immediate/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /set constraints tasks_test_version_id_ordinal_key deferred/i);
  assert.match(migration, /lifecycle_status = 'draft'/i);
  assert.match(migration, /revoke all on function public\.reorder_draft_tasks\(uuid, uuid\[\]\) from public, anon/i);
  assert.match(migration, /grant execute .* to authenticated, service_role/i);
  assert.doesNotMatch(migration, /security definer/i);
});

test("Task Editor exposes Thai loading, empty, validation, reorder, unsaved-state, responsive and keyboard-focus states", async () => {
  const client = await readFile(new URL("../src/app/builder/[testId]/tasks/task-scenario-builder-client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/builder/[testId]/tasks/task-scenario-builder.module.css", import.meta.url), "utf8");
  assert.match(client, /กำลังโหลดงาน/);
  assert.match(client, /ยังไม่มีงาน/);
  assert.match(client, /ชื่องาน/);
  assert.match(client, /สถานการณ์/);
  assert.match(client, /คำสั่งที่ผู้เข้าร่วมจะเห็น/);
  assert.match(client, /เลื่อนงาน/);
  assert.match(client, /การแก้ไขช่องข้อมูลที่ยังไม่บันทึกยังคงอยู่ในหน้านี้/);
  assert.match(client, /role=\{state === "error" \? "alert" : "status"\}/);
  assert.match(css, /@media/);
  assert.match(css, /:focus-visible/);
});
