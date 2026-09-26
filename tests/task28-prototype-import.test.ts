import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDraftPrototypeStore, PrototypeImportError, validatePrototypeImport } from "../src/lib/builder/prototype-import.ts";

const TEST_ID = "10000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "20000000-0000-4000-8000-000000000002";
const DRAFT_ID = "30000000-0000-4000-8000-000000000003";
const PROTOTYPE_URL = "https://www.figma.com/proto/AbCd1234/Checkout?node-id=5-3&starting-point-node-id=5-3";
const figmaTarget = () => validatePrototypeImport(PROTOTYPE_URL);

test("prototype URL validation preserves public source and canonicalizes Figma node ids", () => {
  const target = figmaTarget(); const config = target.providerConfig;
  assert.equal(target.provider, "figma_prototype"); assert.equal(config.fileKey, "AbCd1234"); assert.equal(config.nodeId, "5:3"); assert.equal(config.startNodeId, "5:3");
  assert.match(String(config.embedUrl), /^https:\/\/embed\.figma\.com\/proto\/AbCd1234\//); assert.match(String(config.embedUrl), /embed-host=ut-platform-v1/);
});

test("generic URL validation accepts external web but rejects invalid/non-prototype Figma targets", () => {
  const external = validatePrototypeImport("https://example.com/proto/AbCd1234/Foo");
  assert.equal(external.provider, "external_web");
  assert.equal(external.sourceUrl, "https://example.com/proto/AbCd1234/Foo");
  assert.throws(() => validatePrototypeImport("https://www.figma.com/design/AbCd1234/Foo"), (error: unknown) => error instanceof PrototypeImportError && error.code === "invalid_prototype_url");
  assert.throws(() => validatePrototypeImport("javascript:alert(1)"), (error: unknown) => error instanceof PrototypeImportError && error.code === "invalid_prototype_url");
});

test("saveDraft creates only a draft test version using the authenticated user JWT and existing RLS boundary", async () => {
  const target = figmaTarget(); const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [Response.json([{ id: TEST_ID, workspace_id: WORKSPACE_ID }]), Response.json([]), Response.json([]), Response.json([{ id: DRAFT_ID, workspace_id: WORKSPACE_ID, test_id: TEST_ID, version_no: 1, lifecycle_status: "draft", target_provider: target.provider, target_snapshot: target, figma_file_key: "AbCd1234", figma_start_node_id: "5:3", prototype_mapping: { schemaVersion: 1, provider: "figma", sourceUrl: PROTOTYPE_URL } }])];
  let index = 0; const fetchImpl: typeof fetch = async (input, init) => { calls.push({ url: String(input), init }); return responses[index++] ?? Response.json([], { status: 500 }); };
  const store = createDraftPrototypeStore({ supabaseUrl: "https://example.supabase.co", publicKey: "sb_publishable_test", accessToken: "user-jwt", fetchImpl });
  const saved = await store.saveDraft(TEST_ID, { url: PROTOTYPE_URL });
  assert.equal(saved.versionNo, 1); assert.equal(saved.target.provider, "figma_prototype"); assert.equal(saved.target.providerConfig.fileKey, "AbCd1234"); assert.equal(calls.length, 4);
  for (const call of calls) { const headers = call.init?.headers as Record<string, string>; assert.equal(headers.authorization, "Bearer user-jwt"); assert.equal(headers.apikey, "sb_publishable_test"); assert.equal(JSON.stringify(call.init).includes("service_role"), false); }
  const create = calls[3]; assert.equal(create.init?.method, "POST"); const body = JSON.parse(String(create.init?.body));
  assert.equal(body.lifecycle_status, "draft"); assert.equal(body.target_provider, "figma_prototype"); assert.equal(body.target_snapshot.provider, "figma_prototype"); assert.equal(body.provider, "figma"); assert.equal(body.figma_file_key, "AbCd1234"); assert.equal(body.figma_start_node_id, "5:3"); assert.equal(body.figma_version_id, null); assert.equal(body.prototype_mapping.sourceUrl, PROTOTYPE_URL);
});

test("saveDraft updates an existing draft instead of mutating a published version", async () => {
  const target = figmaTarget(); const calls: Array<{ url: string; init?: RequestInit }> = [];
  const existing = { id: DRAFT_ID, workspace_id: WORKSPACE_ID, test_id: TEST_ID, version_no: 2, lifecycle_status: "draft", target_provider: "figma_prototype", target_snapshot: target, figma_file_key: "Old123", figma_start_node_id: "1:1", prototype_mapping: {} };
  const updated = { ...existing, target_snapshot: target, figma_file_key: "AbCd1234", figma_start_node_id: "5:3" };
  const responses = [Response.json([{ id: TEST_ID, workspace_id: WORKSPACE_ID }]), Response.json([existing]), Response.json([updated])]; let index = 0;
  const fetchImpl: typeof fetch = async (input, init) => { calls.push({ url: String(input), init }); return responses[index++] ?? Response.json([], { status: 500 }); };
  const store = createDraftPrototypeStore({ supabaseUrl: "https://example.supabase.co", publicKey: "sb_publishable_test", accessToken: "user-jwt", fetchImpl });
  const saved = await store.saveDraft(TEST_ID, { url: PROTOTYPE_URL }); assert.equal(saved.versionNo, 2); assert.equal(saved.target.provider, "figma_prototype"); assert.equal(calls.length, 3); assert.match(calls[1].url, /lifecycle_status=eq\.draft/); assert.match(calls[2].url, /lifecycle_status=eq\.draft/); assert.equal(calls[2].init?.method, "PATCH");
});

test("permission denial remains a sanitized authorization failure", async () => {
  const store = createDraftPrototypeStore({ supabaseUrl: "https://example.supabase.co", publicKey: "sb_publishable_test", accessToken: "user-jwt", fetchImpl: async () => Response.json({ provider: "detail" }, { status: 403 }) });
  await assert.rejects(() => store.saveDraft(TEST_ID, { url: PROTOTYPE_URL }), (error: unknown) => error instanceof PrototypeImportError && error.code === "permission_denied" && error.status === 403);
});

test("builder UI exposes provider-neutral preflight, save, accessibility and responsive states", async () => {
  const client = await readFile(new URL("../src/app/builder/[testId]/prototype/prototype-import-client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/builder/[testId]/prototype/prototype-import.module.css", import.meta.url), "utf8");
  assert.match(client, /Test Target URL/); assert.match(client, /Figma Prototype/); assert.match(client, /Owned Website/); assert.match(client, /External Website/); assert.match(client, /Environment/); assert.match(client, /Preflight & Preview/); assert.match(client, /Partial\/Unsupported/); assert.match(client, /title="พรีวิว Test Target"/); assert.match(client, /บันทึก Test Target/); assert.match(client, /role=\{state === "error" \? "alert" : "status"\}/); assert.match(client, /disabled=\{!target \|\| busy\}/); assert.match(css, /@media/); assert.match(css, /:focus-visible/);
});
