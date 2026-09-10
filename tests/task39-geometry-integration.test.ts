import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseFigmaGeometrySnapshot,
  resolvePinnedFigmaGeometrySnapshot,
} from "../src/lib/figma/geometry-snapshot.ts";
import { createFigmaPointerCollectorNormalizer } from "../src/lib/collector/figma-pointer-normalizer.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent } from "../src/lib/tracking/events.ts";

const TEST_VERSION_ID = "00000000-0000-4000-8000-000000000039";
const FILE_KEY = "abc123";

const geometry = {
  version: 1,
  transformVersion: "figma-heatmap-v1",
  geometryVersionId: TEST_VERSION_ID,
  fileKey: FILE_KEY,
  source: "figma_node_bounds",
  presentedNodeIds: ["10:1"],
  nodes: {
    "10:1": { x: 100, y: 200, width: 400, height: 800 },
    "10:99": { x: 160, y: 390, width: 100, height: 80 },
    "10:2": { x: 120, y: 250, width: 360, height: 500 },
  },
} as const;

const rawPointer: AcceptedTrackingEvent<RawTrackingEvent> = {
  schemaVersion: 2,
  eventId: "00000000-0000-4000-8000-000000000001",
  idempotencyKey: "pointer:1",
  eventLayer: "raw",
  source: "prototype_adapter",
  eventType: "pointer_interaction",
  occurredAt: "2026-09-10T10:00:00.000Z",
  receivedAt: "2026-09-10T10:00:00.100Z",
  sequence: 1,
  sessionId: "00000000-0000-4000-8000-000000000002",
  participantId: "00000000-0000-4000-8000-000000000003",
  testId: "00000000-0000-4000-8000-000000000004",
  testVersionId: TEST_VERSION_ID,
  taskId: "00000000-0000-4000-8000-000000000005",
  screenId: "10:1",
  metadata: {
    provider: "figma",
    presentedNodeId: "10:1",
    targetNodeId: "10:99",
    targetNodeMousePosition: { x: 10, y: 20 },
    nearestScrollingFrameId: "10:2",
    nearestScrollingFrameMousePosition: { x: 50, y: 60 },
    nearestScrollingFrameOffset: { x: 0, y: 100 },
    canonicalPoint: { normalizedX: 0.999, normalizedY: 0.999, source: "untrusted-client" },
  },
};

function geometryFetch(mapping: unknown): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/rest/v1/test_versions");
    assert.equal(url.searchParams.get("id"), `eq.${TEST_VERSION_ID}`);
    return new Response(JSON.stringify([{
      id: TEST_VERSION_ID,
      lifecycle_status: "published",
      figma_file_key: FILE_KEY,
      prototype_mapping: mapping,
    }]), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("parses source-backed node bounds and resolves only complete presented/target/scroller tuples", () => {
  const parsed = parseFigmaGeometrySnapshot(geometry);
  assert.ok(parsed);
  const snapshot = resolvePinnedFigmaGeometrySnapshot(parsed, {
    presentedNodeId: "10:1",
    targetNodeId: "10:99",
    nearestScrollingFrameId: "10:2",
  });
  assert.ok(snapshot);
  assert.equal(snapshot.geometryVersionId, TEST_VERSION_ID);
  assert.equal(snapshot.presentedBounds.width, 400);
  assert.equal(resolvePinnedFigmaGeometrySnapshot(parsed, {
    presentedNodeId: "10:1",
    targetNodeId: "missing:1",
    nearestScrollingFrameId: "10:2",
  }), null);
});

test("collector strips client canonicalPoint and creates server-owned normalized evidence from published geometry", async () => {
  const normalizer = createFigmaPointerCollectorNormalizer({
    supabaseUrl: "https://example.supabase.co",
    secretKey: "sb_secret_test",
    fetchImpl: geometryFetch({ geometry }),
  });
  const normalized = await normalizer.normalize(rawPointer);
  assert.equal(normalized.receivedAt, rawPointer.receivedAt);
  assert.equal(normalized.metadata?.targetNodeId, "10:99");
  assert.deepEqual(normalized.metadata?.nearestScrollingFrameOffset, { x: 0, y: 100 });
  assert.deepEqual(normalized.metadata?.canonicalPoint, {
    transformVersion: "figma-heatmap-v1",
    geometryVersionId: TEST_VERSION_ID,
    presentedNodeId: "10:1",
    x: 70,
    y: 210,
    normalizedX: 0.175,
    normalizedY: 0.2625,
    frameWidth: 400,
    frameHeight: 800,
  });
});

test("collector fails closed to raw evidence when published geometry is absent", async () => {
  const normalizer = createFigmaPointerCollectorNormalizer({
    supabaseUrl: "https://example.supabase.co",
    secretKey: "legacy-service-role-jwt",
    fetchImpl: geometryFetch({ provider: "figma" }),
  });
  const normalized = await normalizer.normalize(rawPointer);
  assert.equal(normalized.metadata?.targetNodeId, "10:99");
  assert.equal("canonicalPoint" in (normalized.metadata ?? {}), false);
});

test("Task39 migration binds geometry identity to test_version, draft-only, and preserves mapping on later frame edits", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260910173000_task39_figma_geometry_snapshot.sql", import.meta.url), "utf8");
  assert.match(sql, /geometryVersionId' <> p_test_version_id::text/);
  assert.match(sql, /lifecycle_status = 'draft'/);
  assert.match(sql, /jsonb_set\([\s\S]*'\{geometry\}'/);
  assert.match(sql, /v_mapping := coalesce\(v_existing_mapping, '\{\}'::jsonb\) \|\| jsonb_build_object/);
  assert.match(sql, /revoke all on function public\.save_figma_geometry_snapshot[\s\S]*from public, anon, service_role/);
  assert.match(sql, /grant execute on function public\.save_figma_geometry_snapshot[\s\S]*to authenticated/);
});
