import assert from "node:assert/strict";
import test from "node:test";

import {
  FIGMA_V1_CAPABILITIES,
  filterDisplayableFigmaV1Metrics,
  getFigmaV1MetricAvailability,
} from "../src/lib/figma/capabilities.ts";

test("declares only official emitted-event evidence as raw Figma V1 capabilities", () => {
  assert.deepEqual(FIGMA_V1_CAPABILITIES.pointer_interaction.providerEventTypes, ["MOUSE_PRESS_OR_RELEASE"]);
  assert.deepEqual(FIGMA_V1_CAPABILITIES.screen_view.providerEventTypes, ["PRESENTED_NODE_CHANGED"]);
  assert.deepEqual(FIGMA_V1_CAPABILITIES.component_state_changed.providerEventTypes, ["NEW_STATE"]);
  assert.equal(FIGMA_V1_CAPABILITIES.standalone_scroll.supported, false);
  assert.equal(FIGMA_V1_CAPABILITIES.raw_back.supported, false);
  assert.equal(FIGMA_V1_CAPABILITIES.raw_forward.supported, false);
  assert.deepEqual(FIGMA_V1_CAPABILITIES.technical_access_block.providerEventTypes, [
    "LOGIN_SCREEN_SHOWN",
    "PASSWORD_SCREEN_SHOWN",
  ]);
});

test("never exposes raw scroll/back/forward metrics without provider evidence", () => {
  for (const metric of ["scroll_count", "raw_back_count", "raw_forward_count"] as const) {
    const availability = getFigmaV1MetricAvailability(metric);
    assert.equal(availability.displayable, false);
    assert.ok(availability.reason.length > 0);
  }
});

test("keeps backtrack derived from screen path rather than claiming a raw back event", () => {
  const availability = getFigmaV1MetricAvailability("backtrack");
  assert.equal(availability.displayable, true);
  assert.deepEqual(availability.evidence, ["screen_view"]);
  assert.match(availability.reason, /Derived from ordered screen_view/);
});

test("gates heatmap display until canonical GWD-05 coordinates exist", () => {
  assert.equal(getFigmaV1MetricAvailability("heatmap").displayable, false);
  assert.equal(
    getFigmaV1MetricAvailability("heatmap", { canonicalHeatmapCoordinates: true }).displayable,
    true,
  );
});

test("Builder/Results metric filtering drops unsupported and not-yet-ready metrics", () => {
  const requested = [
    "pointer_interactions",
    "screen_path",
    "component_state_changes",
    "backtrack",
    "heatmap",
    "scroll_count",
    "raw_back_count",
    "raw_forward_count",
  ] as const;

  assert.deepEqual(filterDisplayableFigmaV1Metrics(requested), [
    "pointer_interactions",
    "screen_path",
    "component_state_changes",
    "backtrack",
  ]);

  assert.deepEqual(
    filterDisplayableFigmaV1Metrics(requested, { canonicalHeatmapCoordinates: true }),
    ["pointer_interactions", "screen_path", "component_state_changes", "backtrack", "heatmap"],
  );
});
