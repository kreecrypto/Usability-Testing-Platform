import assert from "node:assert/strict";
import test from "node:test";

import {
  getFigmaV1ResultsCapabilityModel,
  getFigmaV1SurfaceNotices,
} from "../src/lib/figma/limitations.ts";

test("Builder blocks unsupported access and unconfigured live event mode", () => {
  const notices = getFigmaV1SurfaceNotices("builder", { embedApiConfigured: false });
  assert.equal(notices.some((notice) => notice.id === "public-prototype-only" && notice.blocking), true);
  assert.equal(notices.some((notice) => notice.id === "embed-api-configuration" && notice.blocking), true);
  assert.equal(notices.some((notice) => notice.fallback.includes("OAuth")), true);
});

test("Runner classifies login/password as technical block and never synthesizes provider events", () => {
  const notices = getFigmaV1SurfaceNotices("runner");
  const access = notices.find((notice) => notice.id === "access-technical-block");
  const unsupported = notices.find((notice) => notice.id === "unsupported-provider-events");
  assert.ok(access);
  assert.ok(unsupported);
  assert.equal(access.blocking, true);
  assert.match(access.fallback, /technical-blocked/);
  assert.match(unsupported.detail, /standalone scroll/);
  assert.match(unsupported.fallback, /Backtrack is derived/);
});

test("Results hides unsupported raw scroll/back/forward metrics", () => {
  const model = getFigmaV1ResultsCapabilityModel({ canonicalHeatmapCoordinates: true });
  assert.deepEqual(model.displayableMetrics, [
    "pointer_interactions",
    "screen_path",
    "component_state_changes",
    "backtrack",
    "heatmap",
  ]);
  assert.deepEqual(
    model.hiddenMetrics.map(({ metric }) => metric),
    ["scroll_count", "raw_back_count", "raw_forward_count"],
  );
});

test("Heatmap fails closed when canonical coordinates are unavailable", () => {
  const model = getFigmaV1ResultsCapabilityModel({ canonicalHeatmapCoordinates: false });
  assert.equal(model.displayableMetrics.includes("heatmap"), false);
  assert.equal(model.hiddenMetrics.some(({ metric }) => metric === "heatmap"), true);
});

test("All three required surfaces expose explicit fallback copy", () => {
  for (const surface of ["builder", "runner", "results"] as const) {
    const notices = getFigmaV1SurfaceNotices(surface, {
      embedApiConfigured: false,
      canonicalHeatmapCoordinates: true,
    });
    assert.ok(notices.length > 0);
    for (const notice of notices) {
      assert.ok(notice.title.trim().length > 0);
      assert.ok(notice.detail.trim().length > 0);
      assert.ok(notice.fallback.trim().length > 0);
    }
  }
});
