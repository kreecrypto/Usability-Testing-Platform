import assert from "node:assert/strict";
import test from "node:test";
import { publicTargetFromSnapshot } from "../src/lib/runner/public-target.ts";
import { RunnerTargetAdapterError } from "../src/lib/runner/target-adapter.ts";

const capabilities = Object.freeze({ access: "Available" });

test("public runner preserves Figma live embed client configuration without changing immutable source", () => {
  const target = publicTargetFromSnapshot({
    provider: "figma_prototype",
    sourceUrl: "https://www.figma.com/proto/abc/demo",
    launchMode: "embed",
    capabilities,
    providerConfig: { embedUrl: "https://embed.figma.com/proto/abc/demo", startNodeId: "1:2" },
    snapshotVersion: 1,
  }, "client-123");
  assert.equal(target.provider, "figma_prototype");
  assert.equal(target.startScreenId, "1:2");
  assert.equal(target.liveEmbedUrl, "https://embed.figma.com/proto/abc/demo?client-id=client-123");
});

test("public runner exposes owned web adapter without inventing Figma fields", () => {
  const target = publicTargetFromSnapshot({
    provider: "first_party_web",
    sourceUrl: "https://uat.example.com/checkout",
    launchMode: "same_tab",
    capabilities,
    providerConfig: { origin: "https://uat.example.com" },
    snapshotVersion: 1,
  }, null);
  assert.equal(target.instrumentation, "first_party_bridge");
  assert.equal(target.embedUrl, null);
  assert.equal(target.startScreenId, null);
  assert.equal(target.liveEmbedUrl, null);
});

test("public runner keeps external target evidence fail closed without cooperative bridge", () => {
  const target = publicTargetFromSnapshot({
    provider: "external_web",
    sourceUrl: "https://example.org/",
    launchMode: "new_tab",
    capabilities,
    providerConfig: { cooperativeBridge: false },
    snapshotVersion: 1,
  }, null);
  assert.equal(target.instrumentation, "none");
  assert.equal(target.liveEmbedUrl, null);
});

test("public runner rejects unsupported target snapshots", () => {
  assert.throws(() => publicTargetFromSnapshot({
    provider: "external_web",
    sourceUrl: "https://example.org/",
    launchMode: "unsupported",
    capabilities,
    providerConfig: {},
    snapshotVersion: 1,
  }, null), (error: unknown) => error instanceof RunnerTargetAdapterError && error.code === "target_unsupported");
});
