import { findingsError, findingsForRequest, findingsJson, readObject } from "../../../../../lib/findings/api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ findingId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { findingId } = await context.params;
    const evidence = await findingsForRequest(request).listEvidence(findingId);
    return findingsJson({ evidence });
  } catch (error) { return findingsError(error); }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { findingId } = await context.params;
    const evidence = await findingsForRequest(request).linkEvidence(findingId, await readObject(request));
    return findingsJson({ evidence }, 201);
  } catch (error) { return findingsError(error); }
}
