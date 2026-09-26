import {
  FIGMA_HEATMAP_TRANSFORM_VERSION,
  type FigmaPointerGeometryEvidence,
  type PinnedFigmaGeometrySnapshot,
  type Rect,
} from "./heatmap-transform.ts";

export const FIGMA_GEOMETRY_SNAPSHOT_VERSION = 1 as const;

export type FigmaGeometrySnapshot = Readonly<{
  version: typeof FIGMA_GEOMETRY_SNAPSHOT_VERSION;
  transformVersion: typeof FIGMA_HEATMAP_TRANSFORM_VERSION;
  geometryVersionId: string;
  fileKey: string;
  source: "figma_node_bounds";
  presentedNodeIds: readonly string[];
  nodes: Readonly<Record<string, Rect>>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field}_required`);
  return value.trim();
}

function finite(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field}_invalid`);
  return value;
}

function parseRect(value: unknown, field: string): Rect {
  if (!isRecord(value)) throw new Error(`${field}_invalid`);
  const width = finite(value.width, `${field}.width`);
  const height = finite(value.height, `${field}.height`);
  if (width <= 0 || height <= 0) throw new Error(`${field}_invalid_size`);
  return Object.freeze({
    x: finite(value.x, `${field}.x`),
    y: finite(value.y, `${field}.y`),
    width,
    height,
  });
}

export function parseFigmaGeometrySnapshot(value: unknown): FigmaGeometrySnapshot | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error("geometry_snapshot_invalid");
  if (value.version !== FIGMA_GEOMETRY_SNAPSHOT_VERSION) throw new Error("geometry_snapshot_version_invalid");
  if (value.transformVersion !== FIGMA_HEATMAP_TRANSFORM_VERSION) throw new Error("geometry_transform_version_invalid");
  if (value.source !== "figma_node_bounds") throw new Error("geometry_source_invalid");

  const geometryVersionId = requiredText(value.geometryVersionId, "geometryVersionId");
  const fileKey = requiredText(value.fileKey, "fileKey");
  if (!Array.isArray(value.presentedNodeIds) || value.presentedNodeIds.length === 0) {
    throw new Error("presentedNodeIds_required");
  }
  if (!isRecord(value.nodes) || Object.keys(value.nodes).length === 0) throw new Error("geometry_nodes_required");

  const nodes: Record<string, Rect> = {};
  for (const [nodeId, bounds] of Object.entries(value.nodes)) {
    const canonicalNodeId = requiredText(nodeId, "nodeId");
    nodes[canonicalNodeId] = parseRect(bounds, `nodes.${canonicalNodeId}`);
  }

  const presentedNodeIds = value.presentedNodeIds.map((nodeId, index) => requiredText(nodeId, `presentedNodeIds.${index}`));
  if (new Set(presentedNodeIds).size !== presentedNodeIds.length) throw new Error("presentedNodeIds_duplicate");
  for (const nodeId of presentedNodeIds) {
    if (!nodes[nodeId]) throw new Error(`presented_node_geometry_missing:${nodeId}`);
  }

  return Object.freeze({
    version: FIGMA_GEOMETRY_SNAPSHOT_VERSION,
    transformVersion: FIGMA_HEATMAP_TRANSFORM_VERSION,
    geometryVersionId,
    fileKey,
    source: "figma_node_bounds",
    presentedNodeIds: Object.freeze([...presentedNodeIds]),
    nodes: Object.freeze(nodes),
  });
}

export function resolvePinnedFigmaGeometrySnapshot(
  geometry: FigmaGeometrySnapshot,
  evidence: Pick<FigmaPointerGeometryEvidence, "presentedNodeId" | "targetNodeId" | "nearestScrollingFrameId">,
): PinnedFigmaGeometrySnapshot | null {
  if (!geometry.presentedNodeIds.includes(evidence.presentedNodeId)) return null;
  const presentedBounds = geometry.nodes[evidence.presentedNodeId];
  const targetBounds = geometry.nodes[evidence.targetNodeId];
  const nearestScrollingFrameBounds = geometry.nodes[evidence.nearestScrollingFrameId];
  if (!presentedBounds || !targetBounds || !nearestScrollingFrameBounds) return null;

  return Object.freeze({
    geometryVersionId: geometry.geometryVersionId,
    presentedNodeId: evidence.presentedNodeId,
    presentedBounds,
    targetNodeId: evidence.targetNodeId,
    targetBounds,
    nearestScrollingFrameId: evidence.nearestScrollingFrameId,
    nearestScrollingFrameBounds,
  });
}

export function geometryFromPrototypeMapping(value: unknown): FigmaGeometrySnapshot | null {
  if (!isRecord(value)) return null;
  return parseFigmaGeometrySnapshot(value.geometry);
}
