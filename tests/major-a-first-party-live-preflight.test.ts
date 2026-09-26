import assert from "node:assert/strict";
import test from "node:test";

import {
  approveInternalFirstPartyTarget,
  FIRST_PARTY_BRIDGE_VERSION,
  INTERNAL_VALIDATION_TARGET_PATH,
  preflightTestTarget,
} from "../src/lib/builder/test-target-import.ts";
import { GET as internalTarget } from "../src/app/internal-validation-target/route.ts";

test("owned web target remains blocked until approved live preflight", () => {
  const draft = preflightTestTarget({
    url: "https://utp.example.com/internal-validation-target",
    ownership: "owned",
    environment: "production",
  });
  assert.equal(draft.provider, "first_party_web");
  assert.equal(draft.capabilities.publishBlocked, true);
  assert.equal(draft.capabilities.instrumentation, "Partial");
});

test("only exact same-origin internal validation target can be upgraded", () => {
  const draft = preflightTestTarget({
    url: "https://utp.example.com/internal-validation-target",
    ownership: "owned",
    environment: "production",
  });
  const approved = approveInternalFirstPartyTarget(draft, "https://utp.example.com");
  assert.equal(approved.launchMode, "new_tab");
  assert.equal(approved.capabilities.publishBlocked, false);
  assert.equal(approved.capabilities.instrumentation, "Available");
  assert.equal(approved.capabilities.path, "Available");
  assert.equal(approved.capabilities.pointer, "Available");
  assert.equal(approved.providerConfig.bridgeVersion, FIRST_PARTY_BRIDGE_VERSION);

  const wrongPath = preflightTestTarget({
    url: "https://utp.example.com/projects",
    ownership: "owned",
    environment: "production",
  });
  assert.throws(
    () => approveInternalFirstPartyTarget(wrongPath, "https://utp.example.com"),
    /preflight_verification_failed/,
  );
  assert.throws(
    () => approveInternalFirstPartyTarget(draft, "https://other.example.com"),
    /preflight_verification_failed/,
  );
});

test("internal production target exposes the exact bridge proof header", async () => {
  const response = await internalTarget(new Request("https://utp.example.com" + INTERNAL_VALIDATION_TARGET_PATH));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-utp-first-party-bridge"), FIRST_PARTY_BRIDGE_VERSION);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  const body = await response.text();
  assert.match(body, /utp:first-party-web/);
  assert.match(body, /internal-validation-complete/);
});
