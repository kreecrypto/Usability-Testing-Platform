import {
  createEventCollectorHandler,
  type PersistAcceptedEvent,
} from "../../../lib/collector/event-collector.ts";
import { withSessionIngestionAuth } from "../../../lib/collector/authenticated-event-collector.ts";
import { createSupabaseEventPersister } from "../../../lib/collector/supabase-event-persistence.ts";
import { createSupabaseIngestionTokenConsumer } from "../../../lib/collector/supabase-ingestion-token-gate.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const ingestionTokenSecret = process.env.EVENT_INGESTION_TOKEN_SECRET;
const rateLimitPerMinute = Number(process.env.EVENT_INGESTION_RATE_LIMIT_PER_MINUTE);

const persist: PersistAcceptedEvent = async (event) => {
  if (!supabaseUrl || !secretKey) throw new Error("collector_not_configured");
  return createSupabaseEventPersister({ supabaseUrl, secretKey })(event);
};

const collector = createEventCollectorHandler({ persist });

const handler = supabaseUrl && secretKey && ingestionTokenSecret && Number.isSafeInteger(rateLimitPerMinute) && rateLimitPerMinute > 0
  ? withSessionIngestionAuth({
      handler: collector,
      secret: ingestionTokenSecret,
      consume: createSupabaseIngestionTokenConsumer({ supabaseUrl, secretKey, rateLimitPerMinute }),
    })
  : async () => new Response(JSON.stringify({ error: "collector_not_configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });

export const POST = handler;
export const GET = collector;
export const PUT = collector;
export const PATCH = collector;
export const DELETE = collector;
