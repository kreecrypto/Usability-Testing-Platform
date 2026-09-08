import { NextResponse } from "next/server";

import {
  constantTimeStateEquals,
  exchangeFigmaAuthorizationCode,
  readFigmaOAuthConfig,
  verifyFigmaOAuthAccessToken,
} from "@/lib/figma/oauth";

export const runtime = "nodejs";

function redirectWithStatus(requestUrl: string, status: string) {
  return NextResponse.redirect(new URL(`/figma-poc?oauth=${encodeURIComponent(status)}`, requestUrl));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return redirectWithStatus(request.url, "denied");

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const expectedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("figma_oauth_state="))
    ?.slice("figma_oauth_state=".length) ?? "";

  if (!code || !state || !expectedState || !constantTimeStateEquals(state, expectedState)) {
    const response = redirectWithStatus(request.url, "state_invalid");
    response.cookies.delete("figma_oauth_state");
    return response;
  }

  try {
    const config = readFigmaOAuthConfig();
    const token = await exchangeFigmaAuthorizationCode(code, config);
    await verifyFigmaOAuthAccessToken(token.accessToken);

    const response = redirectWithStatus(request.url, "verified");
    response.cookies.delete("figma_oauth_state");
    response.cookies.set("figma_oauth_verified", "1", {
      httpOnly: true,
      secure: request.url.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    const response = redirectWithStatus(request.url, "exchange_failed");
    response.cookies.delete("figma_oauth_state");
    return response;
  }
}
