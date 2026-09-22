import assert from "node:assert/strict";
import test from "node:test";
import { resolveRunnerTargetAdapter, RunnerTargetAdapterError } from "../src/lib/runner/target-adapter.ts";

const capabilities = Object.freeze({ access: "Available" });

test("runner resolves Figma from immutable target snapshot", () => {
  const adapter = resolveRunnerTargetAdapter({ provider: "figma_prototype", sourceUrl: "https://www.figma.com/proto/abc/demo", launchMode: "embed", capabilities, providerConfig: { embedUrl: "https://embed.figma.com/proto/abc/demo", startNodeId: "1:2" }, snapshotVersion: 1 });
  assert.equal(adapter.provider, "figma_prototype");
  assert.equal(adapter.instrumentation, "figma_embed_api");
  assert.equal(adapter.startScreenId, "1:2");
});

test("runner resolves owned web to first-party bridge", () => {
  const adapter = resolveRunnerTargetAdapter({ provider: "first_party_web", sourceUrl: "https://uat.example.com/checkout", launchMode: "same_tab", capabilities, providerConfig: { origin: "https://uat.example.com" }, snapshotVersion: 1 });
  assert.equal(adapter.provider, "first_party_web");
  assert.equal(adapter.instrumentation, "first_party_bridge");
  assert.equal(adapter.embedUrl, null);
});

test("external website without cooperative bridge never fabricates instrumentation", () => {
  const adapter = resolveRunnerTargetAdapter({ provider: "external_web", sourceUrl: "https://example.org/", launchMode: "new_tab", capabilities, providerConfig: { cooperativeBridge: false }, snapshotVersion: 1 });
  assert.equal(adapter.provider, "external_web");
  assert.equal(adapter.instrumentation, "none");
  assert.equal(adapter.embedUrl, null);
});

test("external website may use explicit cooperative bridge only", () => {
  const adapter = resolveRunnerTargetAdapter({ provider: "external_web", sourceUrl: "https://partner.example.org/", launchMode: "embed", capabilities, providerConfig: { cooperativeBridge: true }, snapshotVersion: 1 });
  assert.equal(adapter.instrumentation, "cooperative_bridge");
  assert.equal(adapter.embedUrl, "https://partner.example.org/");
});

test("unsupported launch fails closed", () => {
  assert.throws(() => resolveRunnerTargetAdapter({ provider: "external_web", sourceUrl: "https://blocked.example.org/", launchMode: "unsupported", capabilities, providerConfig: {}, snapshotVersion: 1 }), (error: unknown) => error instanceof RunnerTargetAdapterError && error.code === "target_unsupported");
});
