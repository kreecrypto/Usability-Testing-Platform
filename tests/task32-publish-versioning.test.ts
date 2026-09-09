import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPublishVersioningStore } from "../src/lib/builder/publish-versioning.ts";

const TEST_ID = "10000000-0000-4000-8000-000000000001";
const VERSION_ID = "20000000-0000-4000-8000-000000000002";
const TASK_ID = "40000000-0000-4000-8000-000000000004";

const draftVersion = {
  id: VERSION_ID,
  test_id: TEST_ID,
  version_no: 3,
  lifecycle_status: "draft",
  figma_file_key: "file-key",
  figma_start_node_id: "10:20",
  prototype_mapping: {
    schemaVersion: 1,
    provider: "figma",
    sourceUrl: "https://www.figma.com/proto/file-key/Flow?node-id=10-20",
    embedUrl: "https://www.figma.com/embed?embed_host=share&url=https%3A%2F%2Fwww.figma.com%2Fproto%2Ffile-key%2FFlow%3Fnode-id%3D10-20",
    fileKey: "file-key",
    nodeId: "10:20",
  },
};

const taskRow = {
  id: TASK_ID,
  ordinal: 1,
  title: "Complete checkout",
  scenario: "Buy the item",
  instruction: "Start from the cart",
  expected_path: ["10:20", "10:30"],
  success_rule: { targetNodeIds: ["10:30"] },
  failure_rule: { targetNodeIds: ["10:99"] },
  timeout_seconds: 120,
  post_task_questions: {
    seq: { enabled: true, required: true },
    open_feedback: { enabled: true, required: false },
  },
};

function storeWithResponses(responses: Response[], calls: Array<{ url: string; init?: RequestInit }>) {
  let index = 0;
  return createPublishVersioningStore({
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
    accessToken: "user-jwt",
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return responses[index++] ?? Response.json({ message: "unexpected" }, { status: 500 });
    },
  });
}

test("preview resolves one exact immutable internal snapshot in deterministic task order", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = storeWithResponses([
    Response.json([draftVersion]),
    Response.json([taskRow]),
  ], calls);

  const preview = await store.preview(TEST_ID);
  assert.equal(preview.testVersionId, VERSION_ID);
  assert.equal(preview.versionNo, 3);
  assert.equal(preview.sourceUrl, draftVersion.prototype_mapping.sourceUrl);
  assert.equal(preview.startNodeId, "10:20");
  assert.equal(preview.tasks[0].title, "Complete checkout");
  assert.deepEqual(preview.tasks[0].expectedPath, ["10:20", "10:30"]);
  assert.match(calls[0].url, /order=version_no\.desc/);
  assert.match(calls[1].url, /order=ordinal\.asc/);
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer user-jwt");
  assert.equal(headers.apikey, "sb_publishable_test");
  assert.doesNotMatch(JSON.stringify(calls), /service_role/i);
});

test("publish and edit-after-publish use atomic database RPC boundaries", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const published = { ...draftVersion, lifecycle_status: "published" as const };
  const nextDraft = { ...draftVersion, id: "50000000-0000-4000-8000-000000000005", version_no: 4 };
  const store = storeWithResponses([
    Response.json(VERSION_ID),
    Response.json([published]),
    Response.json([taskRow]),
    Response.json(nextDraft.id),
    Response.json([nextDraft]),
    Response.json([taskRow]),
  ], calls);

  const publishedPreview = await store.publish(TEST_ID);
  assert.equal(publishedPreview.lifecycleStatus, "published");
  const draftPreview = await store.createDraftFromPublished(TEST_ID);
  assert.equal(draftPreview.lifecycleStatus, "draft");
  assert.equal(draftPreview.versionNo, 4);
  assert.match(calls[0].url, /rpc\/publish_draft_test_version/);
  assert.match(calls[3].url, /rpc\/create_draft_from_published/);
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[3].init?.method, "POST");
});

test("Task32 migration removes REST version-id requirement and freezes published version plus task rows", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260909100000_task32_publish_versioning.sql", import.meta.url), "utf8");
  assert.match(migration, /prototype_mapping\s*->>\s*'sourceUrl'/i);
  assert.match(migration, /prototype_mapping\s*->>\s*'embedUrl'/i);
  assert.match(migration, /figma_start_node_id is not null/i);
  assert.match(migration, /figma_version_id\s*=\s*null/i);
  assert.match(migration, /published_test_version_is_immutable/i);
  assert.match(migration, /published_test_version_tasks_are_immutable/i);
  assert.match(migration, /publish_draft_test_version/i);
  assert.match(migration, /create_draft_from_published/i);
  assert.match(migration, /post_task_questions/i);
  assert.match(migration, /grant execute[\s\S]*authenticated/i);
  assert.match(migration, /revoke all[\s\S]*anon/i);
});

test("review/publish API keeps user JWT + RLS boundary and exposes no service role", async () => {
  const route = await readFile(new URL("../src/app/api/tests/[testId]/publish/route.ts", import.meta.url), "utf8");
  assert.match(route, /accessTokenFromRequest/);
  assert.match(route, /publicSupabaseConfig/);
  assert.match(route, /createPublishVersioningStore/);
  assert.match(route, /invalid_action/);
  assert.match(route, /cache-control/);
  assert.doesNotMatch(route, /service_role/i);
});

test("review UI communicates exact version snapshot and edit-after-publish behavior", async () => {
  const client = await readFile(new URL("../src/app/builder/[testId]/review/review-publish-client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/builder/[testId]/review/review-publish.module.css", import.meta.url), "utf8");
  assert.match(client, /Exact public prototype/);
  assert.match(client, /Start node/);
  assert.match(client, /Internal version ID/);
  assert.match(client, /Publish immutable version/);
  assert.match(client, /Create editable draft/);
  assert.match(client, /Figma REST version metadata is not required/i);
  assert.match(client, /role="alert"/);
  assert.match(css, /@media/);
});
