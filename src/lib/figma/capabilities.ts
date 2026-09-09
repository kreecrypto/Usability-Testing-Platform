export type FigmaV1EvidenceCapability =
  | "pointer_interaction"
  | "screen_view"
  | "component_state_changed"
  | "standalone_scroll"
  | "raw_back"
  | "raw_forward"
  | "technical_access_block";

export type FigmaV1Capability = Readonly<{
  supported: boolean;
  providerEventTypes: readonly string[];
  note: string;
}>;

export const FIGMA_V1_CAPABILITIES: Readonly<
  Record<FigmaV1EvidenceCapability, FigmaV1Capability>
> = Object.freeze({
  pointer_interaction: Object.freeze({
    supported: true,
    providerEventTypes: Object.freeze(["MOUSE_PRESS_OR_RELEASE"]),
    note: "Preserve target/scroller coordinates and handled state; canonical heatmap normalization is a separate GWD-05 transform.",
  }),
  screen_view: Object.freeze({
    supported: true,
    providerEventTypes: Object.freeze(["PRESENTED_NODE_CHANGED"]),
    note: "Presented node may be a top-level frame or topmost overlay; do not invent a separate overlay event type.",
  }),
  component_state_changed: Object.freeze({
    supported: true,
    providerEventTypes: Object.freeze(["NEW_STATE"]),
    note: "Preserve instance node and previous/new variant IDs.",
  }),
  standalone_scroll: Object.freeze({
    supported: false,
    providerEventTypes: Object.freeze([]),
    note: "Figma exposes scrolling-frame position/offset on MOUSE_PRESS_OR_RELEASE but does not emit a standalone scroll event.",
  }),
  raw_back: Object.freeze({
    supported: false,
    providerEventTypes: Object.freeze([]),
    note: "NAVIGATE_BACKWARD is a control message sent to the embed, not an emitted user-action event. Backtrack is derived from ordered screen_view evidence.",
  }),
  raw_forward: Object.freeze({
    supported: false,
    providerEventTypes: Object.freeze([]),
    note: "NAVIGATE_FORWARD is a control message sent to the embed, not an emitted user-action event. Forward navigation is represented by screen_view transitions.",
  }),
  technical_access_block: Object.freeze({
    supported: true,
    providerEventTypes: Object.freeze(["LOGIN_SCREEN_SHOWN", "PASSWORD_SCREEN_SHOWN"]),
    note: "Operational access evidence only. It is classified technical_blocked and excluded from usability-failure denominators.",
  }),
});

export type FigmaV1Metric =
  | "pointer_interactions"
  | "screen_path"
  | "component_state_changes"
  | "backtrack"
  | "heatmap"
  | "scroll_count"
  | "raw_back_count"
  | "raw_forward_count";

export type FigmaMetricAvailability = Readonly<{
  displayable: boolean;
  reason: string;
  evidence: readonly FigmaV1EvidenceCapability[];
}>;

export function getFigmaV1MetricAvailability(
  metric: FigmaV1Metric,
  options: Readonly<{ canonicalHeatmapCoordinates?: boolean }> = {},
): FigmaMetricAvailability {
  switch (metric) {
    case "pointer_interactions":
      return Object.freeze({
        displayable: true,
        reason: "Backed by canonical pointer_interaction from MOUSE_PRESS_OR_RELEASE.",
        evidence: Object.freeze(["pointer_interaction"]),
      });
    case "screen_path":
      return Object.freeze({
        displayable: true,
        reason: "Backed by ordered canonical screen_view events from PRESENTED_NODE_CHANGED.",
        evidence: Object.freeze(["screen_view"]),
      });
    case "component_state_changes":
      return Object.freeze({
        displayable: true,
        reason: "Backed by canonical component_state_changed from NEW_STATE.",
        evidence: Object.freeze(["component_state_changed"]),
      });
    case "backtrack":
      return Object.freeze({
        displayable: true,
        reason: "Derived from ordered screen_view evidence; it is not a raw back event count.",
        evidence: Object.freeze(["screen_view"]),
      });
    case "heatmap":
      return Object.freeze({
        displayable: options.canonicalHeatmapCoordinates === true,
        reason: options.canonicalHeatmapCoordinates === true
          ? "Pointer evidence has passed the canonical GWD-05 coordinate transform."
          : "Figma pointer payload alone lacks canonical normalized frame coordinates; wait for GWD-05 transform evidence.",
        evidence: Object.freeze(["pointer_interaction"]),
      });
    case "scroll_count":
      return Object.freeze({
        displayable: false,
        reason: FIGMA_V1_CAPABILITIES.standalone_scroll.note,
        evidence: Object.freeze(["standalone_scroll"]),
      });
    case "raw_back_count":
      return Object.freeze({
        displayable: false,
        reason: FIGMA_V1_CAPABILITIES.raw_back.note,
        evidence: Object.freeze(["raw_back"]),
      });
    case "raw_forward_count":
      return Object.freeze({
        displayable: false,
        reason: FIGMA_V1_CAPABILITIES.raw_forward.note,
        evidence: Object.freeze(["raw_forward"]),
      });
  }
}

export function filterDisplayableFigmaV1Metrics(
  metrics: readonly FigmaV1Metric[],
  options: Readonly<{ canonicalHeatmapCoordinates?: boolean }> = {},
): FigmaV1Metric[] {
  return metrics.filter((metric) => getFigmaV1MetricAvailability(metric, options).displayable);
}
