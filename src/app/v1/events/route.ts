import {
  createEventCollectorHandler,
  type PersistAcceptedEvent,
} from "../../../lib/collector/event-collector.ts";
import { createReliableEventPersister } from "../../../lib/collector/reliable-event-persistence.ts";
import { createSupabaseDeadLetterRecorder } from "../../../lib/collector/supabase-event-dead-letter.ts";
import { createSupabaseEventPersister } from "../../../lib/collector/supabase-event-persistence.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const persist: PersistAcceptedEvent = async (event) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error("collector_not_configured");
  }

  const persistReliably = createReliableEventPersister({
    persist: createSupabaseEventPersister({ supabaseUrl, secretKey }),
    recordDeadLetter: createSupabaseDeadLetterRecorder({ supabaseUrl, secretKey }),
    maxAttempts: 3,
  });

  return persistReliably(event);
};

// Reliable persistence owns the bounded retry loop so exhaustion is recorded once in the DLQ.
const handler = createEventCollectorHandler({ persist, maxPersistenceAttempts: 1 });

export const POST = handler;
export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
