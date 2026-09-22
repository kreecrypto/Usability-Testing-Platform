import { createEventOutbox, createHttpEventBatchSender, type IngestionCredential, type OutboxStorage } from "../tracking/event-outbox.ts";
import { createFirstPartyWebInstrumentation, type FirstPartyWebContext } from "./first-party-instrumentation.ts";

export type FirstPartySessionInstrumentation = Readonly<{
  instrumentation: ReturnType<typeof createFirstPartyWebInstrumentation>;
  flush: () => Promise<number>;
}>;

/**
 * Runtime composition root for an owned UAT/Production target.
 *
 * The adapter only creates canonical evidence after consent. Events first enter
 * the durable client outbox and are removed only after /v1/events accepts the
 * batch. The browser never receives a Supabase service credential and never
 * writes research events directly to the database.
 */
export function createFirstPartySessionInstrumentation(options: {
  context: FirstPartyWebContext;
  hasConsent: () => boolean;
  storage: OutboxStorage;
  refreshCredential: () => Promise<IngestionCredential>;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
  randomId?: () => string;
  maxBatchSize?: number;
}): FirstPartySessionInstrumentation {
  const endpoint = options.endpoint?.trim() || "/v1/events";
  if (!endpoint.startsWith("/") && !endpoint.startsWith("https://")) {
    throw new Error("invalid_event_endpoint");
  }

  const outbox = createEventOutbox({
    storage: options.storage,
    refreshCredential: options.refreshCredential,
    sendBatch: createHttpEventBatchSender({ endpoint, fetchImpl: options.fetchImpl }),
    maxBatchSize: options.maxBatchSize,
  });

  const instrumentation = createFirstPartyWebInstrumentation({
    context: options.context,
    hasConsent: options.hasConsent,
    enqueue: outbox.enqueue,
    now: options.now,
    randomId: options.randomId,
  });

  return Object.freeze({ instrumentation, flush: outbox.flush });
}
