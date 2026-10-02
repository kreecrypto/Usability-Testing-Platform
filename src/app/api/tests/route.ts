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
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? "";
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const result = await crudForRequest(request).pageTests(workspaceId, { projectId, page: Number(url.searchParams.get("page") ?? 1), pageSize: Number(url.searchParams.get("pageSize") ?? 20), search: url.searchParams.get("search") ?? "", status: url.searchParams.get("status") ?? "all" });
    return jsonResponse({ tests: result.items, pagination: result.pagination });
  } catch (error) {
    return crudErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const crud = crudForRequest(request);
    const project = await crud.getProject(body.projectId as string);
    if (!project || project.workspace_id !== body.workspaceId) return jsonResponse({error:"not_found"},404);
    if (project.status === "archived") return jsonResponse({error:"project_archived"},409);
    const test = await crud.createTest({
      workspaceId: body.workspaceId as string,
      projectId: body.projectId as string,
      title: body.title as string,
      description: body.description as string | null | undefined,
    });
    return jsonResponse({ test }, 201);
  } catch (error) {
    return crudErrorResponse(error);
  }
}
