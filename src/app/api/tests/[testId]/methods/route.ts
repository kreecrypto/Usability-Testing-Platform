import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createMethodBuilderStore, MethodBuilderError } from "../../../../../lib/methods/builder-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ testId: string }> };

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}
function storeFor(request: Request) {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) return null;
  const config = publicSupabaseConfig();
  return createMethodBuilderStore({ supabaseUrl: config.url, publicKey: config.key, accessToken });
}
function fail(error: unknown): Response {
  if (error instanceof MethodBuilderError) return json({ error: error.code }, error.status);
  return json({ error: "data_request_failed" }, 502);
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    return json(await store.overview((await context.params).testId), 200);
  } catch (error) { return fail(error); }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
    const testId = (await context.params).testId;
    if (body.action === "initialize") return json(await store.initialize(testId), 201);
    if (body.action === "add") return json({ block: await store.addBlock(testId, { kind: body.kind, title: body.title, config: body.config }) }, 201);
    if (body.action === "save_screener") return json({ version: await store.saveScreener(testId, body.config, body.inviteOnly) }, 200);
    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "invalid_json" }, 400);
    return fail(error);
  }
}

export async function PUT(request: Request, context: Context): Promise<Response> {
  try {
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
    return json({ block: await store.updateBlock((await context.params).testId, String(body.blockId ?? ""), { title: body.title, config: body.config }) }, 200);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "invalid_json" }, 400);
    return fail(error);
  }
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  try {
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
    await store.deleteBlock((await context.params).testId, String(body.blockId ?? ""));
    return json({ deleted: true }, 200);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "invalid_json" }, 400);
    return fail(error);
  }
}
