import { findingContextForRequest, findingsError, findingsForRequest, findingsJson, readObject } from "../../../lib/findings/api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const testVersionId = new URL(request.url).searchParams.get("testVersionId") ?? "";
    const findings = await findingsForRequest(request).listFindings(testVersionId);
    return findingsJson({ findings });
  } catch (error) { return findingsError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readObject(request);
    const testVersionId = typeof body.testVersionId === "string" ? body.testVersionId : "";
    const scope = await findingContextForRequest(request).version(testVersionId);
    const finding = await findingsForRequest(request).createFinding({
      ...body,
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      testVersionId,
    });
    return findingsJson({ finding }, 201);
  } catch (error) { return findingsError(error); }
}
