import assert from "node:assert/strict";
import test from "node:test";

import { parsePublicFigmaPrototypeUrl } from "../src/lib/figma/public-embed.ts";

test("normalizes a public Figma prototype link to the embed host", () => {
  const parsed = parsePublicFigmaPrototypeUrl(
    "https://www.figma.com/proto/AbC123xyz/Checkout?node-id=5-3&starting-point-node-id=5%3A3&scaling=scale-down",
  );
  const embed = new URL(parsed.embedUrl);

  assert.equal(parsed.fileKey, "AbC123xyz");
  assert.equal(parsed.nodeId, "5-3");
  assert.equal(parsed.startingPointNodeId, "5:3");
  assert.equal(embed.origin, "https://embed.figma.com");
  assert.equal(embed.pathname, "/proto/AbC123xyz/Checkout");
  assert.equal(embed.searchParams.get("node-id"), "5-3");
  assert.equal(embed.searchParams.get("starting-point-node-id"), "5:3");
  assert.equal(embed.searchParams.get("scaling"), "scale-down");
  assert.equal(embed.searchParams.get("embed-host"), "ut-platform-v1");
});

test("does not require OAuth client-id or Figma version-id", () => {
  const parsed = parsePublicFigmaPrototypeUrl(
    "https://figma.com/proto/AbC123xyz/Checkout?node-id=10-20",
  );
  const embed = new URL(parsed.embedUrl);

  assert.equal(embed.searchParams.has("client-id"), false);
  assert.equal(embed.searchParams.has("version-id"), false);
  assert.equal(embed.searchParams.get("node-id"), "10-20");
});

test("accepts an existing embed.figma.com prototype URL and pins embed-host", () => {
  const parsed = parsePublicFigmaPrototypeUrl(
    "https://embed.figma.com/proto/AbC123xyz/Checkout?embed-host=old-host&hotspot-hints=0",
    "ut-platform-task15",
  );
  const embed = new URL(parsed.embedUrl);

  assert.equal(embed.hostname, "embed.figma.com");
  assert.equal(embed.searchParams.get("embed-host"), "ut-platform-task15");
  assert.equal(embed.searchParams.get("hotspot-hints"), "0");
});

test("rejects non-prototype, non-Figma, and non-HTTPS URLs", () => {
  assert.throws(
    () => parsePublicFigmaPrototypeUrl("https://www.figma.com/design/AbC123xyz/Checkout"),
    /prototype link/,
  );
  assert.throws(
    () => parsePublicFigmaPrototypeUrl("https://example.com/proto/AbC123xyz/Checkout"),
    /Only public figma.com/,
  );
  assert.throws(
    () => parsePublicFigmaPrototypeUrl("http://www.figma.com/proto/AbC123xyz/Checkout"),
    /HTTPS/,
  );
});
