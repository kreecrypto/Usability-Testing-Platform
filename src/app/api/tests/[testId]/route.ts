import {
  crudErrorResponse,
  crudForRequest,
  jsonResponse,
  readJsonObject,
} from "../../../../lib/project-test-api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ testId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { testId } = await context.params;
    const test = await crudForRequest(request).getTest(testId);
    return test ? jsonResponse({ test }) : jsonResponse({ error: "not_found" }, 404);
  } catch (error) {
    return crudErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { testId } = await context.params;
    const body = await readJsonObject(request);
    const crud = crudForRequest(request);
    const test = body.action === "archive"
      ? await crud.archiveTest(testId)
      : await crud.updateTest(testId, {
          title: body.title as string | undefined,
          description: body.description as string | null | undefined,
        });
    return test ? jsonResponse({ test }) : jsonResponse({ error: "not_found" }, 404);
  } catch (error) {
    return crudErrorResponse(error);
  }
}
