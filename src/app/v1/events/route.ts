import {
  createEventCollectorHandler,
  type PersistAcceptedEvent,
} from "../../../lib/collector/event-collector.ts";
import { createSupabaseEventPersister } from "../../../lib/collector/supabase-event-persistence.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const persist: PersistAcceptedEvent = async (event) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error("collector_not_configured");
  }

  const persistToSupabase = createSupabaseEventPersister({
    supabaseUrl,
    secretKey,
  });
  await persistToSupabase(event);
};

const handler = createEventCollectorHandler({ persist });

export const POST = handler;
export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
