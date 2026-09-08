import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import {
  buildFigmaAuthorizationUrl,
  readFigmaOAuthConfig,
} from "@/lib/figma/oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const config = readFigmaOAuthConfig();
    const state = randomBytes(32).toString("hex");
    const authorizationUrl = buildFigmaAuthorizationUrl(config, state);
    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set("figma_oauth_state", state, {
      httpOnly: true,
      secure: request.url.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/figma-poc?oauth=config_missing", request.url));
  }
}
