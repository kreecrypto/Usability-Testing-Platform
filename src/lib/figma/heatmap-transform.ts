export const FIGMA_HEATMAP_TRANSFORM_VERSION = "figma-heatmap-v1" as const;

export type Point = Readonly<{ x: number; y: number }>;
export type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

export type FigmaPointerGeometryEvidence = Readonly<{
  presentedNodeId: string;
  targetNodeId: string;
  targetNodeMousePosition: Point;
  nearestScrollingFrameId: string;
  nearestScrollingFrameMousePosition: Point;
  nearestScrollingFrameOffset: Point;
}>;

export type PinnedFigmaGeometrySnapshot = Readonly<{
  geometryVersionId: string;
  presentedNodeId: string;
  presentedBounds: Rect;
  targetNodeId: string;
  targetBounds: Rect;
  nearestScrollingFrameId: string;
  nearestScrollingFrameBounds: Rect;
}>;

export type CanonicalHeatmapPoint = Readonly<{
  transformVersion: typeof FIGMA_HEATMAP_TRANSFORM_VERSION;
  geometryVersionId: string;
  presentedNodeId: string;
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  frameWidth: number;
  frameHeight: number;
  targetCanvasPoint: Point;
  scrollerContentCanvasPoint: Point;
}>;

export class HeatmapTransformError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HeatmapTransformError";
    this.code = code;
  }
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new HeatmapTransformError("invalid_geometry", `${field} is required`);
  return trimmed;
}

function finite(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new HeatmapTransformError("invalid_geometry", `${field} must be finite`);
  }
  return value;
}

function point(value: Point, field: string): Point {
  return Object.freeze({ x: finite(value.x, `${field}.x`), y: finite(value.y, `${field}.y`) });
}

function rect(value: Rect, field: string): Rect {
  const width = finite(value.width, `${field}.width`);
  const height = finite(value.height, `${field}.height`);
  if (width <= 0 || height <= 0) {
    throw new HeatmapTransformError("invalid_geometry", `${field} must have positive size`);
  }
  return Object.freeze({
    x: finite(value.x, `${field}.x`),
    y: finite(value.y, `${field}.y`),
    width,
    height,
  });
}

function assertSameId(expected: string, actual: string, field: string): void {
  if (requiredText(expected, field) !== requiredText(actual, field)) {
    throw new HeatmapTransformError("geometry_mismatch", `${field} does not match pinned geometry`);
  }
}

function closeEnough(a: Point, b: Point, tolerance: number): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

function clean(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

/**
 * Transform documented Figma pointer evidence into stable coordinates relative
 * to the immutable geometry snapshot stored on one UTP test_version.
 *
 * Simplified V1 intentionally does not require Figma REST file-version metadata.
 * `geometryVersionId` therefore identifies the immutable UTP test_version-bound
 * geometry snapshot, not a guessed Figma version ID.
 */
export function transformFigmaPointerToCanonicalFrame(
  evidence: FigmaPointerGeometryEvidence,
  snapshot: PinnedFigmaGeometrySnapshot,
): CanonicalHeatmapPoint {
  const geometryVersionId = requiredText(snapshot.geometryVersionId, "geometryVersionId");
  assertSameId(evidence.presentedNodeId, snapshot.presentedNodeId, "presentedNodeId");
  assertSameId(evidence.targetNodeId, snapshot.targetNodeId, "targetNodeId");
  assertSameId(
    evidence.nearestScrollingFrameId,
    snapshot.nearestScrollingFrameId,
    "nearestScrollingFrameId",
  );

  const presented = rect(snapshot.presentedBounds, "presentedBounds");
  const target = rect(snapshot.targetBounds, "targetBounds");
  const scroller = rect(snapshot.nearestScrollingFrameBounds, "nearestScrollingFrameBounds");
  const targetMouse = point(evidence.targetNodeMousePosition, "targetNodeMousePosition");
  const scrollerMouse = point(
    evidence.nearestScrollingFrameMousePosition,
    "nearestScrollingFrameMousePosition",
  );
  const scrollOffset = point(evidence.nearestScrollingFrameOffset, "nearestScrollingFrameOffset");

  const targetCanvasPoint = Object.freeze({
    x: target.x + targetMouse.x + (evidence.targetNodeId === evidence.nearestScrollingFrameId ? scrollOffset.x : 0),
    y: target.y + targetMouse.y + (evidence.targetNodeId === evidence.nearestScrollingFrameId ? scrollOffset.y : 0),
  });

  const scrollerContentCanvasPoint = Object.freeze({
    x: scroller.x + scrollerMouse.x + scrollOffset.x,
    y: scroller.y + scrollerMouse.y + scrollOffset.y,
  });

  const tolerance = Math.max(0.01, Math.max(presented.width, presented.height) * 1e-6);
  if (!closeEnough(targetCanvasPoint, scrollerContentCanvasPoint, tolerance)) {
    throw new HeatmapTransformError(
      "inconsistent_pointer_geometry",
      "target and scrolling-frame evidence resolve to different content points",
    );
  }

  const x = clean(targetCanvasPoint.x - presented.x);
  const y = clean(targetCanvasPoint.y - presented.y);
  const normalizedX = clean(x / presented.width);
  const normalizedY = clean(y / presented.height);

  if (
    normalizedX < -tolerance || normalizedX > 1 + tolerance ||
    normalizedY < -tolerance || normalizedY > 1 + tolerance
  ) {
    throw new HeatmapTransformError(
      "point_outside_presented_node",
      "pointer evidence resolves outside the pinned presented node",
    );
  }

  return Object.freeze({
    transformVersion: FIGMA_HEATMAP_TRANSFORM_VERSION,
    geometryVersionId,
    presentedNodeId: snapshot.presentedNodeId,
    x,
    y,
    normalizedX: Math.min(1, Math.max(0, normalizedX)),
    normalizedY: Math.min(1, Math.max(0, normalizedY)),
    frameWidth: presented.width,
    frameHeight: presented.height,
    targetCanvasPoint,
    scrollerContentCanvasPoint,
  });
}
