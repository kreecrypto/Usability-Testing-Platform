# GWD-05 — Canonical Figma Heatmap Coordinate Transform

Canonical provider source: https://developers.figma.com/docs/embeds/embed-api/

## Boundary

This task transforms Figma `MOUSE_PRESS_OR_RELEASE` evidence into stable heatmap coordinates for the exact published prototype version. It does **not** acquire Figma geometry and does not resolve `latest` provider state.

Input geometry must be a caller-supplied immutable snapshot that is already bound to the published `figmaVersionId`. If geometry is unavailable, mismatched to the event node IDs, or inconsistent with the provider coordinate evidence, the transform fails closed and heatmap remains unavailable.

This keeps simplified V1 from reintroducing Researcher OAuth / Figma REST acquisition as an implicit requirement.

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

The target/scroller positions are local coordinates. Figma also supplies the scrolling-frame offset so a click can be reconstructed in scrolling content bounds.

## Pinned geometry snapshot

```ts
type PinnedFigmaGeometrySnapshot = {
  figmaVersionId: string
  presentedNodeId: string
  presentedBounds: { x, y, width, height }
  targetNodeId: string
  targetBounds: { x, y, width, height }
  nearestScrollingFrameId: string
  nearestScrollingFrameBounds: { x, y, width, height }
}
```

All rectangles must describe the same pinned coordinate space.

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

The two points must agree within a tiny numeric tolerance. A disagreement is `inconsistent_pointer_geometry` and produces no heatmap point.

Canonical presented-node coordinates:

```text
x = canvasX - presentedBounds.x
y = canvasY - presentedBounds.y
normalizedX = x / presentedBounds.width
normalizedY = y / presentedBounds.height
```

`presentedNodeId` is important because Figma documents it as the topmost overlay when an overlay is visible, otherwise the current screen. Heatmaps therefore remain scoped to the actual presented node rather than mixing overlay and underlying-frame coordinates.

## Scaling / device / overlay invariants

- Uniformly scaling the entire pinned coordinate space scales canonical x/y but leaves normalized x/y unchanged.
- A phone/device-sized frame can sit at any canvas origin; normalization is relative to the pinned presented-node bounds, not global canvas origin.
- When an overlay is presented, the overlay bounds are the canonical frame for that event.
- Points outside the pinned presented node fail closed instead of being clamped into a false heatmap location.

## Product gate

`src/lib/figma/capabilities.ts` keeps the Figma heatmap metric hidden until consumers have evidence that this canonical transform was applied. Raw provider offsets alone are not a publishable heatmap metric.

Transform version: `figma-heatmap-v1`.
