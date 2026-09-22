import { resolveRunnerTargetAdapter, RunnerTargetAdapterError, type RunnerTargetAdapter } from "./target-adapter.ts";

export type PublicRunnerTarget = Readonly<RunnerTargetAdapter & {
  liveEmbedUrl: string | null;
}>;

function withFigmaClientId(embedUrl: string, clientId: string | null): string | null {
  if (!clientId) return null;
  const url = new URL(embedUrl);
  if (url.protocol !== "https:" || url.hostname !== "embed.figma.com") return null;
  url.searchParams.set("client-id", clientId);
  return url.toString();
}

export function publicTargetFromSnapshot(targetSnapshot: unknown, figmaEmbedClientId: string | null): PublicRunnerTarget {
  let adapter: RunnerTargetAdapter;
  try {
    adapter = resolveRunnerTargetAdapter(targetSnapshot);
  } catch (error) {
    if (error instanceof RunnerTargetAdapterError) throw error;
    throw new RunnerTargetAdapterError("invalid_target_snapshot");
  }

  return Object.freeze({
    ...adapter,
    liveEmbedUrl: adapter.provider === "figma_prototype" && adapter.embedUrl
      ? withFigmaClientId(adapter.embedUrl, figmaEmbedClientId)
      : null,
  });
}
