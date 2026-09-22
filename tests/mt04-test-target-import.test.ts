import assert from "node:assert/strict";
import test from "node:test";
import { canPublishTarget, preflightTestTarget, TestTargetImportError } from "../src/lib/builder/test-target-import.ts";

test("classifies public Figma prototype and keeps publish blocked until live provider preflight", () => {
  const target = preflightTestTarget({ url: "https://www.figma.com/proto/AbCd1234/Checkout?node-id=5-3" });
  assert.equal(target.provider, "figma_prototype"); assert.equal(target.launchMode, "embed"); assert.equal(target.capabilities.pointer, "Available"); assert.equal(target.capabilities.scroll, "Unsupported"); assert.equal(target.capabilities.publishBlocked, true); assert.equal(canPublishTarget(target), false); assert.equal(target.providerConfig.fileKey, "AbCd1234");
});

test("classifies owned UAT/Production web only with explicit ownership + environment and fails closed pending instrumentation preflight", () => {
  const target = preflightTestTarget({ url: "https://uat.example.com/checkout#step", ownership: "owned", environment: "uat" });
  assert.equal(target.provider, "first_party_web"); assert.equal(target.environment, "uat"); assert.equal(target.sourceUrl, "https://uat.example.com/checkout"); assert.equal(target.capabilities.instrumentation, "Partial"); assert.equal(target.capabilities.publishBlocked, true); assert.equal(canPublishTarget(target), false);
  assert.throws(() => preflightTestTarget({ url: "https://prod.example.com", ownership: "owned" }), (error: unknown) => error instanceof TestTargetImportError && error.code === "ownership_confirmation_required");
});

test("external web defaults to safe new-tab fallback and never fabricates behavioral evidence", () => {
  const target = preflightTestTarget({ url: "https://example.org/product" });
  assert.equal(target.provider, "external_web"); assert.equal(target.launchMode, "new_tab"); assert.equal(target.capabilities.embed, "Unsupported"); assert.equal(target.capabilities.instrumentation, "Unsupported"); assert.equal(target.capabilities.screen, "Unsupported"); assert.equal(target.capabilities.path, "Unsupported"); assert.equal(target.capabilities.pointer, "Unsupported"); assert.equal(target.capabilities.coordinates, "Unsupported"); assert.equal(canPublishTarget(target), true);
});

test("verified iframe still fails closed for cross-origin evidence without cooperative bridge", () => {
  const target = preflightTestTarget({ url: "https://example.org/product", externalEmbed: "allowed" });
  assert.equal(target.launchMode, "embed"); assert.equal(target.capabilities.embed, "Available"); assert.equal(target.capabilities.screen, "Unsupported"); assert.equal(target.capabilities.pointer, "Unsupported");
});

test("cooperative bridge explicitly unlocks rich external evidence", () => {
  const target = preflightTestTarget({ url: "https://example.org/product", externalEmbed: "allowed", cooperativeBridge: true });
  assert.equal(target.capabilities.screen, "Available"); assert.equal(target.capabilities.path, "Available"); assert.equal(target.capabilities.pointer, "Available"); assert.equal(target.capabilities.scroll, "Available"); assert.equal(target.capabilities.coordinates, "Available");
});

test("invalid, non-http and non-prototype Figma targets fail closed", () => {
  assert.throws(() => preflightTestTarget({ url: "not-a-url" }), TestTargetImportError);
  assert.throws(() => preflightTestTarget({ url: "javascript:alert(1)" }), (error: unknown) => error instanceof TestTargetImportError && error.code === "unsupported_scheme");
  assert.throws(() => preflightTestTarget({ url: "https://www.figma.com/design/AbCd1234/Foo" }), (error: unknown) => error instanceof TestTargetImportError && error.code === "invalid_figma_prototype");
});
