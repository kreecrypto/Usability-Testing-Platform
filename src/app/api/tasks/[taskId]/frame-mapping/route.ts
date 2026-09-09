import {
  CrudHttpError,
  jsonResponse,
  readJsonObject,
} from "../../../../../lib/project-test-api.ts";
import { bearerAccessToken } from "../../../../../lib/project-test-crud.ts";
import {
  createPrototypeFrameMappingPersistence,
  FrameMappingProviderError,
  FrameMappingValidationError,
} from "../../../../../lib/figma/frame-mapping.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ taskId: string }> };

function errorResponse(error: unknown): Response {
  if (error instanceof CrudHttpError) {
    return jsonResponse({ error: error.code }, error.status);
  }
  if (error instanceof FrameMappingValidationError) {
    return jsonResponse({ error: "invalid_input", field: error.field }, 400);
  }
  if (error instanceof FrameMappingProviderError) {
    if (error.status === 401) return jsonResponse({ error: "authentication_required" }, 401);
    if (error.status === 403 || error.code === "42501") {
      return jsonResponse({ error: "permission_denied" }, 403);
    }
    if (error.code === "P0002") return jsonResponse({ error: "not_found" }, 404);
    if (error.code === "23514" || error.code === "22023") {
      return jsonResponse({ error: "invalid_mapping" }, 400);
    }
    return jsonResponse({ error: "data_request_failed" }, 502);
  }
  return jsonResponse({ error: "internal_error" }, 500);
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const accessToken = bearerAccessToken(request);
    if (!accessToken) throw new CrudHttpError(401, "authentication_required");

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new CrudHttpError(503, "data_service_not_configured");

    const { taskId } = await context.params;
    const body = await readJsonObject(request);
    const store = createPrototypeFrameMappingPersistence({
      supabaseUrl,
      anonKey,
      accessToken,
    });

    const mapping = await store.save({
      workspaceId: body.workspaceId,
      testVersionId: body.testVersionId,
      taskId,
      prototypeUrl: body.prototypeUrl,
      startNodeId: body.startNodeId,
      successNodeIds: body.successNodeIds,
      failureNodeIds: body.failureNodeIds,
    });

    return jsonResponse({ mapping });
  } catch (error) {
    return errorResponse(error);
  }
}
