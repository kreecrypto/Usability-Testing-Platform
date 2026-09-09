const ALLOWED_FIGMA_HOSTS = new Set([
  "figma.com",
  "www.figma.com",
  "embed.figma.com",
]);

export type PublicFigmaPrototype = Readonly<{
  sourceUrl: string;
  embedUrl: string;
  fileKey: string;
  /** Canonical internal Figma node id, using the API/Embed API colon form. */
  nodeId?: string;
  /** Canonical internal Figma flow-start node id, using the colon form. */
  startingPointNodeId?: string;
}>;

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

function optionalSingleQueryValue(url: URL, key: string): string | undefined {
  const values = url.searchParams.getAll(key);
  if (values.length > 1) {
    throw new Error(`Figma prototype URL must contain at most one ${key}`);
  }
  const value = values[0]?.trim();
  return value || undefined;
}

/**
 * Figma URLs represent ordinary node ids with a hyphen (for example 5-3),
 * while Figma's APIs/events expose the same id with a colon (5:3).
 * Accept either documented representation and return one canonical internal id.
 */
export function parseFigmaNodeIdentifier(
  value: string | undefined,
  field: "node-id" | "starting-point-node-id",
): string | undefined {
  if (!value) return undefined;

  const match = /^(\d+)(?:-|:)(\d+)$/.exec(value);
  if (!match) {
    throw new Error(`${field} must be a valid Figma node identifier`);
  }

  return `${match[1]}:${match[2]}`;
}

/**
 * Validate a public Figma prototype URL and normalize it to Figma's embed host.
 *
 * Simplified V1 intentionally does not require OAuth, client secrets, access
 * tokens, or Figma REST metadata. Query parameters supplied by the prototype
 * link are preserved after validation, while parsed node/start identifiers are
 * exposed in canonical colon form for downstream mapping.
 */
export function parsePublicFigmaPrototypeUrl(
  input: string,
  embedHost = "ut-platform-v1",
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

  const nodeId = parseFigmaNodeIdentifier(
    optionalSingleQueryValue(url, "node-id"),
    "node-id",
  );
  const startingPointNodeId = parseFigmaNodeIdentifier(
    optionalSingleQueryValue(url, "starting-point-node-id"),
    "starting-point-node-id",
  );

  url.hostname = "embed.figma.com";
  url.searchParams.set("embed-host", required(embedHost, "embedHost"));
  url.hash = "";

  return Object.freeze({
    sourceUrl,
    embedUrl: url.toString(),
    fileKey,
    ...(nodeId ? { nodeId } : {}),
    ...(startingPointNodeId ? { startingPointNodeId } : {}),
  });
}
