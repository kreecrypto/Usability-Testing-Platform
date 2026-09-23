import {
  createFirstPartyWebInstrumentation,
  FIRST_PARTY_WEB_ADAPTER_VERSION,
  type FirstPartyWebContext,
} from "./first-party-instrumentation.ts";
import type { RawTrackingEvent } from "../tracking/events.ts";

export const FIRST_PARTY_BRIDGE_PROTOCOL = "utp:first-party-web" as const;
export const FIRST_PARTY_BRIDGE_PROTOCOL_VERSION = 1 as const;

export type FirstPartyBridgeMessageLike = Readonly<{
  origin: string;
  source: unknown;
  data: unknown;
}>;

export type FirstPartyBridgeOutcome =
  | Readonly<{ status: "ignored_origin" }>
  | Readonly<{ status: "ignored_source" }>
  | Readonly<{ status: "ignored_unsupported" }>
  | Readonly<{ status: "invalid_provider_event"; providerEventType?: string }>
  | Readonly<{ status: "operational"; signal: "ready" }>
  | Readonly<{ status: "emitted"; event: RawTrackingEvent }>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * Browser trust boundary for approved first-party Test Target messages.
 *
 * Both exact origin and exact WindowProxy source must match. The target never
 * receives session credentials. Messages become canonical evidence only in the
 * UTP runner after consent and active-task checks have passed.
 */
export function createFirstPartyMessageBridge(options: {
  expectedOrigin: string;
  expectedSource: () => unknown;
  session: FirstPartyWebContext;
  emitTrackingEvent: (event: RawTrackingEvent) => void | Promise<void>;
  onOperationalSignal?: (signal: "ready") => void | Promise<void>;
  initialSequence?: number;
}) {
  const expectedOrigin = new URL(options.expectedOrigin).origin;
  const instrumentation = createFirstPartyWebInstrumentation({
    context: options.session,
    hasConsent: () => true,
    enqueue: async (event) => { await options.emitTrackingEvent(event); },
    initialSequence: options.initialSequence,
  });

  async function handleMessage(message: FirstPartyBridgeMessageLike): Promise<FirstPartyBridgeOutcome> {
    if (message.origin !== expectedOrigin) return Object.freeze({ status: "ignored_origin" });
    if (message.source !== options.expectedSource()) return Object.freeze({ status: "ignored_source" });

    const payload = record(message.data);
    if (
      payload?.protocol !== FIRST_PARTY_BRIDGE_PROTOCOL ||
      payload.version !== FIRST_PARTY_BRIDGE_PROTOCOL_VERSION ||
      typeof payload.type !== "string"
    ) {
      return Object.freeze({ status: "ignored_unsupported" });
    }

    const data = record(payload.data) ?? {};
    try {
      if (payload.type === "ready") {
        if (data.bridgeVersion !== FIRST_PARTY_WEB_ADAPTER_VERSION) {
          return Object.freeze({ status: "invalid_provider_event", providerEventType: payload.type });
        }
        await options.onOperationalSignal?.("ready");
        return Object.freeze({ status: "operational", signal: "ready" });
      }

      let event: RawTrackingEvent | null = null;
      if (payload.type === "screen_view") {
        const screenId = text(data.screenId);
        if (!screenId) throw new Error("invalid_screen_id");
        event = await instrumentation.recordScreenView(
          screenId,
          text(data.previousScreenId),
          { url: text(data.url), route: text(data.route) },
        );
      } else if (payload.type === "pointer") {
        const screenId = text(data.screenId);
        const x = number(data.x);
        const y = number(data.y);
        const viewportWidth = number(data.viewportWidth);
        const viewportHeight = number(data.viewportHeight);
        if (!screenId || x === undefined || y === undefined || viewportWidth === undefined || viewportHeight === undefined) {
          throw new Error("invalid_pointer");
        }
        event = await instrumentation.recordPointer({
          screenId,
          x,
          y,
          viewportWidth,
          viewportHeight,
          ...(text(data.elementId) ? { elementId: text(data.elementId) } : {}),
        });
      } else if (payload.type === "scroll") {
        const screenId = text(data.screenId);
        const scrollX = number(data.scrollX);
        const scrollY = number(data.scrollY);
        const documentWidth = number(data.documentWidth);
        const documentHeight = number(data.documentHeight);
        if (!screenId || scrollX === undefined || scrollY === undefined || documentWidth === undefined || documentHeight === undefined) {
          throw new Error("invalid_scroll");
        }
        event = await instrumentation.recordScroll({ screenId, scrollX, scrollY, documentWidth, documentHeight });
      } else if (payload.type === "completion_signal") {
        const signalId = text(data.signalId);
        if (!signalId) throw new Error("invalid_completion_signal");
        event = await instrumentation.recordCompletionSignal(signalId, text(data.screenId));
      } else {
        return Object.freeze({ status: "ignored_unsupported" });
      }

      if (!event) return Object.freeze({ status: "ignored_unsupported" });
      return Object.freeze({ status: "emitted", event });
    } catch (error) {
      if (error instanceof Error && /^invalid_/.test(error.message)) {
        return Object.freeze({ status: "invalid_provider_event", providerEventType: payload.type });
      }
      throw error;
    }
  }

  return Object.freeze({ handleMessage });
}
