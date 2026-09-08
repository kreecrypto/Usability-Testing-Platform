export type FigmaCurrentVersion = Readonly<{
  versionId: string;
  lastModified: string;
}>;

export type FigmaPrototypeDraft = Readonly<{
  fileKey: string;
  startNodeId: string;
  flowStartingPointNodeId?: string;
}>;

export type PublishedFigmaPrototype = Readonly<{
  provider: "figma";
  fileKey: string;
  figmaVersionId: string;
  versionResolvedAt: string;
  sourceLastModified: string;
  startNodeId: string;
  flowStartingPointNodeId?: string;
}>;

export interface FigmaVersionResolver {
  resolveCurrentVersion(fileKey: string): Promise<FigmaCurrentVersion>;
}

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

/**
 * Resolve the current Figma version exactly once at publish time and persist it
 * into the immutable published prototype snapshot.
 *
 * A published test never asks the resolver for "latest" again. A subsequent
 * edit in Figma therefore cannot mutate a previously published study.
 */
export async function pinFigmaVersionAtPublish(
  draft: FigmaPrototypeDraft,
  resolver: FigmaVersionResolver,
  now: () => Date = () => new Date(),
): Promise<PublishedFigmaPrototype> {
  const fileKey = required(draft.fileKey, "fileKey");
  const startNodeId = required(draft.startNodeId, "startNodeId");
  const current = await resolver.resolveCurrentVersion(fileKey);
  const figmaVersionId = required(current.versionId, "figmaVersionId");

  return Object.freeze({
    provider: "figma" as const,
    fileKey,
    figmaVersionId,
    versionResolvedAt: now().toISOString(),
    sourceLastModified: required(current.lastModified, "sourceLastModified"),
    startNodeId,
    ...(draft.flowStartingPointNodeId?.trim()
      ? { flowStartingPointNodeId: draft.flowStartingPointNodeId.trim() }
      : {}),
  });
}

export function assertPublishedFigmaPrototype(
  prototype: PublishedFigmaPrototype,
): PublishedFigmaPrototype {
  required(prototype.fileKey, "fileKey");
  required(prototype.figmaVersionId, "figmaVersionId");
  required(prototype.startNodeId, "startNodeId");
  return prototype;
}

/** Build the participant runner URL. `version-id` is mandatory for published tests. */
export function buildPinnedFigmaEmbedUrl(
  prototype: PublishedFigmaPrototype,
  options: Readonly<{
    embedHost: string;
    clientId?: string;
  }>,
): string {
  const pinned = assertPublishedFigmaPrototype(prototype);
  const url = new URL(
    `https://embed.figma.com/proto/${encodeURIComponent(pinned.fileKey)}`,
  );

  url.searchParams.set("embed-host", required(options.embedHost, "embedHost"));
  url.searchParams.set("node-id", pinned.startNodeId);
  url.searchParams.set("version-id", pinned.figmaVersionId);

  if (pinned.flowStartingPointNodeId) {
    url.searchParams.set(
      "starting-point-node-id",
      pinned.flowStartingPointNodeId,
    );
  }

  if (options.clientId?.trim()) {
    url.searchParams.set("client-id", options.clientId.trim());
  }

  return url.toString();
}

/**
 * Every REST read used to interpret a published session must carry the same
 * version ID as the participant embed. Omitting `version` would silently read
 * the current Figma file and break historical reproducibility.
 */
export function buildPinnedFigmaFileApiUrl(
  prototype: PublishedFigmaPrototype,
  options: Readonly<{
    nodeIds?: readonly string[];
    depth?: number;
  }> = {},
): string {
  const pinned = assertPublishedFigmaPrototype(prototype);
  const url = new URL(
    `https://api.figma.com/v1/files/${encodeURIComponent(pinned.fileKey)}`,
  );
  url.searchParams.set("version", pinned.figmaVersionId);

  if (options.nodeIds?.length) {
    url.searchParams.set("ids", options.nodeIds.join(","));
  }
  if (options.depth !== undefined) {
    if (!Number.isInteger(options.depth) || options.depth < 1) {
      throw new Error("depth must be a positive integer");
    }
    url.searchParams.set("depth", String(options.depth));
  }

  return url.toString();
}

export function buildPinnedFigmaImageApiUrl(
  prototype: PublishedFigmaPrototype,
  nodeIds: readonly string[],
): string {
  const pinned = assertPublishedFigmaPrototype(prototype);
  if (nodeIds.length === 0) throw new Error("nodeIds are required");

  const url = new URL(
    `https://api.figma.com/v1/images/${encodeURIComponent(pinned.fileKey)}`,
  );
  url.searchParams.set("ids", nodeIds.join(","));
  url.searchParams.set("version", pinned.figmaVersionId);
  return url.toString();
}
