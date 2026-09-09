import { findingsError, findingsForRequest, findingsJson } from "../../../../lib/findings/api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ retestId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { retestId } = await context.params;
    const retest = await findingsForRequest(request).retestComparison(retestId);
    return findingsJson({ retest });
  } catch (error) { return findingsError(error); }
}
