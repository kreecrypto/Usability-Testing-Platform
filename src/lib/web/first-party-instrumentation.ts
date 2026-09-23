import type { RawTrackingEvent } from "../tracking/events.ts";

export const FIRST_PARTY_WEB_ADAPTER_VERSION = "first-party-web-v1" as const;

export type FirstPartyWebEvidence = Readonly<{
  eventType: "screen_view" | "pointer_interaction" | "completion_signal" | "scroll";
  screenId?: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type FirstPartyWebContext = Readonly<{
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
  taskId?: string;
}>;

export type FirstPartyWebAdapter = Readonly<{
  recordScreenView: (
    screenId: string,
    previousScreenId?: string,
    navigation?: Readonly<{ url?: string; route?: string }>,
  ) => Promise<RawTrackingEvent | null>;
  recordPointer: (input: Readonly<{ screenId: string; x: number; y: number; viewportWidth: number; viewportHeight: number; elementId?: string }>) => Promise<RawTrackingEvent | null>;
  recordCompletionSignal: (signalId: string, screenId?: string) => Promise<RawTrackingEvent | null>;
  recordScroll: (input: Readonly<{ screenId: string; scrollX: number; scrollY: number; documentWidth: number; documentHeight: number }>) => Promise<RawTrackingEvent | null>;
}>;

function assertScreenId(screenId: string): string {
  const value = screenId.trim();
  if (!value || value.length > 512) throw new Error("invalid_screen_id");
  return value;
}

function finiteNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid_${field}`);
  return value;
}

export function createFirstPartyWebInstrumentation(options: {
  context: FirstPartyWebContext;
  hasConsent: () => boolean;
  enqueue: (event: RawTrackingEvent) => Promise<void>;
  now?: () => string;
  randomId?: () => string;
}) : FirstPartyWebAdapter {
  let sequence = 0;
  const now = options.now ?? (() => new Date().toISOString());
  const randomId = options.randomId ?? (() => crypto.randomUUID());\n  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("invalid_initial_sequence");

  async function emit(evidence: FirstPartyWebEvidence): Promise<RawTrackingEvent | null> {
    if (!options.hasConsent()) return null;
    const eventId = randomId();
    const event: RawTrackingEvent = {
      schemaVersion: 2,
      eventId,
      idempotencyKey: eventId,
      eventType: evidence.eventType,
      eventLayer: "raw",
      source: "prototype_adapter",
      occurredAt: now(),
      sequence: ++sequence,
      sessionId: options.context.sessionId,
      participantId: options.context.participantId,
      testId: options.context.testId,
      testVersionId: options.context.testVersionId,
      ...(options.context.taskId ? { taskId: options.context.taskId } : {}),
      ...(evidence.screenId ? { screenId: evidence.screenId } : {}),
      metadata: {
        ...evidence.metadata,
        targetProvider: "first_party_web",
        adapterVersion: FIRST_PARTY_WEB_ADAPTER_VERSION,
      },
    };
    await options.enqueue(event);
    return event;
  }

  return Object.freeze({
    recordScreenView(screenId, previousScreenId, navigation) {
      const current = assertScreenId(screenId);
      const previous = previousScreenId ? assertScreenId(previousScreenId) : undefined;
      let url: string | undefined;
      if (navigation?.url) {
        const parsed = new URL(navigation.url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid_navigation_url");
        parsed.hash = "";
        url = parsed.toString();
      }
      const route = navigation?.route?.trim();
      if (route && (!route.startsWith("/") || /\s/.test(route))) throw new Error("invalid_navigation_route");
      return emit({
        eventType: "screen_view",
        screenId: current,
        metadata: {
          ...(previous ? { previousScreenId: previous } : {}),
          ...(url ? { url } : {}),
          ...(route ? { route } : {}),
        },
      });
    },
    recordPointer(input) {
      const screenId = assertScreenId(input.screenId);
      const width = finiteNonNegative(input.viewportWidth, "viewport_width");
      const height = finiteNonNegative(input.viewportHeight, "viewport_height");
      const x = finiteNonNegative(input.x, "pointer_x");
      const y = finiteNonNegative(input.y, "pointer_y");
      if (width <= 0 || height <= 0 || x > width || y > height) throw new Error("pointer_out_of_bounds");
      return emit({
        eventType: "pointer_interaction",
        screenId,
        metadata: {
          coordinateSpace: "viewport",
          coordinateTransformVersion: FIRST_PARTY_WEB_ADAPTER_VERSION,
          x,
          y,
          normalizedX: x / width,
          normalizedY: y / height,
          viewportWidth: width,
          viewportHeight: height,
          ...(input.elementId ? { elementId: input.elementId } : {}),
        },
      });
    },
    recordCompletionSignal(signalId, screenId) {
      const signal = signalId.trim();
      if (!signal || signal.length > 512) throw new Error("invalid_completion_signal");
      const screen = screenId ? assertScreenId(screenId) : undefined;
      return emit({
        eventType: "completion_signal",
        ...(screen ? { screenId: screen } : {}),
        metadata: { signalId: signal },
      });
    },
    recordScroll(input) {
      const screenId = assertScreenId(input.screenId);
      const documentWidth = finiteNonNegative(input.documentWidth, "document_width");
      const documentHeight = finiteNonNegative(input.documentHeight, "document_height");
      const scrollX = finiteNonNegative(input.scrollX, "scroll_x");
      const scrollY = finiteNonNegative(input.scrollY, "scroll_y");
      if (documentWidth <= 0 || documentHeight <= 0) throw new Error("invalid_document_geometry");
      return emit({
        eventType: "scroll",
        screenId,
        metadata: { scrollX, scrollY, documentWidth, documentHeight, evidenceSource: "owned_document" },
      });
    },
  });
}
