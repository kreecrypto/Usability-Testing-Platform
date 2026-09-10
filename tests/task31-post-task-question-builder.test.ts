import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createPostTaskQuestionBuilder,
  normalizePostTaskQuestionConfig,
  PostTaskQuestionError,
} from "../src/lib/builder/post-task-questions.ts";

const TEST_ID = "10000000-0000-4000-8000-000000000001";
const VERSION_ID = "20000000-0000-4000-8000-000000000002";
const TASK_ID = "40000000-0000-4000-8000-000000000004";

test("Task31 config supports only fixed SEQ and Open Feedback toggles", () => {
  const config = normalizePostTaskQuestionConfig({
    seq: { enabled: true, required: true },
    openFeedback: { enabled: true, required: false },
  });
  assert.deepEqual(config, {
    seq: { enabled: true, required: true },
    openFeedback: { enabled: true, required: false },
  });
});

test("required question cannot be disabled", () => {
  assert.throws(
    () => normalizePostTaskQuestionConfig({
      seq: { enabled: false, required: true },
      openFeedback: { enabled: false, required: false },
    }),
    (error: unknown) => error instanceof PostTaskQuestionError
      && error.code === "invalid_question_config"
      && /cannot be required when disabled/i.test(error.message),
  );
});

test("builder reads latest draft and persists config with authenticated user JWT", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    Response.json([{ id: VERSION_ID, workspace_id: "30000000-0000-4000-8000-000000000003", test_id: TEST_ID, lifecycle_status: "draft" }]),
    Response.json([{
      id: TASK_ID,
      test_version_id: VERSION_ID,
      ordinal: 1,
      title: "Checkout",
      post_task_questions: {
        seq: { enabled: true, required: false },
        open_feedback: { enabled: false, required: false },
      },
    }]),
    Response.json([{ id: VERSION_ID, workspace_id: "30000000-0000-4000-8000-000000000003", test_id: TEST_ID, lifecycle_status: "draft" }]),
    Response.json([{
      id: TASK_ID,
      test_version_id: VERSION_ID,
      ordinal: 1,
      title: "Checkout",
      post_task_questions: {
        seq: { enabled: true, required: true },
        open_feedback: { enabled: true, required: false },
      },
    }]),
  ];
  let index = 0;
  const builder = createPostTaskQuestionBuilder({
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
    accessToken: "user-jwt",
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return responses[index++] ?? Response.json([], { status: 500 });
    },
  });

  const tasks = await builder.list(TEST_ID);
  assert.equal(tasks[0].config.seq.enabled, true);
  const updated = await builder.update(TEST_ID, TASK_ID, {
    seq: { enabled: true, required: true },
    openFeedback: { enabled: true, required: false },
  });
  assert.equal(updated.config.seq.required, true);
  assert.equal(updated.config.openFeedback.enabled, true);
  assert.match(calls[0].url, /lifecycle_status=eq\.draft/);
  assert.match(calls[3].url, new RegExp(`test_version_id=eq\\.${VERSION_ID}`));
  const patchHeaders = calls[3].init?.headers as Record<string, string>;
  assert.equal(patchHeaders.authorization, "Bearer user-jwt");
  assert.equal(patchHeaders.apikey, "sb_publishable_test");
  assert.doesNotMatch(JSON.stringify(calls[3].init), /service_role/i);
});

test("database config shape enforces booleans and required implies enabled", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260909094000_task31_post_task_questions.sql", import.meta.url), "utf8");
  assert.match(migration, /post_task_questions jsonb not null/i);
  assert.match(migration, /'seq'/i);
  assert.match(migration, /'open_feedback'/i);
  assert.match(migration, /jsonb_typeof[\s\S]*boolean/i);
  assert.match(migration, /required[\s\S]*enabled/i);
  assert.match(migration, /Participant answer persistence is Task37/i);
});

test("question API uses current authenticated session boundary and no service role", async () => {
  const route = await readFile(new URL("../src/app/api/tests/[testId]/questions/route.ts", import.meta.url), "utf8");
  assert.match(route, /accessTokenFromRequest/);
  assert.match(route, /publicSupabaseConfig/);
  assert.match(route, /createPostTaskQuestionBuilder/);
  assert.doesNotMatch(route, /service_role/i);
  assert.match(route, /cache-control/);
});

test("S15 editor exposes Thai SEQ, open feedback, required/optional, validation, empty and responsive accessibility states", async () => {
  const client = await readFile(new URL("../src/app/builder/[testId]/questions/post-task-question-builder-client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/builder/[testId]/questions/post-task-question-builder.module.css", import.meta.url), "utf8");
  assert.match(client, /สร้างการทดสอบ · คำถามหลังงาน/);
  assert.match(client, />SEQ</);
  assert.match(client, /ความคิดเห็นเพิ่มเติม/);
  assert.match(client, /บังคับตอบ/);
  assert.match(client, /ตั้ง SEQ เป็นบังคับตอบไม่ได้เมื่อยังปิดคำถามนี้/);
  assert.match(client, /กำลังโหลดการตั้งค่าคำถาม/);
  assert.match(client, /ยังไม่มีงาน/);
  assert.match(client, /บันทึกคำถาม/);
  assert.match(client, /role="alert"/);
  assert.match(client, /role="status"/);
  assert.match(css, /@media/);
  assert.match(css, /:focus-visible/);
});
