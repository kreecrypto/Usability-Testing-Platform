import {
  crudErrorResponse,
  crudForRequest,
  jsonResponse,
  readJsonObject,
} from "../../../lib/project-test-api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const workspaceId = new URL(request.url).searchParams.get("workspaceId") ?? "";
    const projects = await crudForRequest(request).listProjects(workspaceId);
    return jsonResponse({ projects });
  } catch (error) {
    return crudErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const project = await crudForRequest(request).createProject({
      workspaceId: body.workspaceId as string,
      name: body.name as string,
      description: body.description as string | null | undefined,
    });
    return jsonResponse({ project }, 201);
  } catch (error) {
    return crudErrorResponse(error);
  }
}
