import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPublishVersioningStore } from "../src/lib/builder/publish-versioning.ts";

const TEST_ID = "10000000-0000-4000-8000-000000000001";
const VERSION_ID = "20000000-0000-4000-8000-000000000002";
const TASK_ID = "40000000-0000-4000-8000-000000000004";
const sourceUrl = "https://www.figma.com/proto/file-key/Flow?node-id=10-20";
const draftVersion = {
  id: VERSION_ID, test_id: TEST_ID, version_no: 3, lifecycle_status: "draft", figma_file_key: "file-key", figma_start_node_id: "10:20",
  target_provider: "figma_prototype",
  target_snapshot: { provider: "figma_prototype", sourceUrl, environment: null, launchMode: "embed", capabilities: {}, providerConfig: { fileKey: "file-key", startNodeId: "10:20" }, snapshotVersion: 1 },
  prototype_mapping: { schemaVersion: 1, provider: "figma", sourceUrl, embedUrl: "https://www.figma.com/embed?embed_host=share&url=x", fileKey: "file-key", nodeId: "10:20" },
};
const taskRow = { id: TASK_ID, ordinal: 1, title: "Complete checkout", scenario: "Buy the item", instruction: "Start from the cart", expected_path: ["10:20", "10:30"], success_rule: { targetNodeIds: ["10:30"] }, failure_rule: { targetNodeIds: ["10:99"] }, timeout_seconds: 120, post_task_questions: { seq: { enabled: true, required: true }, open_feedback: { enabled: true, required: false } } };

function storeWithResponses(responses: Response[], calls: Array<{ url: string; init?: RequestInit }>) {
  let index = 0;
  return createPublishVersioningStore({ supabaseUrl: "https://example.supabase.co", publicKey: "sb_publishable_test", accessToken: "user-jwt", fetchImpl: async (input, init) => { calls.push({ url: String(input), init }); return responses[index++] ?? Response.json({ message: "unexpected" }, { status: 500 }); } });
}

test("preview resolves provider-neutral immutable target snapshot in deterministic task order", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = storeWithResponses([Response.json([draftVersion]), Response.json([taskRow])], calls);
  const preview = await store.preview(TEST_ID);
  assert.equal(preview.testVersionId, VERSION_ID); assert.equal(preview.versionNo, 3);
  assert.equal(preview.target.provider, "figma_prototype"); assert.equal(preview.target.sourceUrl, sourceUrl);
  assert.equal(preview.target.providerConfig.startNodeId, "10:20"); assert.equal(preview.tasks[0].title, "Complete checkout");
  assert.deepEqual(preview.tasks[0].expectedPath, ["10:20", "10:30"]); assert.match(calls[0].url, /order=version_no\.desc/); assert.match(calls[1].url, /order=ordinal\.asc/);
  const headers = calls[0].init?.headers as Record<string, string>; assert.equal(headers.authorization, "Bearer user-jwt"); assert.equal(headers.apikey, "sb_publishable_test"); assert.doesNotMatch(JSON.stringify(calls), /service_role/i);
});

test("legacy Figma history remains readable through compatibility adapter", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const legacy = { ...draftVersion, target_provider: null, target_snapshot: null };
  const preview = await storeWithResponses([Response.json([legacy]), Response.json([taskRow])], calls).preview(TEST_ID);
  assert.equal(preview.target.provider, "figma_prototype"); assert.equal(preview.target.sourceUrl, sourceUrl); assert.equal(preview.target.providerConfig.startNodeId, "10:20");
});

test("publish and edit-after-publish use atomic database RPC boundaries", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []; const published = { ...draftVersion, lifecycle_status: "published" as const }; const nextDraft = { ...draftVersion, id: "50000000-0000-4000-8000-000000000005", version_no: 4 };
  const store = storeWithResponses([Response.json(VERSION_ID), Response.json([published]), Response.json([taskRow]), Response.json(nextDraft.id), Response.json([nextDraft]), Response.json([taskRow])], calls);
  assert.equal((await store.publish(TEST_ID)).lifecycleStatus, "published"); const draftPreview = await store.createDraftFromPublished(TEST_ID); assert.equal(draftPreview.lifecycleStatus, "draft"); assert.equal(draftPreview.versionNo, 4);
  assert.match(calls[0].url, /rpc\/publish_draft_test_version/); assert.match(calls[3].url, /rpc\/create_draft_from_published/); assert.equal(calls[0].init?.method, "POST"); assert.equal(calls[3].init?.method, "POST");
});

test("MT-03 migration adds canonical target snapshot, backfills Figma and preserves immutability", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260921155500_mt03_provider_neutral_target_snapshot.sql", import.meta.url), "utf8");
  assert.match(migration, /target_provider/i); assert.match(migration, /target_snapshot/i); assert.match(migration, /figma_prototype/i); assert.match(migration, /prototype_mapping\s*->>\s*'sourceUrl'/i);
  assert.match(migration, /publishable_target_snapshot_required/i); assert.match(migration, /create_draft_from_published/i); assert.match(migration, /grant execute[\s\S]*authenticated/i); assert.match(migration, /revoke all[\s\S]*anon/i);
});

test("review/publish API keeps user JWT + RLS boundary and exposes no service role", async () => {
  const route = await readFile(new URL("../src/app/api/tests/[testId]/publish/route.ts", import.meta.url), "utf8"); assert.match(route, /accessTokenFromRequest/); assert.match(route, /publicSupabaseConfig/); assert.match(route, /createPublishVersioningStore/); assert.match(route, /invalid_action/); assert.match(route, /cache-control/); assert.doesNotMatch(route, /service_role/i);
});
