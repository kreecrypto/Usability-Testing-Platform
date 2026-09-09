import {
  FIGMA_V1_CAPABILITIES,
  filterDisplayableFigmaV1Metrics,
  getFigmaV1MetricAvailability,
  type FigmaV1Metric,
} from "./capabilities.ts";

export type FigmaLimitationSurface = "builder" | "runner" | "results";

export type FigmaSurfaceNotice = Readonly<{
  id: string;
  title: string;
  detail: string;
  fallback: string;
  blocking: boolean;
}>;

export type FigmaResultsCapabilityModel = Readonly<{
  displayableMetrics: readonly FigmaV1Metric[];
  hiddenMetrics: ReadonlyArray<
    Readonly<{ metric: FigmaV1Metric; reason: string }>
  >;
}>;

const ALL_RESULTS_METRICS: readonly FigmaV1Metric[] = Object.freeze([
  "pointer_interactions",
  "screen_path",
  "component_state_changes",
  "backtrack",
  "heatmap",
  "scroll_count",
  "raw_back_count",
  "raw_forward_count",
]);

export function getFigmaV1SurfaceNotices(
  surface: FigmaLimitationSurface,
  options: Readonly<{ embedApiConfigured?: boolean; canonicalHeatmapCoordinates?: boolean }> = {},
): readonly FigmaSurfaceNotice[] {
  if (surface === "builder") {
    return Object.freeze([
      Object.freeze({
        id: "public-prototype-only",
        title: "V1 supports public Figma prototype URLs only",
        detail:
          "Private, organization-restricted, login-required, and password-protected access is unsupported in simplified V1.",
        fallback:
          "Block publish and ask the researcher to provide a participant-accessible public prototype. Do not start a Researcher OAuth flow.",
        blocking: true,
      }),
      Object.freeze({
        id: "embed-api-configuration",
        title: "Live Figma interaction events require Embed API configuration",
        detail:
          "Live emitted-event mode requires a Figma app client ID and the UTP origin allowlisted in the Figma Embed API configuration.",
        fallback: options.embedApiConfigured === true
          ? "Configuration is available; continue using only the documented emitted-event set."
          : "Keep publish/event-validation blocked for live-event mode and do not claim event capture until client ID + allowed-origin proof exists.",
        blocking: options.embedApiConfigured !== true,
      }),
    ]);
  }

  if (surface === "runner") {
    return Object.freeze([
      Object.freeze({
        id: "access-technical-block",
        title: "Figma access screens are technical blocks",
        detail:
          "LOGIN_SCREEN_SHOWN and PASSWORD_SCREEN_SHOWN are operational access evidence, not product-usability failures.",
        fallback:
          "Stop the participant flow with an explicit technical-blocked state and exclude the session from usability-failure denominators.",
        blocking: true,
      }),
      Object.freeze({
        id: "unsupported-provider-events",
        title: "Unsupported provider events are not synthesized",
        detail:
          "Figma V1 does not emit standalone scroll, raw back, or raw forward user-action events.",
        fallback:
          "Ignore unsupported provider messages and preserve only source-backed pointer, screen, and component-state evidence. Backtrack is derived later from ordered screen_view events.",
        blocking: false,
      }),
    ]);
  }

  const displayableMetrics = filterDisplayableFigmaV1Metrics(ALL_RESULTS_METRICS, {
    canonicalHeatmapCoordinates: options.canonicalHeatmapCoordinates === true,
  });
  const displayable = new Set(displayableMetrics);
  const hiddenMetrics = ALL_RESULTS_METRICS
    .filter((metric) => !displayable.has(metric))
    .map((metric) => Object.freeze({
      metric,
      reason: getFigmaV1MetricAvailability(metric, {
        canonicalHeatmapCoordinates: options.canonicalHeatmapCoordinates === true,
      }).reason,
    }));

  return Object.freeze([
    Object.freeze({
      id: "results-capability-gate",
      title: "Results show only metrics with provider evidence",
      detail:
        `Supported evidence: pointer=${FIGMA_V1_CAPABILITIES.pointer_interaction.supported}, screen=${FIGMA_V1_CAPABILITIES.screen_view.supported}, component-state=${FIGMA_V1_CAPABILITIES.component_state_changed.supported}.`,
      fallback:
        "Hide unsupported metrics instead of displaying zero, placeholder values, or inferred raw events. No Data remains No Data.",
      blocking: false,
    }),
    Object.freeze({
      id: "backtrack-derived",
      title: "Backtrack is derived, not a raw back event",
      detail: FIGMA_V1_CAPABILITIES.raw_back.note,
      fallback:
        "Derive backtrack from ordered canonical screen_view evidence and retain the source event trace.",
      blocking: false,
    }),
    Object.freeze({
      id: "heatmap-transform-gate",
      title: "Heatmap requires canonical coordinate evidence",
      detail: getFigmaV1MetricAvailability("heatmap", {
        canonicalHeatmapCoordinates: options.canonicalHeatmapCoordinates === true,
      }).reason,
      fallback: options.canonicalHeatmapCoordinates === true
        ? "Render heatmap only from GWD-05 canonical coordinates and preserve transform-version traceability."
        : "Hide heatmap until the canonical coordinate transform is available; do not use browser CSS pixels as a substitute.",
      blocking: options.canonicalHeatmapCoordinates !== true,
    }),
    Object.freeze({
      id: "results-hidden-metrics",
      title: "Unsupported Figma V1 metrics stay hidden",
      detail: hiddenMetrics.length > 0
        ? hiddenMetrics.map(({ metric, reason }) => `${metric}: ${reason}`).join(" | ")
        : "No metrics are hidden under the current evidence configuration.",
      fallback:
        "Expose the reason in an unsupported/no-data state when a researcher asks for a capability the provider cannot evidence.",
      blocking: false,
    }),
  ]);
}

export function getFigmaV1ResultsCapabilityModel(
  options: Readonly<{ canonicalHeatmapCoordinates?: boolean }> = {},
): FigmaResultsCapabilityModel {
  const displayableMetrics = filterDisplayableFigmaV1Metrics(ALL_RESULTS_METRICS, options);
  const displayable = new Set(displayableMetrics);
  return Object.freeze({
    displayableMetrics: Object.freeze([...displayableMetrics]),
    hiddenMetrics: Object.freeze(
      ALL_RESULTS_METRICS.filter((metric) => !displayable.has(metric)).map((metric) =>
        Object.freeze({ metric, reason: getFigmaV1MetricAvailability(metric, options).reason }),
      ),
    ),
  });
}
