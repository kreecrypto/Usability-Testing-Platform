import assert from "node:assert/strict";
import test from "node:test";

import {
  FIGMA_EMBED_EVENT_ORIGIN,
  applyFigmaAccessSignal,
  parseFigmaAccessSignal,
  startFigmaAccessPreflight,
  timeoutFigmaAccessPreflight,
  withFigmaEmbedClientId,
} from "../src/lib/figma/access-preflight.ts";

test("Embed API client id is added only to an already-normalized Figma embed URL", () => {
  const result = withFigmaEmbedClientId(
    "https://embed.figma.com/proto/AbC123xyz/Checkout?embed-host=ut-platform-v1",
    "client-public-id",
  );
  const url = new URL(result);

  assert.equal(url.searchParams.get("client-id"), "client-public-id");
  assert.equal(url.searchParams.get("embed-host"), "ut-platform-v1");
  assert.throws(
    () => withFigmaEmbedClientId("https://example.com/proto/AbC123xyz", "client-public-id"),
    /normalized Figma embed URL/,
  );
});

test("missing Embed API configuration fails closed instead of claiming public access", () => {
  const result = startFigmaAccessPreflight();

  assert.equal(result.status, "technical_blocked");
  assert.equal(result.publishAllowed, false);
  assert.equal(result.classification, "technical_blocked");
  assert.equal(result.reason, "embed_api_unconfigured");
});

test("INITIAL_LOAD is the only access signal that allows publish", () => {
  const signal = parseFigmaAccessSignal(FIGMA_EMBED_EVENT_ORIGIN, {
    type: "INITIAL_LOAD",
    data: {},
  });
  assert.equal(signal, "INITIAL_LOAD");

  const result = applyFigmaAccessSignal(signal!);
  assert.equal(result.status, "accessible");
  assert.equal(result.publishAllowed, true);
  assert.equal(result.classification, "eligible");
});

test("Figma login and password screens are technical blocks, never usability failures", () => {
  for (const [signal, reason] of [
    ["LOGIN_SCREEN_SHOWN", "login_required"],
    ["PASSWORD_SCREEN_SHOWN", "password_required"],
  ] as const) {
    const result = applyFigmaAccessSignal(signal);
    assert.equal(result.status, "technical_blocked");
    assert.equal(result.publishAllowed, false);
    assert.equal(result.classification, "technical_blocked");
    assert.equal(result.reason, reason);
    assert.match(result.message, /must not count as a usability failure/i);
  }
});

test("unexpected origins and unrelated messages cannot change the access gate", () => {
  assert.equal(
    parseFigmaAccessSignal("https://example.com", { type: "INITIAL_LOAD" }),
    null,
  );
  assert.equal(
    parseFigmaAccessSignal(FIGMA_EMBED_EVENT_ORIGIN, { type: "PRESENTED_NODE_CHANGED" }),
    null,
  );
  assert.equal(parseFigmaAccessSignal(FIGMA_EMBED_EVENT_ORIGIN, null), null);
});

test("preflight timeout fails closed as a technical block", () => {
  const result = timeoutFigmaAccessPreflight();
  assert.equal(result.publishAllowed, false);
  assert.equal(result.classification, "technical_blocked");
  assert.equal(result.reason, "preflight_timeout");
});
