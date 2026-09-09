import { findingsError, findingsForRequest, findingsJson, readObject } from "../../../lib/findings/api.ts";

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
    const finding = await findingsForRequest(request).createFinding(await readObject(request));
    return findingsJson({ finding }, 201);
  } catch (error) { return findingsError(error); }
}
