import { findingsError, findingsForRequest, findingsJson, readObject } from "../../../../lib/findings/api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ findingId: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { findingId } = await context.params;
    const finding = await findingsForRequest(request).updateFinding(findingId, await readObject(request));
    return findingsJson({ finding });
  } catch (error) { return findingsError(error); }
}
