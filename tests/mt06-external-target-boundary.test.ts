import assert from "node:assert/strict";
import test from "node:test";
import { resolveExternalTargetBoundary } from "../src/lib/web/external-target-boundary.ts";

test("unknown or blocked embedding falls back to new tab and hides behavioral metrics", () => {
  const boundary = resolveExternalTargetBoundary({});
  assert.equal(boundary.launchMode, "new_tab");
  assert.equal(boundary.capabilities.launch, "available");
  assert.equal(boundary.capabilities.embed, "unsupported");
  assert.equal(boundary.capabilities.pointerInteraction, "unsupported");
  assert.equal(boundary.capabilities.scroll, "unsupported");
  assert.equal(boundary.capabilities.heatmap, "unsupported");
});

test("iframe availability alone never grants cross-origin DOM or click evidence", () => {
  const boundary = resolveExternalTargetBoundary({ iframeAllowed: true });
  assert.equal(boundary.launchMode, "embed");
  assert.equal(boundary.capabilities.embed, "available");
  assert.equal(boundary.capabilities.screenView, "unsupported");
  assert.equal(boundary.capabilities.pointerInteraction, "unsupported");
  assert.equal(boundary.capabilities.heatmap, "unsupported");
});

test("explicit cooperative bridge is required for rich external behavior evidence", () => {
  const boundary = resolveExternalTargetBoundary({ iframeAllowed: true, cooperativeBridge: true });
  assert.equal(boundary.capabilities.screenView, "available");
  assert.equal(boundary.capabilities.pointerInteraction, "available");
  assert.equal(boundary.capabilities.scroll, "available");
  assert.equal(boundary.capabilities.heatmap, "available");
});
