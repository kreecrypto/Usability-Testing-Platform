import { findingContextForRequest, findingsError, findingsForRequest, findingsJson, readObject } from "../../../lib/findings/api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readObject(request);
    const findingId = typeof body.findingId === "string" ? body.findingId : "";
    const scope = await findingContextForRequest(request).finding(findingId);
    if (body.originalTestVersionId !== scope.testVersionId) {
      return findingsJson({ error: "original_version_must_match_finding" }, 409);
    }
    const retest = await findingsForRequest(request).createRetest({
      ...body,
      workspaceId: scope.workspaceId,
      findingId,
    });
    return findingsJson({ retest }, 201);
  } catch (error) { return findingsError(error); }
}
