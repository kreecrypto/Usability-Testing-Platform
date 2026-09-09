import { accessTokenFromRequest, publicSupabaseConfig } from "../auth/session.ts";
import { createFindingsStore, FindingsStoreError } from "./store.ts";

export function findingsForRequest(request: Request) {
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) throw new FindingsStoreError("unauthorized", 401, "authentication_required");
  const config = publicSupabaseConfig();
  return createFindingsStore({ supabaseUrl: config.url, anonKey: config.key, accessToken });
}

export function findingsJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export function findingsError(error: unknown): Response {
  if (error instanceof FindingsStoreError) return findingsJson({ error: error.message, code: error.code }, error.status);
  return findingsJson({ error: "findings_request_failed" }, 502);
}

export async function readObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await request.json(); }
  catch { throw new FindingsStoreError("validation_error", 400, "invalid_json"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FindingsStoreError("validation_error", 400, "invalid_body");
  return value as Record<string, unknown>;
}
