import type { AcceptedTrackingEvent } from "../tracking/events.ts";

export const FUNNEL_SCHEMA_VERSION = "screen-funnel-v1" as const;

export type FunnelDefinition = Readonly<{
  version: typeof FUNNEL_SCHEMA_VERSION;
  screenIds: readonly string[];
}>;

export type FunnelTransitionResult = Readonly<{
  index: number;
  fromScreenId: string;
  toScreenId: string;
  entered: number;
  reached: number;
  dropped: number;
  conversionRate: number | null;
  dropOffRate: number | null;
}>;

export type FunnelResult = Readonly<{
  version: typeof FUNNEL_SCHEMA_VERSION;
  screenIds: readonly string[];
  eligibleSessionCount: number;
  technicalBlockedSessionCount: number;
  transitions: readonly FunnelTransitionResult[];
  largestDrop: FunnelTransitionResult | null;
}>;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result : null;
}

export function parseFunnelDefinition(value: unknown): FunnelDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const version = Reflect.get(value, "version");
  const rawScreenIds = Reflect.get(value, "screenIds");
  if (version !== FUNNEL_SCHEMA_VERSION || !Array.isArray(rawScreenIds)) return null;
  const screenIds = rawScreenIds.map(cleanText);
  if (screenIds.length < 2 || screenIds.some((item) => item === null)) return null;
  const normalized = screenIds as string[];
  if (new Set(normalized).size !== normalized.length) return null;
  return Object.freeze({ version: FUNNEL_SCHEMA_VERSION, screenIds: Object.freeze(normalized) });
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function sessionPath(events: readonly AcceptedTrackingEvent[]): string[] {
  return [...events]
    .filter((event) => event.eventLayer === "raw" && event.eventType === "screen_view" && event.screenId)
    .sort((a, b) => {
      const sequenceA = a.eventLayer === "raw" ? a.sequence : Number.MAX_SAFE_INTEGER;
      const sequenceB = b.eventLayer === "raw" ? b.sequence : Number.MAX_SAFE_INTEGER;
      return sequenceA - sequenceB || Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.eventId.localeCompare(b.eventId);
    })
    .map((event) => event.screenId!);
}

function isTechnicalBlocked(events: readonly AcceptedTrackingEvent[]): boolean {
  return events.some((event) =>
    event.eventLayer === "raw" &&
    (event.eventType === "session_technical_blocked" || event.eventType === "task_technical_blocked"),
  );
}

function orderedProgress(path: readonly string[], screenIds: readonly string[]): boolean[] {
  const reached = Array.from({ length: screenIds.length }, () => false);
  let cursor = 0;
  for (let step = 0; step < screenIds.length; step += 1) {
    const relative = path.slice(cursor).indexOf(screenIds[step]);
    if (relative < 0) break;
    const absolute = cursor + relative;
    reached[step] = true;
    cursor = absolute + 1;
  }
  return reached;
}

export function deriveFunnel(
  events: readonly AcceptedTrackingEvent[],
  definition: FunnelDefinition,
): FunnelResult {
  const bySession = new Map<string, AcceptedTrackingEvent[]>();
  for (const event of events) {
    const group = bySession.get(event.sessionId);
    if (group) group.push(event);
    else bySession.set(event.sessionId, [event]);
  }

  const progressBySession: boolean[][] = [];
  let technicalBlockedSessionCount = 0;
  for (const sessionEvents of bySession.values()) {
    if (isTechnicalBlocked(sessionEvents)) {
      technicalBlockedSessionCount += 1;
      continue;
    }
    progressBySession.push(orderedProgress(sessionPath(sessionEvents), definition.screenIds));
  }

  const transitions: FunnelTransitionResult[] = [];
  for (let index = 0; index < definition.screenIds.length - 1; index += 1) {
    const fromScreenId = definition.screenIds[index];
    const toScreenId = definition.screenIds[index + 1];
    const entered = progressBySession.filter((progress) => progress[index]).length;
    const reached = progressBySession.filter((progress) => progress[index + 1]).length;
    const dropped = entered - reached;
    transitions.push(Object.freeze({
      index,
      fromScreenId,
      toScreenId,
      entered,
      reached,
      dropped,
      conversionRate: percentage(reached, entered),
      dropOffRate: percentage(dropped, entered),
    }));
  }

  const ranked = transitions
    .filter((transition) => transition.dropOffRate !== null)
    .sort((a, b) =>
      (b.dropOffRate ?? -1) - (a.dropOffRate ?? -1)
      || b.dropped - a.dropped
      || a.index - b.index,
    );

  return Object.freeze({
    version: FUNNEL_SCHEMA_VERSION,
    screenIds: Object.freeze([...definition.screenIds]),
    eligibleSessionCount: progressBySession.length,
    technicalBlockedSessionCount,
    transitions: Object.freeze(transitions),
    largestDrop: ranked[0] ?? null,
  });
}
