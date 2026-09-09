import assert from "node:assert/strict";
import test from "node:test";

import {
  HeatmapTransformError,
  transformFigmaPointerToCanonicalFrame,
  type FigmaPointerGeometryEvidence,
  type PinnedFigmaGeometrySnapshot,
} from "../src/lib/figma/heatmap-transform.ts";

const evidence: FigmaPointerGeometryEvidence = {
  presentedNodeId: "10:1",
  targetNodeId: "10:99",
  targetNodeMousePosition: { x: 10, y: 20 },
  nearestScrollingFrameId: "10:2",
  nearestScrollingFrameMousePosition: { x: 50, y: 60 },
  nearestScrollingFrameOffset: { x: 0, y: 100 },
};

const snapshot: PinnedFigmaGeometrySnapshot = {
  figmaVersionId: "figma-version-123",
  presentedNodeId: "10:1",
  presentedBounds: { x: 100, y: 200, width: 400, height: 800 },
  targetNodeId: "10:99",
  targetBounds: { x: 160, y: 390, width: 100, height: 80 },
  nearestScrollingFrameId: "10:2",
  nearestScrollingFrameBounds: { x: 120, y: 250, width: 360, height: 500 },
};

test("combines target/scroller coordinates and scroll offset into canonical frame coordinates", () => {
  const point = transformFigmaPointerToCanonicalFrame(evidence, snapshot);
  assert.equal(point.figmaVersionId, "figma-version-123");
  assert.equal(point.presentedNodeId, "10:1");
  assert.deepEqual(point.targetCanvasPoint, { x: 170, y: 410 });
  assert.deepEqual(point.scrollerContentCanvasPoint, { x: 170, y: 410 });
  assert.equal(point.x, 70);
  assert.equal(point.y, 210);
  assert.equal(point.normalizedX, 0.175);
  assert.equal(point.normalizedY, 0.2625);
  assert.equal(point.frameWidth, 400);
  assert.equal(point.frameHeight, 800);
});

test("keeps normalized coordinates stable under uniform pinned-geometry scaling", () => {
  const scaledEvidence: FigmaPointerGeometryEvidence = {
    ...evidence,
    targetNodeMousePosition: { x: 20, y: 40 },
    nearestScrollingFrameMousePosition: { x: 100, y: 120 },
    nearestScrollingFrameOffset: { x: 0, y: 200 },
  };
  const scaledSnapshot: PinnedFigmaGeometrySnapshot = {
    ...snapshot,
    presentedBounds: { x: 200, y: 400, width: 800, height: 1600 },
    targetBounds: { x: 320, y: 780, width: 200, height: 160 },
    nearestScrollingFrameBounds: { x: 240, y: 500, width: 720, height: 1000 },
  };

  const original = transformFigmaPointerToCanonicalFrame(evidence, snapshot);
  const scaled = transformFigmaPointerToCanonicalFrame(scaledEvidence, scaledSnapshot);
  assert.equal(scaled.x, original.x * 2);
  assert.equal(scaled.y, original.y * 2);
  assert.equal(scaled.normalizedX, original.normalizedX);
  assert.equal(scaled.normalizedY, original.normalizedY);
});

test("handles a device-sized frame at a non-zero canvas origin", () => {
  const point = transformFigmaPointerToCanonicalFrame(
    {
      presentedNodeId: "device:frame",
      targetNodeId: "device:target",
      targetNodeMousePosition: { x: 20, y: 20 },
      nearestScrollingFrameId: "device:scroll",
      nearestScrollingFrameMousePosition: { x: 195, y: 300 },
      nearestScrollingFrameOffset: { x: 0, y: 200 },
    },
    {
      figmaVersionId: "device-v1",
      presentedNodeId: "device:frame",
      presentedBounds: { x: 1000, y: 500, width: 390, height: 844 },
      targetNodeId: "device:target",
      targetBounds: { x: 1175, y: 980, width: 80, height: 80 },
      nearestScrollingFrameId: "device:scroll",
      nearestScrollingFrameBounds: { x: 1000, y: 500, width: 390, height: 844 },
    },
  );

  assert.equal(point.x, 195);
  assert.equal(point.y, 500);
  assert.equal(point.normalizedX, 0.5);
  assert.equal(point.normalizedY, 500 / 844);
});

test("uses the pinned topmost overlay as the canonical heatmap frame", () => {
  const point = transformFigmaPointerToCanonicalFrame(
    {
      presentedNodeId: "overlay:1",
      targetNodeId: "overlay:target",
      targetNodeMousePosition: { x: 25, y: 25 },
      nearestScrollingFrameId: "overlay:scroll",
      nearestScrollingFrameMousePosition: { x: 75, y: 75 },
      nearestScrollingFrameOffset: { x: 0, y: 0 },
    },
    {
      figmaVersionId: "overlay-v1",
      presentedNodeId: "overlay:1",
      presentedBounds: { x: 400, y: 300, width: 300, height: 200 },
      targetNodeId: "overlay:target",
      targetBounds: { x: 450, y: 350, width: 100, height: 80 },
      nearestScrollingFrameId: "overlay:scroll",
      nearestScrollingFrameBounds: { x: 400, y: 300, width: 300, height: 200 },
    },
  );

  assert.equal(point.x, 75);
  assert.equal(point.y, 75);
  assert.equal(point.normalizedX, 0.25);
  assert.equal(point.normalizedY, 0.375);
});

test("adds scroll offset when the target itself is the scrolling frame", () => {
  const point = transformFigmaPointerToCanonicalFrame(
    {
      presentedNodeId: "frame:1",
      targetNodeId: "scroll:1",
      targetNodeMousePosition: { x: 50, y: 100 },
      nearestScrollingFrameId: "scroll:1",
      nearestScrollingFrameMousePosition: { x: 50, y: 100 },
      nearestScrollingFrameOffset: { x: 0, y: 150 },
    },
    {
      figmaVersionId: "scroll-v1",
      presentedNodeId: "frame:1",
      presentedBounds: { x: 100, y: 200, width: 400, height: 800 },
      targetNodeId: "scroll:1",
      targetBounds: { x: 100, y: 200, width: 400, height: 800 },
      nearestScrollingFrameId: "scroll:1",
      nearestScrollingFrameBounds: { x: 100, y: 200, width: 400, height: 800 },
    },
  );

  assert.equal(point.x, 50);
  assert.equal(point.y, 250);
  assert.equal(point.normalizedY, 0.3125);
});

test("fails closed when pinned geometry IDs or independent coordinate paths disagree", () => {
  assert.throws(
    () => transformFigmaPointerToCanonicalFrame(
      { ...evidence, targetNodeId: "wrong:node" },
      snapshot,
    ),
    (error: unknown) => error instanceof HeatmapTransformError && error.code === "geometry_mismatch",
  );

  assert.throws(
    () => transformFigmaPointerToCanonicalFrame(
      { ...evidence, nearestScrollingFrameMousePosition: { x: 90, y: 60 } },
      snapshot,
    ),
    (error: unknown) => error instanceof HeatmapTransformError && error.code === "inconsistent_pointer_geometry",
  );
});

test("fails closed instead of manufacturing a heatmap point outside the pinned presented node", () => {
  assert.throws(
    () => transformFigmaPointerToCanonicalFrame(
      {
        ...evidence,
        targetNodeMousePosition: { x: 610, y: 20 },
        nearestScrollingFrameMousePosition: { x: 650, y: 60 },
      },
      snapshot,
    ),
    (error: unknown) => error instanceof HeatmapTransformError && error.code === "point_outside_presented_node",
  );
});
