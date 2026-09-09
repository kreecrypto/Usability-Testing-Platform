import {
  CrudHttpError,
  jsonResponse,
  readJsonObject,
} from "../../../../../lib/project-test-api.ts";
import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
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
    return jsonResponse({ error: "invalid_input", field: error.field, message: error.message }, 400);
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
    const accessToken = accessTokenFromRequest(request);
    if (!accessToken) throw new CrudHttpError(401, "authentication_required");

    const config = publicSupabaseConfig();
    const { taskId } = await context.params;
    const body = await readJsonObject(request);
    const store = createPrototypeFrameMappingPersistence({
      supabaseUrl: config.url,
      anonKey: config.key,
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
