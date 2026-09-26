export type ExternalTargetCapabilityState = "available" | "partial" | "unsupported";

export type ExternalTargetBoundary = Readonly<{
  launchMode: "embed" | "new_tab";
  capabilities: Readonly<{
    launch: ExternalTargetCapabilityState;
    embed: ExternalTargetCapabilityState;
    screenView: ExternalTargetCapabilityState;
    pointerInteraction: ExternalTargetCapabilityState;
    scroll: ExternalTargetCapabilityState;
    heatmap: ExternalTargetCapabilityState;
  }>;
  reasons: readonly string[];
}>;

export type ExternalTargetPreflight = Readonly<{
  iframeAllowed?: boolean;
  cooperativeBridge?: boolean;
}>;

/**
 * Fail-closed boundary for websites UTP does not own.
 * Cross-origin DOM, pointer, path, scroll and heatmap evidence are never inferred.
 * Rich evidence becomes available only through an explicit cooperative bridge.
 */
export function resolveExternalTargetBoundary(preflight: ExternalTargetPreflight): ExternalTargetBoundary {
  const iframeAllowed = preflight.iframeAllowed === true;
  const cooperativeBridge = preflight.cooperativeBridge === true;
  const evidenceState: ExternalTargetCapabilityState = cooperativeBridge ? "available" : "unsupported";
  const reasons: string[] = [];

  if (!iframeAllowed) reasons.push("target_embedding_not_verified_or_blocked");
  if (!cooperativeBridge) reasons.push("cross_origin_behavior_evidence_unavailable");

  return Object.freeze({
    launchMode: iframeAllowed ? "embed" : "new_tab",
    capabilities: Object.freeze({
      launch: "available",
      embed: iframeAllowed ? "available" : "unsupported",
      screenView: evidenceState,
      pointerInteraction: evidenceState,
      scroll: evidenceState,
      heatmap: evidenceState,
    }),
    reasons: Object.freeze(reasons),
  });
}
