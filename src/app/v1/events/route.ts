import { createEventCollectorHandler, type PersistAcceptedEvent } from "../../../lib/collector/event-collector.ts";
import { withSessionIngestionAuth } from "../../../lib/collector/authenticated-event-collector.ts";
import { createReliableEventPersister } from "../../../lib/collector/reliable-event-persistence.ts";
import { createSupabaseDeadLetterRecorder } from "../../../lib/collector/supabase-event-dead-letter.ts";
import { createSupabaseEventPersister } from "../../../lib/collector/supabase-event-persistence.ts";
import { createSupabaseIngestionTokenConsumer } from "../../../lib/collector/supabase-ingestion-token-gate.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const ingestionTokenSigningKey = process.env.EVENT_INGESTION_TOKEN_SECRET;
const rateLimitPerMinute = Number(process.env.EVENT_INGESTION_RATE_LIMIT_PER_MINUTE);

const persist: PersistAcceptedEvent = async (event) => {
  if (!supabaseUrl || !secretKey) throw new Error("collector_not_configured");

  const persistReliably = createReliableEventPersister({
    persist: createSupabaseEventPersister({ supabaseUrl, secretKey }),
    recordDeadLetter: createSupabaseDeadLetterRecorder({ supabaseUrl, secretKey }),
    maxAttempts: 3,
  });

  return persistReliably(event);
};

// Reliable persistence owns the bounded retry loop so exhaustion is recorded once in the DLQ.
const collector = createEventCollectorHandler({ persist, maxPersistenceAttempts: 1 });
const handler = supabaseUrl && secretKey && ingestionTokenSigningKey && Number.isSafeInteger(rateLimitPerMinute) && rateLimitPerMinute > 0
  ? withSessionIngestionAuth({ handler: collector, signingKey: ingestionTokenSigningKey, consume: createSupabaseIngestionTokenConsumer({ supabaseUrl, secretKey, rateLimitPerMinute }) })
  : async () => new Response(JSON.stringify({ error: "collector_not_configured" }), { status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export const POST = handler;
export const GET = collector;
export const PUT = collector;
export const PATCH = collector;
export const DELETE = collector;
