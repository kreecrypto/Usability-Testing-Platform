import { createPublicRunnerStore, PublicRunnerError } from "../../../../../lib/runner/public-session.ts";
import { createSupabaseAdminFetch } from "../../../../../lib/runner/supabase-admin-fetch.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ testVersionId: string }> };

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "public, max-age=0, must-revalidate" } });
}

function errorResponse(error: unknown): Response {
  if (error instanceof PublicRunnerError) return json({ error: error.code }, error.status);
  return json({ error: "data_request_failed" }, 502);
}

function requiredServerValue(value: string, field: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function snapshotServerConfig() {
  return Object.freeze({
    supabaseUrl: requiredServerValue(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", "SUPABASE_URL"),
    secretKey: requiredServerValue(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", "SUPABASE_SECRET_KEY"),
    figmaEmbedClientId: process.env.FIGMA_EMBED_CLIENT_ID?.trim() || null,
  });
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const config = snapshotServerConfig();
    const store = createPublicRunnerStore({
      ...config,
      // This endpoint only reads a published snapshot. Session/token creation
      // remains on the POST session route and still requires the real signing key.
      signingKey: "snapshot-only-not-used-for-token-minting",
      fetchImpl: createSupabaseAdminFetch(config.secretKey),
    });
    const { testVersionId } = await context.params;
    return json({ test: await store.snapshot(testVersionId) }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
