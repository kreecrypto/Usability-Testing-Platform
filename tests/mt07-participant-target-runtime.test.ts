import assert from "node:assert/strict";
import test from "node:test";
import { resolveParticipantTargetRuntime, ParticipantTargetRuntimeError } from "../src/lib/runner/participant-target-runtime.ts";
import type { PublicRunnerTarget } from "../src/lib/runner/public-target.ts";

function target(overrides: Partial<PublicRunnerTarget>): PublicRunnerTarget {
  return Object.freeze({
    provider: "external_web",
    sourceUrl: "https://example.com/task",
    launchMode: "new_tab",
    embedUrl: null,
    startScreenId: null,
    instrumentation: "none",
    liveEmbedUrl: null,
    ...overrides,
  }) as PublicRunnerTarget;
}

test("Figma runner requires configured live Embed API URL", () => {
  assert.throws(
    () => resolveParticipantTargetRuntime(target({
      provider: "figma_prototype",
      launchMode: "embed",
      embedUrl: "https://embed.figma.com/proto/file",
      startScreenId: "1:2",
      instrumentation: "figma_embed_api",
    })),
    (error) => error instanceof ParticipantTargetRuntimeError && error.code === "target_runtime_unavailable",
  );

  const runtime = resolveParticipantTargetRuntime(target({
    provider: "figma_prototype",
    launchMode: "embed",
    embedUrl: "https://embed.figma.com/proto/file",
    liveEmbedUrl: "https://embed.figma.com/proto/file?client-id=qa",
    startScreenId: "1:2",
    instrumentation: "figma_embed_api",
  }));
  assert.equal(runtime.renderMode, "iframe");
  assert.equal(runtime.requiresProviderReadySignal, true);
});

test("owned web embed uses its approved URL without inventing a provider-ready signal", () => {
  const runtime = resolveParticipantTargetRuntime(target({
    provider: "first_party_web",
    launchMode: "embed",
    embedUrl: "https://owned.example.test/checkout",
    sourceUrl: "https://owned.example.test/checkout",
    instrumentation: "first_party_bridge",
  }));
  assert.equal(runtime.renderMode, "iframe");
  assert.equal(runtime.launchUrl, "https://owned.example.test/checkout");
  assert.equal(runtime.instrumentation, "first_party_bridge");
  assert.equal(runtime.requiresProviderReadySignal, false);
});

test("external new-tab target stays evidence-free when no cooperative bridge exists", () => {
  const runtime = resolveParticipantTargetRuntime(target({}));
  assert.equal(runtime.renderMode, "external_window");
  assert.equal(runtime.launchUrl, "https://example.com/task");
  assert.equal(runtime.instrumentation, "none");
  assert.equal(runtime.requiresProviderReadySignal, false);
});

test("external cooperative bridge is preserved but not upgraded beyond snapshot capability", () => {
  const runtime = resolveParticipantTargetRuntime(target({ instrumentation: "cooperative_bridge" }));
  assert.equal(runtime.instrumentation, "cooperative_bridge");
  assert.equal(runtime.renderMode, "external_window");
});
