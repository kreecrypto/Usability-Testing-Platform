import { findingsError, findingsForRequest, findingsJson, readObject } from "../../../lib/findings/api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const retest = await findingsForRequest(request).createRetest(await readObject(request));
    return findingsJson({ retest }, 201);
  } catch (error) { return findingsError(error); }
}
