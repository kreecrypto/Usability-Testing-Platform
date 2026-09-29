import { clearFlowCookie, exchangeAuthCode, readAuthFlow, setSessionCookies } from "../../../lib/auth/lifecycle.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const flow = readAuthFlow(request);
  const code = url.searchParams.get("code");
  const failure = () => new Response(null, { status: 303, headers: {
    location: new URL("/login?notice=link_invalid", url.origin).href,
    "cache-control": "private, no-store", "referrer-policy": "no-referrer",
    "set-cookie": clearFlowCookie(secure),
  } });
  if (!flow || !code || url.searchParams.has("error")) return failure();
  try {
    const session = await exchangeAuthCode(code, flow.verifier);
    const response = new Response(null, { status: 303, headers: {
      location: new URL(flow.kind === "recovery" ? "/reset-password" : flow.next, url.origin).href,
      "cache-control": "private, no-store", "referrer-policy": "no-referrer",
    } });
    setSessionCookies(response, session, secure);
    response.headers.append("set-cookie", clearFlowCookie(secure));
    return response;
  } catch { return failure(); }
}
