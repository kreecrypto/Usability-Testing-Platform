import {
  crudErrorResponse,
  crudForRequest,
  jsonResponse,
  readJsonObject,
} from "../../../../lib/project-test-api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { projectId } = await context.params;
    const project = await crudForRequest(request).getProject(projectId);
    return project ? jsonResponse({ project }) : jsonResponse({ error: "not_found" }, 404);
  } catch (error) {
    return crudErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { projectId } = await context.params;
    const body = await readJsonObject(request);
    const crud = crudForRequest(request);
    const project = body.action === "archive"
      ? await crud.archiveProject(projectId)
      : await crud.updateProject(projectId, {
          name: body.name as string | undefined,
          description: body.description as string | null | undefined,
        });
    return project ? jsonResponse({ project }) : jsonResponse({ error: "not_found" }, 404);
  } catch (error) {
    return crudErrorResponse(error);
  }
}
