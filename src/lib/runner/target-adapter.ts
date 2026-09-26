export type RunnerTargetProvider = "figma_prototype" | "first_party_web" | "external_web";
export type RunnerLaunchMode = "embed" | "new_tab" | "same_tab" | "unsupported";

export type RunnerTargetSnapshot = Readonly<{
  provider: RunnerTargetProvider;
  sourceUrl: string;
  launchMode: RunnerLaunchMode;
  capabilities: Readonly<Record<string, unknown>>;
  providerConfig: Readonly<Record<string, unknown>>;
  snapshotVersion: number;
}>;

export type RunnerTargetAdapter = Readonly<{
  provider: RunnerTargetProvider;
  sourceUrl: string;
  launchMode: Exclude<RunnerLaunchMode, "unsupported">;
  embedUrl: string | null;
  startScreenId: string | null;
  instrumentation: "figma_embed_api" | "first_party_bridge" | "cooperative_bridge" | "none";
}>;

export class RunnerTargetAdapterError extends Error {
  readonly code: "invalid_target_snapshot" | "target_unsupported";
  constructor(code: RunnerTargetAdapterError["code"]) {
    super(code);
    this.name = "RunnerTargetAdapterError";
    this.code = code;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parseRunnerTargetSnapshot(value: unknown): RunnerTargetSnapshot {
  const target = record(value);
  const capabilities = record(target?.capabilities);
  const providerConfig = record(target?.providerConfig);
  const provider = target?.provider;
  const launchMode = target?.launchMode;
  if ((provider !== "figma_prototype" && provider !== "first_party_web" && provider !== "external_web") ||
      typeof target?.sourceUrl !== "string" || !target.sourceUrl.trim() ||
      (launchMode !== "embed" && launchMode !== "new_tab" && launchMode !== "same_tab" && launchMode !== "unsupported") ||
      !capabilities || !providerConfig || typeof target?.snapshotVersion !== "number" || !Number.isInteger(target.snapshotVersion) || target.snapshotVersion < 1) {
    throw new RunnerTargetAdapterError("invalid_target_snapshot");
  }
  return Object.freeze({ provider, sourceUrl: target.sourceUrl, launchMode, capabilities: Object.freeze({ ...capabilities }), providerConfig: Object.freeze({ ...providerConfig }), snapshotVersion: target.snapshotVersion });
}

export function resolveRunnerTargetAdapter(value: unknown): RunnerTargetAdapter {
  const target = parseRunnerTargetSnapshot(value);
  if (target.launchMode === "unsupported") throw new RunnerTargetAdapterError("target_unsupported");
  if (target.provider === "figma_prototype") {
    const embedUrl = target.providerConfig.embedUrl;
    const startNodeId = target.providerConfig.startNodeId;
    if (target.launchMode !== "embed" || typeof embedUrl !== "string" || !embedUrl.trim() || typeof startNodeId !== "string" || !startNodeId.trim()) throw new RunnerTargetAdapterError("invalid_target_snapshot");
    return Object.freeze({ provider: target.provider, sourceUrl: target.sourceUrl, launchMode: "embed", embedUrl, startScreenId: startNodeId, instrumentation: "figma_embed_api" });
  }
  if (target.provider === "first_party_web") {
    return Object.freeze({ provider: target.provider, sourceUrl: target.sourceUrl, launchMode: target.launchMode, embedUrl: target.launchMode === "embed" ? target.sourceUrl : null, startScreenId: null, instrumentation: "first_party_bridge" });
  }
  const cooperativeBridge = target.providerConfig.cooperativeBridge === true;
  return Object.freeze({ provider: target.provider, sourceUrl: target.sourceUrl, launchMode: target.launchMode, embedUrl: target.launchMode === "embed" ? target.sourceUrl : null, startScreenId: null, instrumentation: cooperativeBridge ? "cooperative_bridge" : "none" });
}
