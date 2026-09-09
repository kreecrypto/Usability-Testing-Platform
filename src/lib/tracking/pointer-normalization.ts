import type { RawTrackingEvent } from "./events.ts";
import { transformFigmaPointerToCanonicalFrame, type FigmaPointerGeometryEvidence, type PinnedFigmaGeometrySnapshot } from "../figma/heatmap-transform.ts";

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field}_required`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field}_required`);
  return value.trim();
}

function point(value: unknown, field: string): Readonly<{ x: number; y: number }> {
  const item = record(value, field);
  if (typeof item.x !== "number" || !Number.isFinite(item.x) || typeof item.y !== "number" || !Number.isFinite(item.y)) throw new Error(`${field}_invalid`);
  return Object.freeze({ x: item.x, y: item.y });
}

export function normalizeFigmaPointerEvent(event: RawTrackingEvent, snapshot: PinnedFigmaGeometrySnapshot): RawTrackingEvent {
  if (event.eventType !== "pointer_interaction" || event.source !== "prototype_adapter") throw new Error("figma_pointer_event_required");
  const metadata = record(event.metadata, "pointer_metadata");
  if (metadata.provider !== "figma") throw new Error("figma_pointer_event_required");
  const evidence: FigmaPointerGeometryEvidence = Object.freeze({
    presentedNodeId: text(metadata.presentedNodeId, "presentedNodeId"),
    targetNodeId: text(metadata.targetNodeId, "targetNodeId"),
    targetNodeMousePosition: point(metadata.targetNodeMousePosition, "targetNodeMousePosition"),
    nearestScrollingFrameId: text(metadata.nearestScrollingFrameId, "nearestScrollingFrameId"),
    nearestScrollingFrameMousePosition: point(metadata.nearestScrollingFrameMousePosition, "nearestScrollingFrameMousePosition"),
    nearestScrollingFrameOffset: point(metadata.nearestScrollingFrameOffset, "nearestScrollingFrameOffset"),
  });
  const canonical = transformFigmaPointerToCanonicalFrame(evidence, snapshot);
  return Object.freeze({
    ...event,
    metadata: Object.freeze({
      ...metadata,
      canonicalPoint: Object.freeze({
        transformVersion: canonical.transformVersion,
        geometryVersionId: canonical.figmaVersionId,
        presentedNodeId: canonical.presentedNodeId,
        x: canonical.x,
        y: canonical.y,
        normalizedX: canonical.normalizedX,
        normalizedY: canonical.normalizedY,
        frameWidth: canonical.frameWidth,
        frameHeight: canonical.frameHeight,
      }),
    }),
  });
}
