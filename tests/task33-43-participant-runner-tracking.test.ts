import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPublicRunnerStore } from "../src/lib/runner/public-session.ts";
import { createRunnerLifecycle } from "../src/lib/tracking/lifecycle.ts";
import { createEventOutbox, type OutboxStorage } from "../src/lib/tracking/event-outbox.ts";
import { normalizeFigmaPointerEvent } from "../src/lib/tracking/pointer-normalization.ts";
import { deriveTaskTimeMetrics } from "../src/lib/analytics/time-metrics.ts";
import type { AcceptedTrackingEvent, RawTrackingEvent, TrackingEvent } from "../src/lib/tracking/events.ts";

const TEST_ID = "10000000-0000-4000-8000-000000000001";
const VERSION_ID = "20000000-0000-4000-8000-000000000002";
const SESSION_ID = "30000000-0000-4000-8000-000000000003";
const PARTICIPANT_ID = "40000000-0000-4000-8000-000000000004";
const TASK_ID = "50000000-0000-4000-8000-000000000005";

function rawEvent(overrides: Partial<RawTrackingEvent> = {}): RawTrackingEvent {
  return {
    schemaVersion: 2,
    eventId: crypto.randomUUID(),
    idempotencyKey: `${SESSION_ID}:test:${overrides.sequence ?? 1}`,
    eventLayer: "raw",
    source: "runner",
    eventType: "task_started",
    occurredAt: "2026-09-09T10:00:00.000Z",
    sequence: 1,
    sessionId: SESSION_ID,
    participantId: PARTICIPANT_ID,
    testId: TEST_ID,
    testVersionId: VERSION_ID,
    taskId: TASK_ID,
    ...overrides,
  };
}

test("Task33 public snapshot never exposes expected path or success/failure rules", async () => {
  const calls: string[] = [];
  const responses = [
    Response.json([{
      id: VERSION_ID,
      test_id: TEST_ID,
      version_no: 3,
      lifecycle_status: "published",
      figma_start_node_id: "1:2",
      prototype_mapping: {
        provider: "figma",
        sourceUrl: "https://www.figma.com/proto/abc/Test?node-id=1-2",
        embedUrl: "https://embed.figma.com/proto/abc/Test?node-id=1-2",
      },
    }]),
    Response.json([{ id: TEST_ID, title: "Checkout", description: null, status: "published" }]),
    Response.json([{
      id: TASK_ID,
      ordinal: 1,
      title: "Buy a product",
      scenario: "You need a gift.",
      instruction: "Complete checkout.",
      timeout_seconds: 90,
      post_task_questions: { seq: { enabled: true, required: false }, open_feedback: { enabled: true, required: false } },
    }]),
  ];
  let responseIndex = 0;
  const store = createPublicRunnerStore({
    supabaseUrl: "https://example.supabase.co",
    secretKey: "server-secret",
    signingKey: "signing-secret",
    figmaEmbedClientId: "public-client-id",
    fetchImpl: async (input) => {
      calls.push(String(input));
      return responses[responseIndex++] ?? Response.json([], { status: 500 });
    },
  });

  const snapshot = await store.snapshot(VERSION_ID);
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.tasks.length, 1);
  assert.doesNotMatch(serialized, /expectedPath|successRule|failureRule|expected_path|success_rule|failure_rule/);
  assert.doesNotMatch(calls[2], /expected_path|success_rule|failure_rule/);
  assert.equal(new URL(snapshot.prototype.liveEmbedUrl!).searchParams.get("client-id"), "public-client-id");
});

test("Task38 browser lifecycle emits raw events only with deterministic increasing sequence", async () => {
  const emitted: RawTrackingEvent[] = [];
  let id = 0;
  const lifecycle = createRunnerLifecycle({
    session: { sessionId: SESSION_ID, participantId: PARTICIPANT_ID, testId: TEST_ID, testVersionId: VERSION_ID },
    emit: async (event) => { emitted.push(event); },
    eventIdFactory: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    now: () => new Date("2026-09-09T10:00:00.000Z"),
  });

  await lifecycle.startSession();
  await lifecycle.startTask({ id: TASK_ID });
  await lifecycle.giveUp();

  assert.deepEqual(emitted.map((event) => event.eventType), ["session_started", "task_started", "task_give_up"]);
  assert.deepEqual(emitted.map((event) => event.sequence), [1, 2, 3]);
  assert.ok(emitted.every((event) => event.eventLayer === "raw"));
  assert.equal(lifecycle.getState().activeTaskTerminal, true);
});

test("Task38 recovery resumes above server and durable-outbox sequence without re-emitting session start", async () => {
  const emitted: RawTrackingEvent[] = [];
  const lifecycle = createRunnerLifecycle({
    session: { sessionId: SESSION_ID, participantId: PARTICIPANT_ID, testId: TEST_ID, testVersionId: VERSION_ID },
    emit: async (event) => { emitted.push(event); },
    initialSequence: 7,
    initialSessionStarted: true,
    initialActiveTaskId: TASK_ID,
    initialActiveTaskTerminal: false,
    eventIdFactory: () => "60000000-0000-4000-8000-000000000006",
  });
  assert.equal(await lifecycle.startSession(), null);
  const event = await lifecycle.timeout();
  assert.equal(event?.sequence, 8);
  assert.equal(event?.eventType, "task_timeout");
});

test("Task43 durable outbox keeps stable identity on failed delivery and removes only after success", async () => {
  let stored: TrackingEvent[] = [];
  const storage: OutboxStorage = {
    load: async () => stored,
    save: async (events) => { stored = [...events]; },
  };
  let fail = true;
  let sends = 0;
  const outbox = createEventOutbox({
    storage,
    refreshCredential: async () => ({ token: "session-token", expiresAt: "2026-09-09T10:05:00.000Z" }),
    sendBatch: async () => { sends += 1; if (fail) throw new Error("network"); },
  });
  const event = rawEvent({ sequence: 1, idempotencyKey: `${SESSION_ID}:runner:1:session_started`, eventType: "session_started", taskId: undefined });
  await outbox.enqueue(event);
  await outbox.enqueue(event);
  assert.equal(stored.length, 1);
  await assert.rejects(outbox.flush(), /network/);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].eventId, event.eventId);
  fail = false;
  assert.equal(await outbox.flush(), 1);
  assert.equal(stored.length, 0);
  assert.equal(sends, 2);
});

test("Task39 canonical pointer normalization preserves provider evidence and outputs 0..1 only with pinned geometry", () => {
  const event = rawEvent({
    source: "prototype_adapter",
    eventType: "pointer_interaction",
    screenId: "screen-1",
    metadata: {
      provider: "figma",
      providerEventType: "MOUSE_PRESS_OR_RELEASE",
      presentedNodeId: "screen-1",
      handled: true,
      targetNodeId: "button-1",
      targetNodeMousePosition: { x: 10, y: 20 },
      nearestScrollingFrameId: "scroll-1",
      nearestScrollingFrameMousePosition: { x: 60, y: 70 },
      nearestScrollingFrameOffset: { x: 0, y: 0 },
    },
  });
  const normalized = normalizeFigmaPointerEvent(event, {
    figmaVersionId: "internal-version-3",
    presentedNodeId: "screen-1",
    presentedBounds: { x: 100, y: 200, width: 400, height: 800 },
    targetNodeId: "button-1",
    targetBounds: { x: 150, y: 250, width: 100, height: 80 },
    nearestScrollingFrameId: "scroll-1",
    nearestScrollingFrameBounds: { x: 100, y: 200, width: 400, height: 800 },
  });
  const canonical = normalized.metadata?.canonicalPoint as Record<string, unknown>;
  assert.equal(canonical.normalizedX, 0.15);
  assert.equal(canonical.normalizedY, 0.0875);
  assert.equal((normalized.metadata?.targetNodeMousePosition as { x: number }).x, 10);
  assert.throws(() => normalizeFigmaPointerEvent(event, {
    figmaVersionId: "internal-version-3",
    presentedNodeId: "wrong-screen",
    presentedBounds: { x: 100, y: 200, width: 400, height: 800 },
    targetNodeId: "button-1",
    targetBounds: { x: 150, y: 250, width: 100, height: 80 },
    nearestScrollingFrameId: "scroll-1",
    nearestScrollingFrameBounds: { x: 100, y: 200, width: 400, height: 800 },
  }), /presentedNodeId/);
});

test("Task42 time metrics derive from occurredAt and do not invent idle-adjusted or Figma scroll", () => {
  const accepted = [
    { ...rawEvent({ eventId: "60000000-0000-4000-8000-000000000001", sequence: 1, eventType: "task_started", occurredAt: "2026-09-09T10:00:00.000Z" }), receivedAt: "2026-09-09T10:00:00.100Z" },
    { ...rawEvent({ eventId: "60000000-0000-4000-8000-000000000002", sequence: 2, eventType: "screen_view", screenId: "A", occurredAt: "2026-09-09T10:00:02.000Z" }), receivedAt: "2026-09-09T10:00:02.100Z" },
    { ...rawEvent({ eventId: "60000000-0000-4000-8000-000000000003", sequence: 3, eventType: "screen_view", screenId: "B", occurredAt: "2026-09-09T10:00:05.000Z" }), receivedAt: "2026-09-09T10:00:05.100Z" },
    { ...rawEvent({ eventId: "60000000-0000-4000-8000-000000000004", sequence: 4, eventType: "task_give_up", occurredAt: "2026-09-09T10:00:09.000Z" }), receivedAt: "2026-09-09T10:00:09.100Z" },
  ] as AcceptedTrackingEvent[];
  const metrics = deriveTaskTimeMetrics(accepted)[0];
  assert.equal(metrics.timeOnTaskMs, 9000);
  assert.deepEqual(metrics.screens.map((screen) => screen.durationMs), [3000, 4000]);
  assert.equal(metrics.canonicalScrollEventCount, 0);
  assert.equal(metrics.idleAdjustedMs, null);
  assert.equal(metrics.idleRuleVersion, null);
});

test("Tasks 34-37 runner UI implements P01-P12 contract and never references hidden research rules", async () => {
  const client = await readFile(new URL("../src/app/t/[testVersionId]/participant-runner-client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/t/[testVersionId]/participant-runner.module.css", import.meta.url), "utf8");
  assert.match(client, /P01 · Access check/);
  assert.match(client, /P02 · Consent/);
  assert.match(client, /P03 · Task/);
  assert.match(client, /P06 · Post-task feedback/);
  assert.match(client, /P08 · Complete/);
  assert.match(client, /P09 · Unavailable/);
  assert.match(client, /P10 · Technical blocked/);
  assert.match(client, /P11 · Timed out/);
  assert.match(client, /P12 · Recovery/);
  assert.match(client, /Agree and start/);
  assert.match(client, /Give up this task/);
  assert.match(client, /Very difficult/);
  assert.match(client, /Very easy/);
  assert.doesNotMatch(client, /expectedPath|successRule|failureRule/);
  assert.match(css, /var\(--ut-/);
  assert.match(css, /@media \(max-width:575px\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
});

test("Tasks 37/38/40/41 database rules are idempotent, server-derived, and mark proposed friction thresholds honestly", async () => {
  const lifecycleSql = await readFile(new URL("../supabase/migrations/20260909110000_task38_41_lifecycle_derivation.sql", import.meta.url), "utf8");
  const feedbackSql = await readFile(new URL("../supabase/migrations/20260909113000_task37_post_task_feedback.sql", import.meta.url), "utf8");
  assert.match(lifecycleSql, /participant ingestion remains RAW ONLY/i);
  assert.match(lifecycleSql, /task_success/);
  assert.match(lifecycleSql, /task_failed/);
  assert.match(lifecycleSql, /where session_id = new\.session_id[\s\S]*outcome is null/i);
  assert.match(lifecycleSql, /backtrack/);
  assert.match(lifecycleSql, /misclick/);
  assert.match(lifecycleSql, /rage_click/);
  assert.match(lifecycleSql, /PROPOSED/i);
  assert.match(feedbackSql, /feedback_submitted_at/);
  assert.match(feedbackSql, /scaleVersion/);
  assert.match(feedbackSql, /on conflict \(session_id, task_id, question_key\)/i);
});

test("Task43 existing database and collector gates retain stable event dedupe/DLQ guarantees", async () => {
  const schema = await readFile(new URL("../supabase/migrations/20260908141723_initial_v1_schema.sql", import.meta.url), "utf8");
  const collector = await readFile(new URL("../src/app/v1/events/route.ts", import.meta.url), "utf8");
  const outbox = await readFile(new URL("../src/lib/tracking/event-outbox.ts", import.meta.url), "utf8");
  assert.match(schema, /unique \(session_id, idempotency_key\)/i);
  assert.match(schema, /events_session_raw_sequence_uq/i);
  assert.match(collector, /createReliableEventPersister/);
  assert.match(collector, /createSupabaseDeadLetterRecorder/);
  assert.match(outbox, /utp:event-outbox:v1/);
  assert.match(outbox, /refreshCredential/);
});
