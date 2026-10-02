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
    const result = await crudForRequest(request).pageProjects(workspaceId, { page: Number(url.searchParams.get("page") ?? 1), pageSize: Number(url.searchParams.get("pageSize") ?? 20), search: url.searchParams.get("search") ?? "", status: url.searchParams.get("status") ?? "all" });
    return jsonResponse({ projects: result.items, pagination: result.pagination });
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
