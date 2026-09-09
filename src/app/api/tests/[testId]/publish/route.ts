import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createPublishVersioningStore, PublishVersioningError } from "../../../../../lib/builder/publish-versioning.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ testId: string }> };

type PublishAction = "publish" | "create_draft";

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
  const action = Reflect.get(body, "action");
  if (action !== "publish" && action !== "create_draft") return json({ error: "invalid_action" }, 400);

  try {
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    const { testId } = await context.params;
    const preview = action === ("publish" satisfies PublishAction)
      ? await store.publish(testId)
      : await store.createDraftFromPublished(testId);
    return json({ preview }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
