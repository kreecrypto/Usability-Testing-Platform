import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPinnedFigmaEmbedUrl,
  buildPinnedFigmaFileApiUrl,
  buildPinnedFigmaImageApiUrl,
  pinFigmaVersionAtPublish,
  type FigmaVersionResolver,
} from "../src/lib/figma/version-pin.ts";

test("publish resolves and stores one immutable Figma version", async () => {
  let latest = "1001";
  const resolver: FigmaVersionResolver = {
    async resolveCurrentVersion() {
      return {
        versionId: latest,
        lastModified: "2026-09-08T10:00:00Z",
      };
    },
  };

  const published = await pinFigmaVersionAtPublish(
    {
      fileKey: "abc123",
      startNodeId: "5:3",
      flowStartingPointNodeId: "5:3",
    },
    resolver,
    () => new Date("2026-09-08T12:00:00Z"),
  );

  assert.equal(published.figmaVersionId, "1001");
  assert.equal(published.versionResolvedAt, "2026-09-08T12:00:00.000Z");
  assert.ok(Object.isFrozen(published));

  // The source file changes after publication.
  latest = "2002";

  // Previously published test remains bound to version 1001.
  assert.equal(published.figmaVersionId, "1001");
});

test("runner embed and REST reads use the exact same pinned version", async () => {
  const resolver: FigmaVersionResolver = {
    async resolveCurrentVersion() {
      return {
        versionId: "v-immutable-42",
        lastModified: "2026-09-08T11:45:00Z",
      };
    },
  };

  const published = await pinFigmaVersionAtPublish(
    { fileKey: "file-key", startNodeId: "10:20" },
    resolver,
  );

  const embed = new URL(
    buildPinnedFigmaEmbedUrl(published, {
      embedHost: "ut-platform",
      clientId: "client-123",
    }),
  );
  const fileApi = new URL(
    buildPinnedFigmaFileApiUrl(published, { nodeIds: ["10:20"] }),
  );
  const imageApi = new URL(
    buildPinnedFigmaImageApiUrl(published, ["10:20"]),
  );

  assert.equal(embed.searchParams.get("version-id"), "v-immutable-42");
  assert.equal(fileApi.searchParams.get("version"), "v-immutable-42");
  assert.equal(imageApi.searchParams.get("version"), "v-immutable-42");
  assert.equal(embed.searchParams.get("node-id"), "10:20");
  assert.equal(fileApi.searchParams.get("ids"), "10:20");
  assert.equal(imageApi.searchParams.get("ids"), "10:20");
});

test("published helpers reject snapshots without a version ID", () => {
  const invalid = {
    provider: "figma" as const,
    fileKey: "file-key",
    figmaVersionId: "",
    versionResolvedAt: "2026-09-08T12:00:00.000Z",
    sourceLastModified: "2026-09-08T11:45:00Z",
    startNodeId: "10:20",
  };

  assert.throws(
    () => buildPinnedFigmaEmbedUrl(invalid, { embedHost: "ut-platform" }),
    /figmaVersionId is required/,
  );
});
