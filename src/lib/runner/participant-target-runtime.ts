import type { PublicRunnerTarget } from "./public-target.ts";

export type ParticipantTargetRuntime = Readonly<{
  provider: PublicRunnerTarget["provider"];
  launchMode: PublicRunnerTarget["launchMode"];
  renderMode: "iframe" | "external_window";
  launchUrl: string;
  instrumentation: PublicRunnerTarget["instrumentation"];
  requiresProviderReadySignal: boolean;
}>;

export class ParticipantTargetRuntimeError extends Error {
  readonly code: "target_runtime_unavailable";

  constructor() {
    super("target_runtime_unavailable");
    this.name = "ParticipantTargetRuntimeError";
    this.code = "target_runtime_unavailable";
  }
}

/**
 * Turns the immutable public target adapter into the smallest provider-neutral
 * runtime policy the participant UI needs. This function deliberately does not
 * grant evidence capability beyond the adapter contract: external targets with
 * instrumentation=none stay evidence-free, and Figma requires its live Embed
 * API URL before the task can enter the runner.
 */
export function resolveParticipantTargetRuntime(target: PublicRunnerTarget): ParticipantTargetRuntime {
  if (target.provider === "figma_prototype") {
    if (target.launchMode !== "embed" || !target.liveEmbedUrl) {
      throw new ParticipantTargetRuntimeError();
    }
    return Object.freeze({
      provider: target.provider,
      launchMode: target.launchMode,
      renderMode: "iframe",
      launchUrl: target.liveEmbedUrl,
      instrumentation: target.instrumentation,
      requiresProviderReadySignal: true,
    });
  }

  if (target.launchMode === "embed" && target.embedUrl) {
    return Object.freeze({
      provider: target.provider,
      launchMode: target.launchMode,
      renderMode: "iframe",
      launchUrl: target.embedUrl,
      instrumentation: target.instrumentation,
      requiresProviderReadySignal: false,
    });
  }

  if (target.launchMode === "new_tab" || target.launchMode === "same_tab") {
    return Object.freeze({
      provider: target.provider,
      launchMode: target.launchMode,
      renderMode: "external_window",
      launchUrl: target.sourceUrl,
      instrumentation: target.instrumentation,
      requiresProviderReadySignal: false,
    });
  }

  throw new ParticipantTargetRuntimeError();
}
