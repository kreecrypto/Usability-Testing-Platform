import assert from "node:assert/strict";
import test from "node:test";
import { createMethodRunnerStore, MethodRunnerError } from "../src/lib/methods/runner-store.ts";

const versionId = "55555555-5555-4555-8555-555555555555";
const testId = "44444444-4444-4444-8444-444444444444";
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const blockId = "66666666-6666-4666-8666-666666666666";
const responseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("retry of the last method response finishes a session after a transient completion failure", async () => {
  let saved: Record<string, unknown> | null = null;
  let status = "active";
  let failCompletion = true;
  let inserts = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/test_versions")) return Response.json([{ id: versionId, test_id: testId,
      workspace_id: "22222222-2222-4222-8222-222222222222", version_no: 1,
      lifecycle_status: "published", study_mode: "methods", screener_config: { questions: [] }, invite_only: false }]);
    if (path.endsWith("/tests")) return Response.json([{ id: testId, title: "Study", description: null, status: "published" }]);
    if (path.endsWith("/study_blocks")) return Response.json([{ id: blockId, ordinal: 1, kind: "survey", title: "Question",
      config: { questions: [{ id: "q1", prompt: "What happened?", type: "text", required: true }] } }]);
    if (path.endsWith("/sessions")) {
      if (init?.method === "PATCH") {
        if (failCompletion) { failCompletion = false; return Response.json({ message: "temporary" }, { status: 503 }); }
        status = "completed"; return Response.json([]);
      }
      return Response.json([{ id: sessionId, workspace_id: "22222222-2222-4222-8222-222222222222", test_version_id: versionId, status }]);
    }
    if (path.endsWith("/study_responses")) {
      if (init?.method === "POST") {
        inserts++;
        saved = (JSON.parse(String(init.body)) as { response: Record<string, unknown> }).response;
        return Response.json([{ id: responseId }], { status: 201 });
      }
      return Response.json(saved ? [{ id: responseId, block_id: blockId, response: saved }] : []);
    }
    throw new Error(`unexpected ${path}`);
  };
  const store = createMethodRunnerStore({ supabaseUrl: "https://example.supabase.co", secretKey: "server-secret", fetchImpl });
  const answer = { answers: { q1: "Checkout was confusing" } };
  await assert.rejects(store.submit(versionId, sessionId, blockId, answer), (error) => error instanceof MethodRunnerError && error.code === "data_request_failed");
  assert.equal(inserts, 1);
  assert.deepEqual(await store.submit(versionId, sessionId, blockId, answer), { responseId, completed: true });
  assert.equal(status, "completed");
  assert.equal(inserts, 1);
  await assert.rejects(store.submit(versionId, sessionId, blockId, { answers: { q1: "Changed" } }),
    (error) => error instanceof MethodRunnerError && error.code === "already_submitted");
});
