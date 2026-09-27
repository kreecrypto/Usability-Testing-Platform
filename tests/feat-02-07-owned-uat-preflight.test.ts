import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

import { createDraftPrototypeStore, PrototypeImportError } from "../src/lib/builder/prototype-import.ts";
import { approveConfiguredFirstPartyTarget, preflightTestTarget } from "../src/lib/builder/test-target-import.ts";

const testId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const versionId = "33333333-3333-4333-8333-333333333333";
const target = preflightTestTarget({ url: "https://uat.example.com/checkout?campaign=test", ownership: "owned", environment: "uat" });

test("configured approval requires an exact HTTPS origin and keeps other owned targets blocked", () => {
  assert.equal(target.capabilities.publishBlocked, true);
  const approved = approveConfiguredFirstPartyTarget(target, ["https://other.example.com", "https://uat.example.com"]);
  assert.equal(approved.capabilities.publishBlocked, false);
  assert.equal(approved.launchMode, "new_tab");
  assert.equal(approved.providerConfig.origin, "https://uat.example.com");
  assert.throws(() => approveConfiguredFirstPartyTarget(target, ["https://uat.example.com.evil.test"]), /preflight_verification_failed/);
  assert.throws(() => approveConfiguredFirstPartyTarget(target, ["http://uat.example.com"]), /preflight_verification_failed/);
  assert.throws(() => approveConfiguredFirstPartyTarget(target, ["https://uat.example.com/checkout"]), /preflight_verification_failed/);
});

function storeWithTarget(responseHeaders: Record<string, string>, allowedOrigins: readonly string[]) {
  const calls: string[] = [];
  const row = {
    id: versionId, workspace_id: workspaceId, test_id: testId, version_no: 1,
    lifecycle_status: "draft", target_provider: "first_party_web", target_snapshot: target,
    figma_file_key: null, figma_start_node_id: null, prototype_mapping: {},
  };
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/rest/v1/tests?")) return new Response(JSON.stringify([{ id: testId, workspace_id: workspaceId }]));
    if (url.includes("/rest/v1/test_versions?")) {
      const payload = init?.method === "PATCH" ? JSON.parse(String(init.body)) as { target_snapshot: unknown } : null;
      return new Response(JSON.stringify([{ ...row, ...(payload ? { target_snapshot: payload.target_snapshot } : {}) }]));
    }
    if (url.startsWith("https://uat.example.com/checkout")) {
      return new Response("<!doctype html><title>UAT</title>", { status: 200, headers: responseHeaders });
    }
    throw new Error("unexpected fetch");
  };
  return {
    calls,
    store: createDraftPrototypeStore({
      supabaseUrl: "https://example.supabase.co", publicKey: "public-key", accessToken: "researcher-jwt",
      approvedTargetOrigins: allowedOrigins, fetchImpl,
    }),
  };
}

test("live UAT preflight upgrades a draft only after allowlist and bridge header verification", async () => {
  const { store, calls } = storeWithTarget({ "content-type": "text/html", "x-utp-first-party-bridge": "first-party-web-v1" }, ["https://uat.example.com"]);
  const approved = await store.preflightDraft(testId, "https://utp.example.com");
  assert.equal(approved.target.capabilities.publishBlocked, false);
  assert.equal(approved.target.providerConfig.bridgeVersion, "first-party-web-v1");
  assert.equal(calls.filter((url) => url.startsWith("https://uat.example.com/")).length, 1);
});

test("unapproved origins are never fetched and missing bridge headers fail closed", async () => {
  const blocked = storeWithTarget({ "content-type": "text/html", "x-utp-first-party-bridge": "first-party-web-v1" }, []);
  await assert.rejects(() => blocked.store.preflightDraft(testId, "https://utp.example.com"),
    (error: unknown) => error instanceof PrototypeImportError && error.message === "approved_owned_target_required");
  assert.equal(blocked.calls.some((url) => url.startsWith("https://uat.example.com/")), false);

  const missingHeader = storeWithTarget({ "content-type": "text/html" }, ["https://uat.example.com"]);
  await assert.rejects(() => missingHeader.store.preflightDraft(testId, "https://utp.example.com"),
    (error: unknown) => error instanceof PrototypeImportError && error.message === "approved_bridge_not_verified");
});

test("installable bridge emits only to the configured opener after start and omits query values", () => {
  const messages: Array<{ payload: Record<string, unknown>; origin: string }> = [];
  const listeners = new Map<string, (event: unknown) => void>();
  const fakeWindow = {
    opener: { closed: false, postMessage: (payload: Record<string, unknown>, origin: string) => messages.push({ payload, origin }) },
    location: { origin: "https://uat.example.com", pathname: "/checkout", search: "?email=private@example.com" },
    innerWidth: 100, innerHeight: 200, scrollX: 0, scrollY: 50,
    addEventListener: (name: string, handler: (event: unknown) => void) => { listeners.set(name, handler); },
    requestAnimationFrame: (handler: () => void) => handler(),
  } as Record<string, unknown>;
  const fakeDocument = {
    documentElement: { scrollWidth: 100, scrollHeight: 500 },
    addEventListener: (name: string, handler: (event: unknown) => void) => { listeners.set(name, handler); },
  };
  const source = readFileSync(new URL("../public/utp-first-party-bridge-v1.js", import.meta.url), "utf8");
  runInNewContext(source, { window: fakeWindow, document: fakeDocument, URL, Element: class {} });
  const bridge = fakeWindow.UTPFirstPartyBridge as { start: (options: unknown) => boolean; setScreen: (id: string) => boolean; completionSignal: (id: string) => boolean };
  assert.equal(messages.length, 0);
  assert.equal(bridge.start({ utpOrigin: "https://utp.example.com", screenId: "checkout:start" }), true);
  assert.deepEqual(messages.map((item) => item.payload.type), ["ready", "screen_view"]);
  assert.equal(messages[1]?.payload.data && (messages[1].payload.data as Record<string, unknown>).url, "https://uat.example.com/checkout");
  assert.equal(messages.every((item) => item.origin === "https://utp.example.com"), true);
  bridge.setScreen("checkout:review");
  bridge.completionSignal("checkout-complete");
  assert.deepEqual(messages.slice(2).map((item) => item.payload.type), ["screen_view", "completion_signal"]);
  assert.equal(JSON.stringify(messages).includes("private@example.com"), false);
});
