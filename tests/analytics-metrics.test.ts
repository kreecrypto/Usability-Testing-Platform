import assert from "node:assert/strict";
import test from "node:test";

import {
  completionRate,
  dropOffRate,
  durationMs,
  eligibleTaskSessions,
  failureRate,
  giveUpRate,
  misclickRate,
  percentage,
} from "../src/lib/analytics/metrics.ts";

test("percentage metrics preserve No Data instead of rendering 0%", () => {
  assert.equal(percentage(0, 0), null);
  assert.equal(
    completionRate({
      started: 2,
      successDirect: 0,
      successIndirect: 0,
      failed: 0,
      giveUp: 0,
      technicalBlocked: 2,
    }),
    null,
  );
  assert.equal(misclickRate(0, 0), null);
  assert.equal(dropOffRate(0, 0), null);
});

test("percentage metrics still report a real zero when eligible data exists", () => {
  assert.equal(percentage(0, 10), 0);
  assert.equal(
    completionRate({
      started: 10,
      successDirect: 0,
      successIndirect: 0,
      failed: 5,
      giveUp: 5,
      technicalBlocked: 0,
    }),
    0,
  );
});

test("technical blocks are excluded from usability denominators", () => {
  const input = {
    started: 10,
    successDirect: 4,
    successIndirect: 1,
    failed: 2,
    giveUp: 1,
    technicalBlocked: 2,
  };

  assert.equal(eligibleTaskSessions(input), 8);
  assert.equal(completionRate(input), 62.5);
  assert.equal(failureRate(input), 25);
  assert.equal(giveUpRate(input), 12.5);
});

test("invalid counter relationships fail loudly instead of being clamped", () => {
  assert.throws(
    () => eligibleTaskSessions({ started: 1, technicalBlocked: 2 }),
    /technicalBlocked cannot exceed started/,
  );
  assert.throws(() => dropOffRate(1, 2), /reachedNextStep cannot exceed enteredStep/);
  assert.throws(() => percentage(-1, 10), /non-negative/);
});

test("duration uses lifecycle occurredAt and rejects reversed evidence", () => {
  assert.equal(
    durationMs("2026-09-08T10:00:00.000Z", "2026-09-08T10:00:02.500Z"),
    2500,
  );
  assert.throws(
    () => durationMs("2026-09-08T10:00:02.500Z", "2026-09-08T10:00:00.000Z"),
    /cannot be earlier/,
  );
  assert.throws(() => durationMs("bad", "2026-09-08T10:00:00.000Z"), /valid RFC 3339/);
});
