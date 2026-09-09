import type { AcceptedTrackingEvent, RawTrackingEvent } from "../tracking/events.ts";
import type { PersistAcceptedEvent, PersistAcceptedEventResult } from "./event-collector.ts";

export type RecordDeadLetter = (
  event: AcceptedTrackingEvent<RawTrackingEvent>,
  attemptCount: number,
) => Promise<void>;

export function createReliableEventPersister(options: {
  persist: PersistAcceptedEvent;
  recordDeadLetter: RecordDeadLetter;
  maxAttempts: number;
}): PersistAcceptedEvent {
  if (!Number.isSafeInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  return async function persistReliably(
    event: AcceptedTrackingEvent<RawTrackingEvent>,
  ): Promise<PersistAcceptedEventResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
      try {
        return (await options.persist(event)) ?? "accepted";
      } catch (error) {
        lastError = error;
      }
    }

    await options.recordDeadLetter(event, options.maxAttempts);
    throw lastError instanceof Error ? lastError : new Error("event_persist_failed");
  };
}
