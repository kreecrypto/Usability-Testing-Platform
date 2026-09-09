import {
  createProjectTestCrud,
  CrudProviderError,
  CrudValidationError,
} from "./project-test-crud.ts";
import { accessTokenFromRequest } from "./auth/session.ts";

export class CrudHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "CrudHttpError";
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new CrudHttpError(400, "invalid_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CrudHttpError(400, "invalid_body");
  }
  return body as Record<string, unknown>;
}

export function crudForRequest(request: Request) {
  // Existing API clients may keep sending Authorization: Bearer. The authenticated
  // browser shell uses an HttpOnly UTP cookie instead so application code never
  // exposes the user JWT to client JavaScript. Both paths delegate authorization
  // to Supabase RLS with the same user access token.
  const accessToken = accessTokenFromRequest(request);
  if (!accessToken) throw new CrudHttpError(401, "authentication_required");

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new CrudHttpError(503, "data_service_not_configured");

  return createProjectTestCrud({ supabaseUrl, anonKey, accessToken });
}

export function crudErrorResponse(error: unknown): Response {
  if (error instanceof CrudHttpError) {
    return jsonResponse({ error: error.code }, error.status);
  }
  if (error instanceof CrudValidationError) {
    return jsonResponse({ error: "invalid_input", field: error.field }, 400);
  }
  if (error instanceof CrudProviderError) {
    if (error.status === 401) return jsonResponse({ error: "authentication_required" }, 401);
    if (error.status === 403) return jsonResponse({ error: "permission_denied" }, 403);
    if (error.status === 409) return jsonResponse({ error: "conflict" }, 409);
    return jsonResponse({ error: "data_request_failed" }, 502);
  }
  return jsonResponse({ error: "internal_error" }, 500);
}
