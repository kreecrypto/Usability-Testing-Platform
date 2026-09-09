import type { TrackingEvent } from "./events.ts";

export type OutboxStorage = Readonly<{
  load: () => Promise<readonly TrackingEvent[]>;
  save: (events: readonly TrackingEvent[]) => Promise<void>;
}>;

export type IngestionCredential = Readonly<{ token: string; expiresAt: string }>;
export type SendBatch = (events: readonly TrackingEvent[], credential: IngestionCredential) => Promise<void>;

function eventIdentity(event: TrackingEvent): string {
  return `${event.sessionId}\u0000${event.idempotencyKey}`;
}

export function createEventOutbox(options: {
  storage: OutboxStorage;
  refreshCredential: () => Promise<IngestionCredential>;
  sendBatch: SendBatch;
  maxBatchSize?: number;
}) {
  const maxBatchSize = options.maxBatchSize ?? 25;
  if (!Number.isSafeInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > 100) throw new Error("maxBatchSize must be 1..100");
  let flushing: Promise<number> | null = null;

  async function enqueue(event: TrackingEvent): Promise<void> {
    const current = [...await options.storage.load()];
    const identity = eventIdentity(event);
    const existing = current.find((candidate) => eventIdentity(candidate) === identity);
    if (existing) {
      if (existing.eventId !== event.eventId) throw new Error("outbox_idempotency_conflict");
      return;
    }
    current.push(event);
    await options.storage.save(current);
  }

  async function flushOnce(): Promise<number> {
    let delivered = 0;
    while (true) {
      const current = [...await options.storage.load()];
      if (current.length === 0) return delivered;
      const batch = Object.freeze(current.slice(0, maxBatchSize));
      const credential = await options.refreshCredential();
      await options.sendBatch(batch, credential);
      const deliveredIds = new Set(batch.map(eventIdentity));
      const latest = [...await options.storage.load()];
      await options.storage.save(latest.filter((event) => !deliveredIds.has(eventIdentity(event))));
      delivered += batch.length;
    }
  }

  async function flush(): Promise<number> {
    if (flushing) return flushing;
    flushing = flushOnce().finally(() => { flushing = null; });
    return flushing;
  }

  return Object.freeze({ enqueue, flush });
}

export function createBrowserLocalStorageOutboxStorage(sessionId: string, storage: Storage = localStorage): OutboxStorage {
  const key = `utp:event-outbox:v1:${sessionId}`;
  return Object.freeze({
    async load() {
      const raw = storage.getItem(key);
      if (!raw) return Object.freeze([]);
      let value: unknown;
      try { value = JSON.parse(raw); } catch { throw new Error("outbox_storage_corrupt"); }
      if (!Array.isArray(value)) throw new Error("outbox_storage_corrupt");
      return Object.freeze(value as TrackingEvent[]);
    },
    async save(events) {
      if (events.length === 0) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(events));
    },
  });
}

export function createHttpEventBatchSender(options: { endpoint: string; fetchImpl?: typeof fetch }): SendBatch {
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (events, credential) => {
    const response = await fetchImpl(options.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${credential.token}` },
      body: JSON.stringify({ events }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(response.status >= 500 ? "event_upload_transient_failure" : "event_upload_rejected");
  };
}
