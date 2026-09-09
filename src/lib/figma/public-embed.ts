const ALLOWED_FIGMA_HOSTS = new Set([
  "figma.com",
  "www.figma.com",
  "embed.figma.com",
]);

const MAX_URL_LENGTH = 4096;
const MAX_IDENTIFIER_LENGTH = 128;
const SAFE_FIGMA_IDENTIFIER = /^[A-Za-z0-9:_;-]+$/;

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

function readIdentifier(url: URL, name: "node-id" | "starting-point-node-id"): string | undefined {
  const values = url.searchParams.getAll(name);
  if (values.length > 1) {
    throw new Error(`Figma prototype URL contains an ambiguous ${name}`);
  }
  if (values.length === 0) return undefined;

  const value = values[0].trim();
  if (
    !value ||
    value.length > MAX_IDENTIFIER_LENGTH ||
    !SAFE_FIGMA_IDENTIFIER.test(value)
  ) {
    throw new Error(`Figma prototype ${name} is invalid`);
  }
  return value;
}

/**
 * Validate a public Figma prototype URL, extract its stable URL identifiers,
 * and normalize it to Figma's embed host.
 *
 * Simplified V1 intentionally does not require OAuth, client secrets, access
 * tokens, or Figma REST metadata. Query parameters supplied by the prototype
 * link are preserved, while identity-bearing node/start parameters are parsed
 * unambiguously and embed-host is pinned to the UT Platform surface.
 */
export function parsePublicFigmaPrototypeUrl(
  input: string,
  embedHost = "ut-platform-v1",
): PublicFigmaPrototype {
  const sourceUrl = required(input, "prototypeUrl");
  if (sourceUrl.length > MAX_URL_LENGTH) {
    throw new Error("Figma prototype URL is too long");
  }

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
  if (url.username || url.password) {
    throw new Error("Figma prototype URL must not contain credentials");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "proto" || !segments[1]) {
    throw new Error("Use a Figma prototype link (/proto/...), not a design/file link");
  }

  const fileKey = segments[1];
  if (
    fileKey.length > MAX_IDENTIFIER_LENGTH ||
    !/^[A-Za-z0-9]+$/.test(fileKey)
  ) {
    throw new Error("Figma prototype file key is invalid");
  }

  const nodeId = readIdentifier(url, "node-id");
  const startingPointNodeId = readIdentifier(url, "starting-point-node-id");

  const normalizedEmbedHost = required(embedHost, "embedHost");
  if (normalizedEmbedHost.length > MAX_IDENTIFIER_LENGTH || /[\r\n\t]/.test(normalizedEmbedHost)) {
    throw new Error("embedHost is invalid");
  }

  url.hostname = "embed.figma.com";
  url.searchParams.set("embed-host", normalizedEmbedHost);
  url.hash = "";

  return Object.freeze({
    sourceUrl,
    embedUrl: url.toString(),
    fileKey,
    ...(nodeId ? { nodeId } : {}),
    ...(startingPointNodeId ? { startingPointNodeId } : {}),
  });
}
