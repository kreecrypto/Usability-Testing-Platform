import { parsePublicFigmaPrototypeUrl } from "../figma/public-embed.ts";
import { resolveExternalTargetBoundary, type ExternalTargetCapabilityState } from "../web/external-target-boundary.ts";

export type TestTargetProvider = "figma_prototype" | "first_party_web" | "external_web";
export type CapabilityState = "Available" | "Partial" | "Unsupported" | "No Data";
export type WebEnvironment = "uat" | "production" | null;

export type TestTargetPreflight = Readonly<{ access: CapabilityState; embed: CapabilityState; instrumentation: CapabilityState; screen: CapabilityState; path: CapabilityState; pointer: CapabilityState; scroll: CapabilityState; coordinates: CapabilityState; publishBlocked: boolean; reasons: readonly string[] }>;
export type TestTargetSnapshotV1 = Readonly<{ provider: TestTargetProvider; sourceUrl: string; environment: WebEnvironment; launchMode: "embed" | "new_tab" | "same_tab" | "unsupported"; capabilities: TestTargetPreflight; providerConfig: Readonly<Record<string, unknown>>; snapshotVersion: 1 }>;

export class TestTargetImportError extends Error {
  readonly code: "invalid_url" | "unsupported_scheme" | "invalid_figma_prototype" | "ownership_confirmation_required";
  readonly status: number;
  constructor(code: TestTargetImportError["code"], status: number = 400) { super(code); this.name = "TestTargetImportError"; this.code = code; this.status = status; }
}

function normalizedHttpUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new TestTargetImportError("invalid_url"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new TestTargetImportError("unsupported_scheme");
  url.hash = ""; return url;
}
function capability(state: ExternalTargetCapabilityState): CapabilityState { return state === "available" ? "Available" : state === "partial" ? "Partial" : "Unsupported"; }

export function preflightTestTarget(input: { url: string; ownership?: "owned" | "external"; environment?: "uat" | "production"; externalEmbed?: "unknown" | "allowed" | "blocked"; cooperativeBridge?: boolean }): TestTargetSnapshotV1 {
  const url = normalizedHttpUrl(input.url); const host = url.hostname.toLowerCase();
  if (host === "figma.com" || host === "www.figma.com") {
    let figma; try { figma = parsePublicFigmaPrototypeUrl(url.toString()); } catch { throw new TestTargetImportError("invalid_figma_prototype"); }
    return Object.freeze({ provider: "figma_prototype", sourceUrl: figma.sourceUrl, environment: null, launchMode: "embed", capabilities: Object.freeze({ access: "Partial", embed: "Partial", instrumentation: "Partial", screen: "Available", path: "Available", pointer: "Available", scroll: "Unsupported", coordinates: "Available", publishBlocked: true, reasons: Object.freeze(["Live public/embed access must pass provider preflight before Publish."]) }), providerConfig: Object.freeze({ fileKey: figma.fileKey, embedUrl: figma.embedUrl, ...(figma.nodeId ? { nodeId: figma.nodeId } : {}), ...(figma.startingPointNodeId ? { startNodeId: figma.startingPointNodeId } : {}) }), snapshotVersion: 1 });
  }
  if (input.ownership === "owned") {
    if (!input.environment) throw new TestTargetImportError("ownership_confirmation_required");
    return Object.freeze({ provider: "first_party_web", sourceUrl: url.toString(), environment: input.environment, launchMode: "same_tab", capabilities: Object.freeze({ access: "Partial", embed: "Partial", instrumentation: "Partial", screen: "Partial", path: "Partial", pointer: "Partial", scroll: "Partial", coordinates: "Partial", publishBlocked: true, reasons: Object.freeze(["Owned target still requires live access/embed/instrumentation preflight before Publish."]) }), providerConfig: Object.freeze({ origin: url.origin }), snapshotVersion: 1 });
  }
  const boundary = resolveExternalTargetBoundary({ iframeAllowed: input.externalEmbed === "allowed", cooperativeBridge: input.cooperativeBridge === true });
  const screen = capability(boundary.capabilities.screenView);
  return Object.freeze({ provider: "external_web", sourceUrl: url.toString(), environment: null, launchMode: boundary.launchMode, capabilities: Object.freeze({ access: "Partial", embed: capability(boundary.capabilities.embed), instrumentation: screen, screen, path: screen, pointer: capability(boundary.capabilities.pointerInteraction), scroll: capability(boundary.capabilities.scroll), coordinates: capability(boundary.capabilities.heatmap), publishBlocked: false, reasons: boundary.reasons }), providerConfig: Object.freeze({ origin: url.origin, cooperativeBridge: input.cooperativeBridge === true }), snapshotVersion: 1 });
}

export function canPublishTarget(snapshot: TestTargetSnapshotV1): boolean { return !snapshot.capabilities.publishBlocked && snapshot.launchMode !== "unsupported"; }
