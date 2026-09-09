import { FIGMA_EMBED_EVENT_ORIGIN } from "./access-preflight.ts";
import {
  adaptFigmaEmbedEvent,
  FigmaAdapterValidationError,
  type FigmaOperationalSignal,
} from "./event-adapter.ts";
import type { RawTrackingEvent } from "../tracking/events.ts";

export type FigmaMessageLike = Readonly<{
  origin: string;
  source: unknown;
  data: unknown;
}>;

export type FigmaBridgeSession = Readonly<{
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  taskId?: string;
}>;

export type FigmaBridgeOutcome =
  | Readonly<{ status: "ignored_origin" }>
  | Readonly<{ status: "ignored_source" }>
  | Readonly<{ status: "ignored_unsupported"; providerEventType?: string }>
  | Readonly<{ status: "invalid_provider_event"; providerEventType: string }>
  | Readonly<{ status: "operational"; signal: FigmaOperationalSignal }>
  | Readonly<{ status: "emitted"; event: RawTrackingEvent }>;

function providerMessage(data: unknown): Readonly<{ type: string; data: unknown }> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const type = Reflect.get(data, "type");
  if (typeof type !== "string" || type.trim() === "") return null;
  return Object.freeze({ type: type.trim(), data: Reflect.get(data, "data") });
}

function defaultEventIdFactory(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("crypto.randomUUID is required to emit tracking events");
  }
  return globalThis.crypto.randomUUID();
}

/**
 * Browser-side trust boundary for Figma Embed API events.
 *
 * Only events from Figma's documented origin AND the exact expected iframe
 * window are considered. Operational signals never enter the usability raw
 * event stream. Unsupported/malformed provider messages fail closed.
 */
export function createFigmaInteractionEventBridge(options: {
  expectedSource: unknown;
  session: FigmaBridgeSession;
  emitTrackingEvent: (event: RawTrackingEvent) => void | Promise<void>;
  onOperationalSignal?: (signal: FigmaOperationalSignal) => void | Promise<void>;
  initialScreenId?: string;
  initialSequence?: number;
  now?: () => Date;
  eventIdFactory?: (sequence: number) => string;
}) {
  let currentScreenId = options.initialScreenId;
  let sequence = options.initialSequence ?? 0;
  const now = options.now ?? (() => new Date());
  const eventIdFactory = options.eventIdFactory ?? (() => defaultEventIdFactory());

  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("initialSequence must be a non-negative safe integer");
  }

  async function handleMessage(message: FigmaMessageLike): Promise<FigmaBridgeOutcome> {
    if (message.origin !== FIGMA_EMBED_EVENT_ORIGIN) {
      return Object.freeze({ status: "ignored_origin" });
    }
    if (message.source !== options.expectedSource) {
      return Object.freeze({ status: "ignored_source" });
    }

    const provider = providerMessage(message.data);
    if (!provider) {
      return Object.freeze({ status: "ignored_unsupported" });
    }

    const candidateSequence = sequence + 1;
    const occurredAt = now().toISOString();
    const eventId = eventIdFactory(candidateSequence);

    let adapted: ReturnType<typeof adaptFigmaEmbedEvent>;
    try {
      adapted = adaptFigmaEmbedEvent(provider.type, provider.data, {
        eventId,
        idempotencyKey: `${options.session.sessionId}:figma:${candidateSequence}`,
        occurredAt,
        sequence: candidateSequence,
        sessionId: options.session.sessionId,
        participantId: options.session.participantId,
        testId: options.session.testId,
        testVersionId: options.session.testVersionId,
        ...(options.session.taskId ? { taskId: options.session.taskId } : {}),
        ...(currentScreenId ? { previousScreenId: currentScreenId, currentScreenId } : {}),
      });
    } catch (error) {
      if (error instanceof FigmaAdapterValidationError) {
        const knownProviderEvent = [
          "MOUSE_PRESS_OR_RELEASE",
          "PRESENTED_NODE_CHANGED",
          "INITIAL_LOAD",
          "NEW_STATE",
          "REQUEST_CLOSE",
          "LOGIN_SCREEN_SHOWN",
          "PASSWORD_SCREEN_SHOWN",
        ].includes(provider.type);
        return knownProviderEvent
          ? Object.freeze({ status: "invalid_provider_event", providerEventType: provider.type })
          : Object.freeze({ status: "ignored_unsupported", providerEventType: provider.type });
      }
      throw error;
    }

    if (adapted.kind === "operational") {
      await options.onOperationalSignal?.(adapted.signal);
      return Object.freeze({ status: "operational", signal: adapted.signal });
    }

    await options.emitTrackingEvent(adapted.event);
    sequence = candidateSequence;
    if (adapted.event.eventType === "screen_view" && adapted.event.screenId) {
      currentScreenId = adapted.event.screenId;
    }
    return Object.freeze({ status: "emitted", event: adapted.event });
  }

  return Object.freeze({
    handleMessage,
    getState: () => Object.freeze({ sequence, currentScreenId }),
  });
}
