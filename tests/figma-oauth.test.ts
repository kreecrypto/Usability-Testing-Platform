import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFigmaAuthorizationUrl,
  buildFigmaPocEmbedUrl,
  constantTimeStateEquals,
  exchangeFigmaAuthorizationCode,
  verifyFigmaOAuthAccessToken,
} from "../src/lib/figma/oauth.ts";

const config = {
  clientId: "client-123",
  clientSecret: "secret-456",
  redirectUri: "https://dev.example.com/api/integrations/figma/callback",
};

test("authorization URL carries state, redirect URI, scopes and code response type", () => {
  const url = new URL(buildFigmaAuthorizationUrl(config, "state-123"));
  assert.equal(url.origin, "https://www.figma.com");
  assert.equal(url.pathname, "/oauth");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(url.searchParams.get("scope"), "current_user:read,file_content:read");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("response_type"), "code");
});

test("OAuth state comparison rejects mismatches", () => {
  assert.equal(constantTimeStateEquals("same-state", "same-state"), true);
  assert.equal(constantTimeStateEquals("same-state", "other-state"), false);
  assert.equal(constantTimeStateEquals("short", "a-much-longer-state"), false);
});

test("authorization code exchange uses HTTP Basic auth and form encoding", async () => {
  let capturedInput: RequestInfo | URL | undefined;
  let capturedInit: RequestInit | undefined;
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedInput = input;
    capturedInit = init;
    return new Response(
      JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        user_id_string: "figma-user-1",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const token = await exchangeFigmaAuthorizationCode("code-123", config, fakeFetch);
  assert.equal(capturedInput, "https://api.figma.com/v1/oauth/token");
  assert.equal(capturedInit?.method, "POST");

  const headers = new Headers(capturedInit?.headers);
  assert.equal(
    headers.get("authorization"),
    `Basic ${Buffer.from("client-123:secret-456").toString("base64")}`,
  );
  assert.equal(headers.get("content-type"), "application/x-www-form-urlencoded");

  const body = capturedInit?.body as URLSearchParams;
  assert.equal(body.get("redirect_uri"), config.redirectUri);
  assert.equal(body.get("code"), "code-123");
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(token.accessToken, "access-token");
  assert.equal(token.userId, "figma-user-1");
});

test("OAuth proof verifies the token against Figma /v1/me", async () => {
  let bearer = "";
  const fakeFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bearer = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(JSON.stringify({ id: "1", handle: "Example" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  await verifyFigmaOAuthAccessToken("access-token", fakeFetch);
  assert.equal(bearer, "Bearer access-token");
});

test("prototype proof embeds the pinned version and exact start point", () => {
  const url = new URL(
    buildFigmaPocEmbedUrl({
      clientId: "client-123",
      fileKey: "abcdefghijklmnopqrstuv",
      versionId: "1234567890123456789",
      startNodeId: "5:3",
    }),
  );

  assert.equal(url.origin, "https://embed.figma.com");
  assert.equal(url.pathname, "/proto/abcdefghijklmnopqrstuv");
  assert.equal(url.searchParams.get("client-id"), "client-123");
  assert.equal(url.searchParams.get("version-id"), "1234567890123456789");
  assert.equal(url.searchParams.get("node-id"), "5:3");
  assert.equal(url.searchParams.get("starting-point-node-id"), "5:3");
  assert.equal(url.searchParams.get("embed-host"), "ut-platform-task15");
});
