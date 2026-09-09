const ALLOWED_FIGMA_HOSTS = new Set([
  "figma.com",
  "www.figma.com",
  "embed.figma.com",
]);

export type PublicFigmaPrototype = Readonly<{
  sourceUrl: string;
  embedUrl: string;
  fileKey: string;
  nodeId?: string;
  startingPointNodeId?: string;
}>;

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

/**
 * Validate a public Figma prototype URL and normalize it to Figma's embed host.
 *
 * Simplified V1 intentionally does not require OAuth login, client secrets,
 * access tokens, or Figma REST metadata. Query parameters supplied by the
 * prototype link (including node/start point) are preserved, while embed-host
 * and the optional Embed API client id are controlled by the UT Platform.
 *
 * A client-id pasted by a researcher is never trusted. It is removed and only
 * the configured application client id is added when live Embed API event mode
 * has been enabled for this deployment.
 */
export function parsePublicFigmaPrototypeUrl(
  input: string,
  embedHost = "ut-platform-v1",
  embedApiClientId?: string,
): PublicFigmaPrototype {
  const sourceUrl = required(input, "prototypeUrl");

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("Enter a valid Figma prototype URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Figma prototype URL must use HTTPS");
  }

  const hostname = url.hostname.toLowerCase();
  if (!ALLOWED_FIGMA_HOSTS.has(hostname) || url.port) {
    throw new Error("Only public figma.com prototype URLs are supported in V1");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "proto" || !segments[1]) {
    throw new Error("Use a Figma prototype link (/proto/...), not a design/file link");
  }

  const fileKey = segments[1];
  if (!/^[A-Za-z0-9]+$/.test(fileKey)) {
    throw new Error("Figma prototype file key is invalid");
  }

  const nodeId = url.searchParams.get("node-id")?.trim() || undefined;
  const startingPointNodeId =
    url.searchParams.get("starting-point-node-id")?.trim() || undefined;

  url.hostname = "embed.figma.com";
  url.searchParams.set("embed-host", required(embedHost, "embedHost"));
  url.searchParams.delete("client-id");

  const configuredClientId = embedApiClientId?.trim();
  if (configuredClientId) {
    url.searchParams.set("client-id", configuredClientId);
  }

  url.hash = "";

  return Object.freeze({
    sourceUrl,
    embedUrl: url.toString(),
    fileKey,
    ...(nodeId ? { nodeId } : {}),
    ...(startingPointNodeId ? { startingPointNodeId } : {}),
  });
}
