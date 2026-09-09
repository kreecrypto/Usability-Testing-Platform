import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createPublishVersioningStore, PublishVersioningError } from "../../../../../lib/builder/publish-versioning.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ testId: string }> };

type PublishAction = "publish" | "create_draft" | "save_funnel";

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

function storeFor(request: Request) {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) return null;
  const config = publicSupabaseConfig();
  return createPublishVersioningStore({ supabaseUrl: config.url, publicKey: config.key, accessToken });
}

function errorResponse(error: unknown): Response {
  if (error instanceof PublishVersioningError) {
    if (error.status === 401) return json({ error: "authentication_required" }, 401);
    return json({ error: error.code, message: error.message }, error.status);
  }
  return json({ error: "data_request_failed" }, 502);
}

function screenIdsFrom(body: Record<string, unknown>): string[] | null {
  const value = body.screenIds;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  return value;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    const { testId } = await context.params;
    return json({ preview: await store.preview(testId) }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
  const record = body as Record<string, unknown>;
  const action = record.action;
  if (action !== "publish" && action !== "create_draft" && action !== "save_funnel") {
    return json({ error: "invalid_action" }, 400);
  }

  try {
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    const { testId } = await context.params;
    let preview;
    if (action === ("publish" satisfies PublishAction)) {
      preview = await store.publish(testId);
    } else if (action === ("create_draft" satisfies PublishAction)) {
      preview = await store.createDraftFromPublished(testId);
    } else {
      const screenIds = screenIdsFrom(record);
      if (!screenIds) return json({ error: "invalid_funnel_screen_ids" }, 400);
      preview = await store.saveFunnel(testId, screenIds);
    }
    return json({ preview }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
