import assert from "node:assert/strict";
import test from "node:test";

import { aggregateAnalytics } from "../src/lib/analytics/aggregation.ts";
import { FUNNEL_SCHEMA_VERSION } from "../src/lib/analytics/funnel.ts";
import { buildResultsModel } from "../src/lib/analytics/results.ts";
import { buildReleaseQaFixture, RELEASE_QA_TEST_VERSION_ID } from "./release-qa-fixture.ts";

test("Task 54 non-Figma harness provides 20+ sessions, 500+ unique events and all required outcome classes", () => {
  const fixture = buildReleaseQaFixture();
  assert.ok(fixture.sessionCount >= 20);
  assert.ok(fixture.uniqueEventCount >= 500);
  for (const [outcome, count] of Object.entries(fixture.expectedOutcomes)) {
    assert.ok(count > 0, `fixture must cover ${outcome}`);
  }
  assert.ok(fixture.answers.some((answer) => answer.answerType === "seq"));
  assert.ok(fixture.answers.some((answer) => answer.answerType === "text"));
  assert.ok(fixture.events.some((event) => event.eventLayer === "derived" && event.eventType === "misclick"));
  assert.ok(fixture.events.some((event) => event.eventLayer === "derived" && event.eventType === "backtrack"));
  assert.ok(fixture.deliveryEventsWithDuplicates.length > fixture.events.length);
});

test("Task 55 recomputes displayed non-Figma metrics from accepted evidence", () => {
  const fixture = buildReleaseQaFixture();
  const results = buildResultsModel({
    testVersionId: RELEASE_QA_TEST_VERSION_ID,
    events: fixture.events,
    tasks: fixture.tasks,
    answers: fixture.answers,
    funnelDefinition: { version: FUNNEL_SCHEMA_VERSION, screenIds: ["A", "B", "C"] },
  });
  const expected = fixture.expectedOutcomes;
  const eligible = fixture.sessionCount - expected.technical_blocked;
  const successes = expected.success_direct + expected.success_indirect;
  const expectedCompletion = (successes / eligible) * 100;
  const expectedGiveUp = (expected.give_up / eligible) * 100;
  const expectedMisclicks = eligible * 2;
  const expectedPointers = eligible * 12;

  assert.equal(results.overview.participantCount, fixture.sessionCount);
  assert.equal(results.overview.sessionCount, fixture.sessionCount);
  assert.equal(results.overview.eligibleTaskCount, eligible);
  assert.equal(results.overview.technicalBlockedTaskCount, expected.technical_blocked);
  assert.equal(results.overview.completionRate, expectedCompletion);
  assert.equal(results.overview.giveUpRate, expectedGiveUp);
  assert.equal(results.overview.misclickCount, expectedMisclicks);
  assert.equal(results.overview.misclickRate, (expectedMisclicks / expectedPointers) * 100);

  const task = results.taskDetails[0];
  assert.ok(task);
  assert.deepEqual(task.outcomes, fixture.expectedOutcomes);
  assert.equal(task.eligible, eligible);
  assert.equal(task.successfulDuration.sampleSize, successes);
  assert.equal(task.successfulDuration.medianMs, 8000);
  assert.equal(task.successfulDuration.p75Ms, 8000);
  assert.equal(task.successfulDuration.p90Ms, 8000);
  assert.equal(task.seqSampleSize, Math.ceil(fixture.sessionCount / 2));
  assert.ok(task.trace.completion.schemaVersions.includes(2));
  assert.ok(task.trace.completion.testVersionIds.includes(RELEASE_QA_TEST_VERSION_ID));
  assert.ok(task.trace.completion.ruleVersions.includes("task-outcome-v1"));
  assert.ok(task.trace.misclick.providerEvidence.some((item) => item.metadata.fixtureVersion === "release-qa-v1"));

  assert.ok(results.funnel);
  assert.equal(results.unsupported.funnel, false);
  assert.ok(results.funnel.transitions.every((step) => step.entered >= step.reached));
});

test("Task 58 duplicate delivery does not change analytics metrics or session aggregates", () => {
  const fixture = buildReleaseQaFixture();
  const unique = aggregateAnalytics(fixture.events);
  const duplicated = aggregateAnalytics(fixture.deliveryEventsWithDuplicates);
  assert.deepEqual(duplicated.taskMetrics, unique.taskMetrics);
  assert.deepEqual(duplicated.sessions, unique.sessions);

  const tracedUniqueEvents = unique.sessions.reduce((sum, session) => sum + session.trace.eventIds.length, 0);
  assert.equal(tracedUniqueEvents, fixture.uniqueEventCount);
});

test("Task 58 rejects conflicting events that reuse one session idempotency identity", () => {
  const fixture = buildReleaseQaFixture();
  const source = fixture.events[0];
  const conflict = Object.freeze({ ...source, eventId: `${source.eventId}:conflict` });
  assert.throws(
    () => aggregateAnalytics([...fixture.events, conflict]),
    /conflicting accepted events share idempotency identity/,
  );
});
