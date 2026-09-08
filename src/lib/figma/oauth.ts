import { timingSafeEqual } from "node:crypto";

import { buildPinnedFigmaEmbedUrl } from "./version-pin.ts";

export const FIGMA_OAUTH_SCOPES = [
  "current_user:read",
  "file_content:read",
] as const;

export type FigmaOAuthConfig = Readonly<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}>;

export type FigmaPocEmbedConfig = Readonly<{
  clientId: string;
  fileKey: string;
  versionId: string;
  startNodeId: string;
}>;

type FigmaTokenResponse = Readonly<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  userId?: string;
}>;

function required(value: string | undefined, field: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

export function readFigmaOAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): FigmaOAuthConfig {
  return {
    clientId: required(env.FIGMA_CLIENT_ID, "FIGMA_CLIENT_ID"),
    clientSecret: required(env.FIGMA_CLIENT_SECRET, "FIGMA_CLIENT_SECRET"),
    redirectUri: required(env.FIGMA_REDIRECT_URI, "FIGMA_REDIRECT_URI"),
  };
}

export function readFigmaPocEmbedConfig(
  env: NodeJS.ProcessEnv = process.env,
): FigmaPocEmbedConfig {
  return {
    clientId: required(env.FIGMA_CLIENT_ID, "FIGMA_CLIENT_ID"),
    fileKey: required(env.FIGMA_POC_FILE_KEY, "FIGMA_POC_FILE_KEY"),
    versionId: required(env.FIGMA_POC_VERSION_ID, "FIGMA_POC_VERSION_ID"),
    startNodeId: required(env.FIGMA_POC_START_NODE_ID, "FIGMA_POC_START_NODE_ID"),
  };
}

export function getFigmaTask15Readiness(env: NodeJS.ProcessEnv = process.env) {
  return Object.freeze({
    oauthConfigured: Boolean(
      env.FIGMA_CLIENT_ID?.trim() &&
        env.FIGMA_CLIENT_SECRET?.trim() &&
        env.FIGMA_REDIRECT_URI?.trim(),
    ),
    embedConfigured: Boolean(
      env.FIGMA_CLIENT_ID?.trim() &&
        env.FIGMA_POC_FILE_KEY?.trim() &&
        env.FIGMA_POC_VERSION_ID?.trim() &&
        env.FIGMA_POC_START_NODE_ID?.trim(),
    ),
  });
}

export function buildFigmaAuthorizationUrl(
  config: FigmaOAuthConfig,
  state: string,
): string {
  const url = new URL("https://www.figma.com/oauth");
  url.searchParams.set("client_id", required(config.clientId, "clientId"));
  url.searchParams.set("redirect_uri", required(config.redirectUri, "redirectUri"));
  url.searchParams.set("scope", FIGMA_OAUTH_SCOPES.join(","));
  url.searchParams.set("state", required(state, "state"));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export function constantTimeStateEquals(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

export async function exchangeFigmaAuthorizationCode(
  code: string,
  config: FigmaOAuthConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<FigmaTokenResponse> {
  const body = new URLSearchParams({
    redirect_uri: required(config.redirectUri, "redirectUri"),
    code: required(code, "code"),
    grant_type: "authorization_code",
  });
  const basic = Buffer.from(
    `${required(config.clientId, "clientId")}:${required(config.clientSecret, "clientSecret")}`,
  ).toString("base64");

  const response = await fetchImpl("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Figma token exchange failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    user_id_string?: unknown;
  };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Figma token exchange returned no access token");
  }

  return Object.freeze({
    accessToken: payload.access_token,
    ...(typeof payload.refresh_token === "string"
      ? { refreshToken: payload.refresh_token }
      : {}),
    ...(typeof payload.expires_in === "number"
      ? { expiresIn: payload.expires_in }
      : {}),
    ...(typeof payload.user_id_string === "string"
      ? { userId: payload.user_id_string }
      : {}),
  });
}

export async function verifyFigmaOAuthAccessToken(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl("https://api.figma.com/v1/me", {
    headers: { Authorization: `Bearer ${required(accessToken, "accessToken")}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Figma identity verification failed with HTTP ${response.status}`);
  }
}

export function buildFigmaPocEmbedUrl(config: FigmaPocEmbedConfig): string {
  return buildPinnedFigmaEmbedUrl(
    {
      provider: "figma",
      fileKey: config.fileKey,
      figmaVersionId: config.versionId,
      versionResolvedAt: "1970-01-01T00:00:00.000Z",
      sourceLastModified: "1970-01-01T00:00:00.000Z",
      startNodeId: config.startNodeId,
      flowStartingPointNodeId: config.startNodeId,
    },
    {
      embedHost: "ut-platform-task15",
      clientId: config.clientId,
    },
  );
}
