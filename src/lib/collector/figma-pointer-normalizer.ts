import { geometryFromPrototypeMapping, resolvePinnedFigmaGeometrySnapshot, type FigmaGeometrySnapshot } from "../figma/geometry-snapshot.ts";
import { normalizeFigmaPointerEvent } from "../tracking/pointer-normalization.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent } from "../tracking/events.ts";
import { createSupabaseAdminFetch } from "../supabase-admin-fetch.ts";

type VersionGeometryRow = Readonly<{
  id: string;
  lifecycle_status: string;
  figma_file_key: string | null;
  prototype_mapping: unknown;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataWithoutClientCanonicalPoint(event: AcceptedTrackingEvent<RawTrackingEvent>): AcceptedTrackingEvent<RawTrackingEvent> {
  if (!isRecord(event.metadata) || !("canonicalPoint" in event.metadata)) return event;
  const { canonicalPoint: _ignored, ...metadata } = event.metadata;
  return Object.freeze({ ...event, metadata: Object.freeze(metadata) });
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pointerIds(event: AcceptedTrackingEvent<RawTrackingEvent>): Readonly<{
  presentedNodeId: string;
  targetNodeId: string;
  nearestScrollingFrameId: string;
}> | null {
  if (!isRecord(event.metadata)) return null;
  const presentedNodeId = text(event.metadata.presentedNodeId);
  const targetNodeId = text(event.metadata.targetNodeId);
  const nearestScrollingFrameId = text(event.metadata.nearestScrollingFrameId);
  if (!presentedNodeId || !targetNodeId || !nearestScrollingFrameId) return null;
  return Object.freeze({ presentedNodeId, targetNodeId, nearestScrollingFrameId });
}

export function createFigmaPointerCollectorNormalizer(options: Readonly<{
  supabaseUrl: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
}>) {
  const supabaseUrl = options.supabaseUrl.trim().replace(/\/+$/, "");
  const secretKey = options.secretKey.trim();
  if (!supabaseUrl.startsWith("https://")) throw new Error("supabaseUrl must use https");
  if (!secretKey) throw new Error("secretKey is required");

  const adminFetch = createSupabaseAdminFetch(secretKey, options.fetchImpl ?? fetch);
  const geometryCache = new Map<string, FigmaGeometrySnapshot | null>();

  async function readGeometry(testVersionId: string): Promise<FigmaGeometrySnapshot | null> {
    if (geometryCache.has(testVersionId)) return geometryCache.get(testVersionId) ?? null;
    const query = new URLSearchParams({
      id: `eq.${testVersionId}`,
      lifecycle_status: "eq.published",
      select: "id,lifecycle_status,figma_file_key,prototype_mapping",
      limit: "1",
    });
    const response = await adminFetch(`${supabaseUrl}/rest/v1/test_versions?${query.toString()}`, {
      headers: {
        apikey: secretKey,
        authorization: `Bearer ${secretKey}`,
        accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = await response.json() as VersionGeometryRow[];
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row || row.lifecycle_status !== "published") {
      geometryCache.set(testVersionId, null);
      return null;
    }

    try {
      const geometry = geometryFromPrototypeMapping(row.prototype_mapping);
      if (!geometry || geometry.geometryVersionId !== row.id || geometry.fileKey !== row.figma_file_key) {
        geometryCache.set(testVersionId, null);
        return null;
      }
      geometryCache.set(testVersionId, geometry);
      return geometry;
    } catch {
      geometryCache.set(testVersionId, null);
      return null;
    }
  }

  async function normalize(event: AcceptedTrackingEvent<RawTrackingEvent>): Promise<AcceptedTrackingEvent<RawTrackingEvent>> {
    if (event.eventType !== "pointer_interaction" || event.source !== "prototype_adapter" || event.metadata?.provider !== "figma") {
      return event;
    }

    // canonicalPoint is server-owned evidence. Never trust a participant-supplied value.
    const sanitized = metadataWithoutClientCanonicalPoint(event);
    const ids = pointerIds(sanitized);
    if (!ids) return sanitized;

    const geometry = await readGeometry(sanitized.testVersionId);
    if (!geometry) return sanitized;
    const snapshot = resolvePinnedFigmaGeometrySnapshot(geometry, ids);
    if (!snapshot) return sanitized;

    try {
      const normalized = normalizeFigmaPointerEvent(sanitized, snapshot);
      return Object.freeze({ ...normalized, receivedAt: sanitized.receivedAt });
    } catch {
      // Preserve the raw provider evidence but publish no false canonical point.
      return sanitized;
    }
  }

  return Object.freeze({ normalize });
}
