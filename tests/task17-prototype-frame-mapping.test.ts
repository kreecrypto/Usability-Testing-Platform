import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrototypeFrameMapping,
  createPrototypeFrameMappingPersistence,
  FrameMappingProviderError,
  FrameMappingValidationError,
} from "../src/lib/figma/frame-mapping.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const testVersionId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";
const prototypeUrl = "https://www.figma.com/proto/AbC123xyz/Checkout?node-id=5-3&starting-point-node-id=10%3A20";

test("builds explicit mapping and derives the start target from the public prototype URL", () => {
  const mapping = buildPrototypeFrameMapping({
    prototypeUrl,
    successNodeIds: ["20-30", "20:31"],
    failureNodeIds: ["40-50"],
  });

  assert.deepEqual(mapping, {
    version: 1,
    source: "explicit_node_ids",
    prototypeUrl,
    fileKey: "AbC123xyz",
    startNodeId: "10:20",
    successNodeIds: ["20:30", "20:31"],
    failureNodeIds: ["40:50"],
  });
});

test("allows an explicit canonical start target to override the URL start point", () => {
  const mapping = buildPrototypeFrameMapping({
    prototypeUrl,
    startNodeId: "99-100",
    successNodeIds: ["20-30"],
    failureNodeIds: ["40-50"],
  });

  assert.equal(mapping.startNodeId, "99:100");
});

test("fails closed when no start target can be derived", () => {
  assert.throws(
    () => buildPrototypeFrameMapping({
      prototypeUrl: "https://www.figma.com/proto/AbC123xyz/Checkout",
      successNodeIds: ["20-30"],
      failureNodeIds: ["40-50"],
    }),
    (error: unknown) => error instanceof FrameMappingValidationError && error.field === "startNodeId",
  );
});

test("rejects malformed and duplicate explicit targets", () => {
  assert.throws(
    () => buildPrototypeFrameMapping({
      prototypeUrl,
      successNodeIds: ["not-a-node"],
      failureNodeIds: ["40-50"],
    }),
    (error: unknown) => error instanceof FrameMappingValidationError && error.field === "successNodeIds[0]",
  );

  assert.throws(
    () => buildPrototypeFrameMapping({
      prototypeUrl,
      successNodeIds: ["20-30", "20:30"],
      failureNodeIds: ["40-50"],
    }),
    (error: unknown) => error instanceof FrameMappingValidationError && error.field === "successNodeIds",
  );
});

test("persists the mapping through one authenticated atomic RPC call", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  const store = createPrototypeFrameMappingPersistence({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-test-key",
    accessToken: "user-access-token",
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const mapping = await store.save({
    workspaceId,
    testVersionId,
    taskId,
    prototypeUrl,
    successNodeIds: ["20-30"],
    failureNodeIds: ["40-50"],
  });

  assert.equal(capturedUrl, "https://example.supabase.co/rest/v1/rpc/save_figma_frame_mapping");
  assert.equal(capturedInit?.method, "POST");
  assert.equal((capturedInit?.headers as Record<string, string>).authorization, "Bearer user-access-token");
  assert.equal((capturedInit?.headers as Record<string, string>).apikey, "anon-test-key");

  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    p_workspace_id: workspaceId,
    p_test_version_id: testVersionId,
    p_task_id: taskId,
    p_prototype_url: prototypeUrl,
    p_file_key: "AbC123xyz",
    p_start_node_id: "10:20",
    p_success_node_ids: ["20:30"],
    p_failure_node_ids: ["40:50"],
  });
  assert.equal(mapping.startNodeId, "10:20");
});

test("keeps provider failure details server-side while preserving the provider error code", async () => {
  const store = createPrototypeFrameMappingPersistence({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-test-key",
    accessToken: "user-access-token",
    fetchImpl: async () => new Response(JSON.stringify({ code: "42501", message: "sensitive provider detail" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }),
  });

  await assert.rejects(
    () => store.save({
      workspaceId,
      testVersionId,
      taskId,
      prototypeUrl,
      successNodeIds: ["20-30"],
      failureNodeIds: ["40-50"],
    }),
    (error: unknown) => error instanceof FrameMappingProviderError && error.status === 403 && error.code === "42501",
  );
});
