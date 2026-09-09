export const FIGMA_EMBED_EVENT_ORIGIN = "https://www.figma.com";

export const FIGMA_ACCESS_SIGNALS = [
  "INITIAL_LOAD",
  "LOGIN_SCREEN_SHOWN",
  "PASSWORD_SCREEN_SHOWN",
] as const;

export type FigmaAccessSignal = (typeof FIGMA_ACCESS_SIGNALS)[number];

export type FigmaAccessBlockReason =
  | "embed_api_unconfigured"
  | "login_required"
  | "password_required"
  | "preflight_timeout";

export type FigmaAccessPreflight = Readonly<{
  status: "idle" | "checking" | "accessible" | "technical_blocked";
  publishAllowed: boolean;
  classification: "not_started" | "preflight" | "eligible" | "technical_blocked";
  reason?: FigmaAccessBlockReason;
  message: string;
}>;

export function idleFigmaAccessPreflight(): FigmaAccessPreflight {
  return Object.freeze({
    status: "idle",
    publishAllowed: false,
    classification: "not_started",
    message: "Validate a public prototype before running the publish preflight.",
  });
}

export function startFigmaAccessPreflight(clientId?: string): FigmaAccessPreflight {
  if (!clientId?.trim()) {
    return Object.freeze({
      status: "technical_blocked",
      publishAllowed: false,
      classification: "technical_blocked",
      reason: "embed_api_unconfigured",
      message:
        "Figma Embed API client ID is not configured, so participant access cannot be proven before publish.",
    });
  }

  return Object.freeze({
    status: "checking",
    publishAllowed: false,
    classification: "preflight",
    message: "Checking participant access through the Figma Embed API…",
  });
}

export function parseFigmaAccessSignal(
  origin: string,
  data: unknown,
): FigmaAccessSignal | null {
  if (origin !== FIGMA_EMBED_EVENT_ORIGIN || !data || typeof data !== "object") {
    return null;
  }

  const type = Reflect.get(data, "type");
  return typeof type === "string" && FIGMA_ACCESS_SIGNALS.includes(type as FigmaAccessSignal)
    ? (type as FigmaAccessSignal)
    : null;
}

export function applyFigmaAccessSignal(signal: FigmaAccessSignal): FigmaAccessPreflight {
  switch (signal) {
    case "INITIAL_LOAD":
      return Object.freeze({
        status: "accessible",
        publishAllowed: true,
        classification: "eligible",
        message: "Public prototype access confirmed. This prototype may proceed to publish.",
      });
    case "LOGIN_SCREEN_SHOWN":
      return Object.freeze({
        status: "technical_blocked",
        publishAllowed: false,
        classification: "technical_blocked",
        reason: "login_required",
        message:
          "Figma login is required. This access state is unsupported in V1 and must not count as a usability failure.",
      });
    case "PASSWORD_SCREEN_SHOWN":
      return Object.freeze({
        status: "technical_blocked",
        publishAllowed: false,
        classification: "technical_blocked",
        reason: "password_required",
        message:
          "The prototype is password protected. This access state is unsupported in V1 and must not count as a usability failure.",
      });
  }
}

export function timeoutFigmaAccessPreflight(): FigmaAccessPreflight {
  return Object.freeze({
    status: "technical_blocked",
    publishAllowed: false,
    classification: "technical_blocked",
    reason: "preflight_timeout",
    message:
      "Prototype access could not be confirmed in time. Treat this as a technical block and do not publish yet.",
  });
}

export function withFigmaEmbedClientId(embedUrl: string, clientId: string): string {
  const id = clientId.trim();
  if (!id) throw new Error("Figma Embed API client ID is required for access preflight");

  const url = new URL(embedUrl);
  if (url.protocol !== "https:" || url.hostname !== "embed.figma.com") {
    throw new Error("Access preflight requires a normalized Figma embed URL");
  }

  url.searchParams.set("client-id", id);
  return url.toString();
}
