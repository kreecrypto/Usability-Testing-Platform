import assert from "node:assert/strict";
import test from "node:test";
import { classifyAccessFailure } from "../src/lib/runner/access-failure.ts";

test("participant access errors distinguish malformed, unavailable, and transient failures", () => {
  assert.equal(classifyAccessFailure(new Error("invalid_version_id")), "invalid");
  assert.equal(classifyAccessFailure(new Error("published_test_not_found")), "unavailable");
  for (const error of [new Error("data_request_failed"), new Error("request_failed"), new TypeError("Failed to fetch"), null]) {
    assert.equal(classifyAccessFailure(error), "temporary");
  }
});
