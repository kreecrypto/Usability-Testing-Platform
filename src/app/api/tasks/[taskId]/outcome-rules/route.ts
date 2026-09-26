import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import {
  createTaskOutcomeRuleStore,
  TaskOutcomeRuleStoreError,
} from "../../../../../lib/builder/task-outcome-rule-store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ taskId: string }> };

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

function storeFor(request: Request) {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) return null;
  const config = publicSupabaseConfig();
  return createTaskOutcomeRuleStore({
    supabaseUrl: config.url,
    publicKey: config.key,
    accessToken,
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof TaskOutcomeRuleStoreError) {
    if (error.status === 401) return json({ error: "authentication_required" }, 401);
    return json({ error: error.code, message: error.message }, error.status);
  }
  return json({ error: "data_request_failed" }, 502);
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    const { taskId } = await context.params;
    return json({ rules: await store.get(taskId) }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
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
    const store = storeFor(request);
    if (!store) return json({ error: "authentication_required" }, 401);
    const { taskId } = await context.params;
    const input = body as Record<string, unknown>;
    const successRule = input.successRule;
    const failureRule = input.failureRule;
    if (!successRule || typeof successRule !== "object" || Array.isArray(successRule) ||
        !failureRule || typeof failureRule !== "object" || Array.isArray(failureRule)) {
      return json({ error: "invalid_rule" }, 400);
    }

    const rules = await store.save(taskId, {
      successRule: successRule as Readonly<{ type: unknown; values: unknown }>,
      failureRule: failureRule as Readonly<{ type: unknown; values: unknown }>,
      expectedPath: input.expectedPath,
    });
    return json({ rules }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
