import { clearAccessCookieHeader } from "../../../../lib/auth/session.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const secure = new URL(request.url).protocol === "https:";
  return new Response(JSON.stringify({ status: "signed_out" }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "set-cookie": clearAccessCookieHeader(secure),
    },
  });
}
