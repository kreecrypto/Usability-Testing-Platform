import {
  PrototypeImportError,
  validatePrototypeImport,
} from "../../../../../lib/builder/prototype-import.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_body" }, 400);
  }

  try {
    const prototype = validatePrototypeImport(
      String((body as Record<string, unknown>).prototypeUrl ?? ""),
    );
    return json({ prototype }, 200);
  } catch (error) {
    if (error instanceof PrototypeImportError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    return json({ error: "invalid_prototype_url" }, 400);
  }
}
