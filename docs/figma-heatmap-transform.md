# GWD-05 / Task 39 — Canonical Figma Heatmap Coordinate Transform

Canonical provider source: https://developers.figma.com/docs/embeds/embed-api/

## Boundary

This transform converts Figma `MOUSE_PRESS_OR_RELEASE` evidence into stable heatmap coordinates for one exact immutable UTP published `testVersionId`. It does **not** resolve `latest`, use browser CSS pixels, or require a Figma REST file-version lookup.

Task 32 is the current publish contract for simplified V1: the validated Figma source URL/embed/start node plus `prototype_mapping` are frozen on the published `test_version`, and a Figma REST `figma_version_id` is intentionally not required. Task 39 therefore stores source-backed node geometry inside `test_versions.prototype_mapping.geometry` and uses the exact immutable UTP `testVersionId` as `geometryVersionId`.

If geometry is unavailable, belongs to another test version/file, is missing one of the event node IDs, or disagrees with the provider coordinate evidence, normalization fails closed. The raw Figma target/scroller/offset evidence is retained but no canonical heatmap point is emitted.

## Provider evidence used

Figma documents these pointer fields:

```text
presentedNodeId
targetNodeId
targetNodeMousePosition
nearestScrollingFrameId
nearestScrollingFrameMousePosition
nearestScrollingFrameOffset
```

The target/scroller positions are local coordinates. Figma also supplies the scrolling-frame offset so the click can be reconstructed in scrolling content bounds.

## Immutable geometry snapshot

```ts
type FigmaGeometrySnapshot = {
  version: 1
  transformVersion: "figma-heatmap-v1"
  geometryVersionId: string // exact UTP testVersionId
  fileKey: string
  source: "figma_node_bounds"
  presentedNodeIds: string[]
  nodes: Record<string, { x: number; y: number; width: number; height: number }>
}
```

`public.save_figma_geometry_snapshot(...)` accepts this structure only for a draft test version, requires `geometryVersionId === testVersionId`, requires the same Figma file key, validates positive finite node bounds, and stores it under `prototype_mapping.geometry`. The existing Task 32 publish boundary then freezes it together with the published test version.

Task 17 frame-mapping updates merge into the existing `prototype_mapping` so a later target edit does not silently erase the geometry/source metadata.

## Collector trust boundary

`canonicalPoint` is server-owned evidence. The event collector strips any participant/client supplied `canonicalPoint` before persistence. For a Figma pointer event it loads the exact published test version, resolves the presented/target/scroller node rectangles from its immutable geometry snapshot, and only then calls the canonical transform.

No geometry or mismatch means raw evidence only. There is no browser/CSS coordinate fallback.

## Transform

Two independent reconstructions are required:

```text
target canvas point
= targetBounds origin
+ targetNodeMousePosition
+ scroll offset only when target itself is the scrolling frame
```

```text
scroller content canvas point
= nearestScrollingFrameBounds origin
+ nearestScrollingFrameMousePosition
+ nearestScrollingFrameOffset
```

The two points must agree within a tiny numeric tolerance. A disagreement is `inconsistent_pointer_geometry` and produces no canonical point.

Canonical presented-node coordinates:

```text
x = canvasX - presentedBounds.x
y = canvasY - presentedBounds.y
normalizedX = x / presentedBounds.width
normalizedY = y / presentedBounds.height
```

`presentedNodeId` remains the canonical screen/overlay identity. Normalized coordinates must stay within 0..1.

## Scaling / device / overlay invariants

- Uniformly scaling the same coordinate space scales canonical x/y but leaves normalized x/y unchanged.
- Device-sized frames may sit at any canvas origin; normalization is relative to the presented-node bounds.
- When an overlay is the presented node, its bounds define that event's canonical frame.
- Points outside the presented node fail closed instead of being clamped into a fabricated location.

## Results / Task 47 boundary

Results consume only persisted `metadata.canonicalPoint` where:
- `transformVersion === "figma-heatmap-v1"`
- `geometryVersionId === event.testVersionId`
- `presentedNodeId === event.screenId`
- normalized x/y are within 0..1
- frame width/height are positive

No raw pointer means **No Data**. Raw pointer evidence without canonical geometry means **Unsupported**, not zero and not a synthetic heatmap.

Transform version: `figma-heatmap-v1`.
