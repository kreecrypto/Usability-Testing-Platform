import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createDraftPrototypeStore,
  PrototypeImportError,
  validatePrototypeImport,
} from "../src/lib/builder/prototype-import.ts";

const TEST_ID = "10000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "20000000-0000-4000-8000-000000000002";
const DRAFT_ID = "30000000-0000-4000-8000-000000000003";
const PROTOTYPE_URL = "https://www.figma.com/proto/AbCd1234/Checkout?node-id=5-3&starting-point-node-id=5-3";

test("prototype URL validation preserves public source and canonicalizes Figma node ids", () => {
  const prototype = validatePrototypeImport(PROTOTYPE_URL);
  assert.equal(prototype.provider, "figma");
  assert.equal(prototype.fileKey, "AbCd1234");
  assert.equal(prototype.nodeId, "5:3");
  assert.equal(prototype.startingPointNodeId, "5:3");
  assert.match(prototype.embedUrl, /^https:\/\/embed\.figma\.com\/proto\/AbCd1234\//);
  assert.match(prototype.embedUrl, /embed-host=ut-platform-v1/);
});

test("invalid/non-prototype URLs fail closed before persistence", () => {
  assert.throws(
    () => validatePrototypeImport("https://example.com/proto/AbCd1234/Foo"),
    (error: unknown) => error instanceof PrototypeImportError && error.code === "invalid_prototype_url" && error.status === 400,
  );
  assert.throws(
    () => validatePrototypeImport("https://www.figma.com/design/AbCd1234/Foo"),
    (error: unknown) => error instanceof PrototypeImportError && error.code === "invalid_prototype_url",
  );
});

test("saveDraft creates only a draft test version using the authenticated user JWT and existing RLS boundary", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    Response.json([{ id: TEST_ID, workspace_id: WORKSPACE_ID }]),
    Response.json([]),
    Response.json([]),
    Response.json([{
      id: DRAFT_ID,
      workspace_id: WORKSPACE_ID,
      test_id: TEST_ID,
      version_no: 1,
      lifecycle_status: "draft",
      figma_file_key: "AbCd1234",
      figma_start_node_id: "5:3",
      prototype_mapping: {
        schemaVersion: 1,
        provider: "figma",
        sourceUrl: PROTOTYPE_URL,
        embedUrl: "https://embed.figma.com/proto/AbCd1234/Checkout?node-id=5-3&starting-point-node-id=5-3&embed-host=ut-platform-v1",
        fileKey: "AbCd1234",
        nodeId: "5:3",
        startingPointNodeId: "5:3",
      },
    }]),
  ];
  let index = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return responses[index++] ?? Response.json([], { status: 500 });
  };
  const store = createDraftPrototypeStore({
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
    accessToken: "user-jwt",
    fetchImpl,
  });

  const saved = await store.saveDraft(TEST_ID, PROTOTYPE_URL);
  assert.equal(saved.versionNo, 1);
  assert.equal(saved.prototype.fileKey, "AbCd1234");
  assert.equal(calls.length, 4);
  for (const call of calls) {
    const headers = call.init?.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer user-jwt");
    assert.equal(headers.apikey, "sb_publishable_test");
    assert.equal(JSON.stringify(call.init).includes("service_role"), false);
  }

  const create = calls[3];
  assert.equal(create.init?.method, "POST");
  const body = JSON.parse(String(create.init?.body));
  assert.equal(body.lifecycle_status, "draft");
  assert.equal(body.provider, "figma");
  assert.equal(body.figma_file_key, "AbCd1234");
  assert.equal(body.figma_start_node_id, "5:3");
  assert.equal(body.figma_version_id, null);
  assert.equal(body.prototype_mapping.sourceUrl, PROTOTYPE_URL);
});

test("saveDraft updates an existing draft instead of mutating a published version", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const existing = {
    id: DRAFT_ID,
    workspace_id: WORKSPACE_ID,
    test_id: TEST_ID,
    version_no: 2,
    lifecycle_status: "draft",
    figma_file_key: "Old123",
    figma_start_node_id: "1:1",
    prototype_mapping: {},
  };
  const updated = {
    ...existing,
    figma_file_key: "AbCd1234",
    figma_start_node_id: "5:3",
    prototype_mapping: validatePrototypeImport(PROTOTYPE_URL),
  };
  const responses = [
    Response.json([{ id: TEST_ID, workspace_id: WORKSPACE_ID }]),
    Response.json([existing]),
    Response.json([updated]),
  ];
  let index = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return responses[index++] ?? Response.json([], { status: 500 });
  };
  const store = createDraftPrototypeStore({
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
    accessToken: "user-jwt",
    fetchImpl,
  });

  const saved = await store.saveDraft(TEST_ID, PROTOTYPE_URL);
  assert.equal(saved.versionNo, 2);
  assert.equal(calls.length, 3);
  assert.match(calls[1].url, /lifecycle_status=eq\.draft/);
  assert.match(calls[2].url, /lifecycle_status=eq\.draft/);
  assert.equal(calls[2].init?.method, "PATCH");
});

test("permission denial remains a sanitized authorization failure", async () => {
  const store = createDraftPrototypeStore({
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
    accessToken: "user-jwt",
    fetchImpl: async () => Response.json({ provider: "detail" }, { status: 403 }),
  });
  await assert.rejects(
    () => store.saveDraft(TEST_ID, PROTOTYPE_URL),
    (error: unknown) => error instanceof PrototypeImportError && error.code === "permission_denied" && error.status === 403,
  );
});

test("builder UI exposes Thai paste, validate, preview, save, accessibility and responsive states", async () => {
  const client = await readFile(new URL("../src/app/builder/[testId]/prototype/prototype-import-client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/builder/[testId]/prototype/prototype-import.module.css", import.meta.url), "utf8");
  assert.match(client, /URL ต้นแบบ Figma/);
  assert.match(client, /ตรวจสอบต้นแบบ/);
  assert.match(client, /title="พรีวิวต้นแบบ Figma"/);
  assert.match(client, /บันทึกต้นแบบ/);
  assert.match(client, /figma\.com\/proto/);
  assert.match(client, /role=\{state === "error" \? "alert" : "status"\}/);
  assert.match(client, /disabled=\{!prototype \|\| busy\}/);
  assert.match(css, /@media/);
  assert.match(css, /:focus-visible/);
});
