import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPrototypeFrameMapping,
  FrameMappingValidationError,
} from "../src/lib/figma/frame-mapping.ts";
import { createSuccessCriteriaReader } from "../src/lib/builder/success-criteria.ts";

const TEST_ID = "10000000-0000-4000-8000-000000000001";
const VERSION_ID = "20000000-0000-4000-8000-000000000002";
const WORKSPACE_ID = "30000000-0000-4000-8000-000000000003";
const TASK_ID = "40000000-0000-4000-8000-000000000004";
const PROTOTYPE_URL = "https://www.figma.com/proto/AbCd1234/Checkout?node-id=5-3";

test("disjoint start/success/failure targets are canonicalized and accepted", () => {
  const mapping = buildPrototypeFrameMapping({
    prototypeUrl: PROTOTYPE_URL,
    startNodeId: "5-3",
    successNodeIds: ["10-20", "10:21"],
    failureNodeIds: ["30-40"],
  });
  assert.equal(mapping.startNodeId, "5:3");
  assert.deepEqual(mapping.successNodeIds, ["10:20", "10:21"]);
  assert.deepEqual(mapping.failureNodeIds, ["30:40"]);
});

test("the same canonical node cannot be both success and failure", () => {
  assert.throws(
    () => buildPrototypeFrameMapping({
      prototypeUrl: PROTOTYPE_URL,
      startNodeId: "5:3",
      successNodeIds: ["10-20"],
      failureNodeIds: ["10:20"],
    }),
    (error: unknown) => error instanceof FrameMappingValidationError
      && error.field === "failureNodeIds"
      && /conflict/i.test(error.message),
  );
});

test("criteria reader supports Task17 prototypeUrl mapping and presented-node rules", async () => {
  const calls: string[] = [];
  const responses = [
    Response.json([{
      id: VERSION_ID,
      workspace_id: WORKSPACE_ID,
      test_id: TEST_ID,
      lifecycle_status: "draft",
      figma_start_node_id: "5:3",
      prototype_mapping: { prototypeUrl: PROTOTYPE_URL },
    }]),
    Response.json([{
      id: TASK_ID,
      workspace_id: WORKSPACE_ID,
      test_version_id: VERSION_ID,
      ordinal: 1,
      title: "Checkout",
      success_rule: { type: "presented_node", nodeIds: ["10:20"] },
      failure_rule: { type: "presented_node", nodeIds: ["30:40"] },
    }]),
  ];
  let index = 0;
  const reader = createSuccessCriteriaReader({
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
    accessToken: "user-jwt",
    fetchImpl: async (input, init) => {
      calls.push(String(input));
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers.authorization, "Bearer user-jwt");
      assert.equal(headers.apikey, "sb_publishable_test");
      return responses[index++] ?? Response.json([], { status: 500 });
    },
  });
  const draft = await reader.getDraft(TEST_ID);
  assert.equal(draft.prototypeUrl, PROTOTYPE_URL);
  assert.equal(draft.startNodeId, "5:3");
  assert.deepEqual(draft.tasks[0].successNodeIds, ["10:20"]);
  assert.deepEqual(draft.tasks[0].failureNodeIds, ["30:40"]);
  assert.equal(draft.tasks[0].editable, true);
  assert.match(calls[0], /lifecycle_status=eq\.draft/);
});

test("criteria reader also supports Task28 sourceUrl mapping and protects unknown rule types", async () => {
  const responses = [
    Response.json([{
      id: VERSION_ID,
      workspace_id: WORKSPACE_ID,
      test_id: TEST_ID,
      lifecycle_status: "draft",
      figma_start_node_id: "5:3",
      prototype_mapping: { sourceUrl: PROTOTYPE_URL },
    }]),
    Response.json([{
      id: TASK_ID,
      workspace_id: WORKSPACE_ID,
      test_version_id: VERSION_ID,
      ordinal: 1,
      title: "Checkout",
      success_rule: { type: "custom_unknown", expression: "provider-specific" },
      failure_rule: {},
    }]),
  ];
  let index = 0;
  const reader = createSuccessCriteriaReader({
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
    accessToken: "user-jwt",
    fetchImpl: async () => responses[index++] ?? Response.json([], { status: 500 }),
  });
  const draft = await reader.getDraft(TEST_ID);
  assert.equal(draft.prototypeUrl, PROTOTYPE_URL);
  assert.equal(draft.tasks[0].editable, false);
});

test("frame mapping route uses current authenticated session boundary", async () => {
  const route = await readFile(new URL("../src/app/api/tasks/[taskId]/frame-mapping/route.ts", import.meta.url), "utf8");
  assert.match(route, /accessTokenFromRequest/);
  assert.match(route, /publicSupabaseConfig/);
  assert.doesNotMatch(route, /service_role/i);
  assert.match(route, /FrameMappingValidationError/);
  assert.match(route, /message: error\.message/);
});

test("S14 editor exposes target selection, conflict validation, unsupported-rule protection and responsive accessibility states", async () => {
  const client = await readFile(new URL("../src/app/builder/[testId]/criteria/success-criteria-client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/builder/[testId]/criteria/success-criteria.module.css", import.meta.url), "utf8");
  assert.match(client, /Start target node ID/);
  assert.match(client, /Success target node IDs/);
  assert.match(client, /Failure target node IDs/);
  assert.match(client, /cannot be both success and failure/i);
  assert.match(client, /UNSUPPORTED RULE/);
  assert.match(client, /will not be overwritten automatically/i);
  assert.match(client, /Loading criteria/);
  assert.match(client, /No tasks are available/);
  assert.match(client, /Save criteria/);
  assert.match(client, /role="alert"/);
  assert.match(client, /role="status"/);
  assert.match(css, /@media/);
  assert.match(css, /:focus-visible/);
});
