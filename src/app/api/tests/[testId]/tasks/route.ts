import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createTaskScenarioBuilder, TaskBuilderError } from "../../../../../lib/builder/task-scenario-builder.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ testId: string }> };

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

function builderFor(request: Request) {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) return null;
  const config = publicSupabaseConfig();
  return createTaskScenarioBuilder({
    supabaseUrl: config.url,
    publicKey: config.key,
    accessToken,
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof TaskBuilderError) {
    if (error.status === 401) return json({ error: "authentication_required" }, 401);
    return json({ error: error.code, message: error.message }, error.status);
  }
  return json({ error: "data_request_failed" }, 502);
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const builder = builderFor(request);
    if (!builder) return json({ error: "authentication_required" }, 401);
    const { testId } = await context.params;
    return json({ tasks: await builder.listTasks(testId) }, 200);
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_body" }, 400);
  }

  try {
    const builder = builderFor(request);
    if (!builder) return json({ error: "authentication_required" }, 401);
    const { testId } = await context.params;
    const input = body as Record<string, unknown>;
    const task = await builder.createTask(testId, {
      title: String(input.title ?? ""),
      scenario: input.scenario === null ? null : String(input.scenario ?? ""),
      instruction: input.instruction === null ? null : String(input.instruction ?? ""),
    });
    return json({ task }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_body" }, 400);
  }

  try {
    const builder = builderFor(request);
    if (!builder) return json({ error: "authentication_required" }, 401);
    const { testId } = await context.params;
    const input = body as Record<string, unknown>;
    if (Array.isArray(input.taskIds)) {
      return json({ tasks: await builder.reorderTasks(testId, input.taskIds.map(String)) }, 200);
    }
    const taskId = String(input.taskId ?? "");
    const task = await builder.updateTask(testId, taskId, {
      title: String(input.title ?? ""),
      scenario: input.scenario === null ? null : String(input.scenario ?? ""),
      instruction: input.instruction === null ? null : String(input.instruction ?? ""),
    });
    return json({ task }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
