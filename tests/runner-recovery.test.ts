import test from "node:test";
import assert from "node:assert/strict";
import { belongsToTest, remainingTaskTime } from "../src/lib/runner/recovery.ts";

test("session recovery requires both exact test and published version", () => {
  const requested = { testId: "study-a", testVersionId: "version-2" };
  assert.equal(belongsToTest(requested, requested), true);
  assert.equal(belongsToTest({ ...requested, testVersionId: "version-1" }, requested), false);
  assert.equal(belongsToTest({ ...requested, testId: "study-b" }, requested), false);
});

test("recovery and confirmation round trips preserve the original deadline", () => {
  const start = "2026-09-26T10:00:00Z";
  const now = Date.parse(start);
  assert.equal(remainingTaskTime(start, 60, now + 25000), 35000);
  assert.equal(remainingTaskTime(start, 60, now + 45000), 15000);
  assert.equal(remainingTaskTime(start, 60, now + 90000), 0);
});

test("missing or invalid timing evidence does not fabricate a deadline", () => {
  for (const start of [null, "invalid"]) assert.equal(remainingTaskTime(start, 60, Date.now()), null);
  for (const seconds of [0, -1, NaN, Infinity]) assert.equal(remainingTaskTime("2026-09-26T10:00:00Z", seconds, Date.now()), null);
});
