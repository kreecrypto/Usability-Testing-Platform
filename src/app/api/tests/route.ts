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
    const tests = await crudForRequest(request).listTests(workspaceId, projectId);
    return jsonResponse({ tests });
  } catch (error) {
    return crudErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const test = await crudForRequest(request).createTest({
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
