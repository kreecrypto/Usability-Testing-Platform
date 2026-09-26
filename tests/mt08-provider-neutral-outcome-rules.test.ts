import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  availableTaskOutcomeRuleTypes,
  buildTaskOutcomeRule,
  taskOutcomeRulesConflict,
  taskOutcomeRuleSupported,
  validateStoredTaskOutcomeRules,
} from "../src/lib/builder/task-outcome-rules.ts";

const firstParty = Object.freeze({
  provider: "first_party_web" as const,
  capabilities: Object.freeze({
    screen: "Available",
    instrumentation: "Available",
    pointer: "Available",
  }),
});

const figma = Object.freeze({
  provider: "figma_prototype" as const,
  capabilities: Object.freeze({
    screen: "Available",
    instrumentation: "Partial",
    pointer: "Available",
  }),
});

test("MT-08 exposes capability-backed provider-neutral primitives", () => {
  assert.deepEqual(
    availableTaskOutcomeRuleTypes(firstParty),
    ["screen", "url", "route", "completion_signal", "element"],
  );
  assert.deepEqual(availableTaskOutcomeRuleTypes(figma), ["screen"]);
});

test("MT-08 normalizes URL/route rules and rejects unsupported provider capability", () => {
  const urlRule = buildTaskOutcomeRule({
    type: "url",
    values: ["https://shop.example.com/checkout#done"],
  });
  assert.deepEqual(urlRule.values, ["https://shop.example.com/checkout"]);
  assert.equal(taskOutcomeRuleSupported(urlRule, firstParty), true);
  assert.equal(taskOutcomeRuleSupported(urlRule, figma), false);

  const routeRule = buildTaskOutcomeRule({
    type: "route",
    values: ["/checkout/done"],
  });
  assert.deepEqual(routeRule.values, ["/checkout/done"]);
});

test("MT-08 supports legacy Figma presented_node without making it canonical for web targets", () => {
  const legacy = { type: "presented_node", nodeIds: ["10:20"] } as const;
  assert.equal(taskOutcomeRuleSupported(legacy, figma), true);
  assert.equal(taskOutcomeRuleSupported(legacy, firstParty), false);
});

test("MT-08 blocks ambiguous same-event predicates and allows independent event channels", () => {
  const url = buildTaskOutcomeRule({ type: "url", values: ["https://shop.example.com/done"] });
  const route = buildTaskOutcomeRule({ type: "route", values: ["/done"] });
  const signal = buildTaskOutcomeRule({ type: "completion_signal", values: ["done"] });
  assert.equal(taskOutcomeRulesConflict(url, route), true);
  assert.equal(taskOutcomeRulesConflict(route, signal), false);
});

test("MT-08 detects overlapping terminal values deterministically", () => {
  const success = buildTaskOutcomeRule({ type: "screen", values: ["checkout:done"] });
  const failure = buildTaskOutcomeRule({ type: "screen", values: ["checkout:done"] });
  assert.equal(taskOutcomeRulesConflict(success, failure), true);
  assert.deepEqual(
    validateStoredTaskOutcomeRules({
      target: firstParty,
      successRule: success,
      failureRule: failure,
    }),
    { ok: false, reason: "conflicting_terminal_rules" },
  );
});

test("MT-08 migration keeps DB authoritative for save, publish and deterministic derivation", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260923125000_mt08_provider_neutral_outcome_rules.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /save_task_outcome_rules/);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /grant execute[\s\S]*authenticated/i);
  assert.match(migration, /unsupported_rule_for_target/);
  assert.match(migration, /conflicting_terminal_rules/);
  assert.match(migration, /publishable_task_rules_required/);
  assert.match(migration, /completion_signal/);
  assert.match(migration, /task-outcome-v2/);
  assert.match(migration, /derived_from_event_ids/);
  assert.doesNotMatch(migration, /security definer/i);
});

test("MT-08 authenticated API and researcher editor expose no service role shortcut", async () => {
  const route = await readFile(
    new URL("../src/app/api/tasks/[taskId]/outcome-rules/route.ts", import.meta.url),
    "utf8",
  );
  const store = await readFile(
    new URL("../src/lib/builder/task-outcome-rule-store.ts", import.meta.url),
    "utf8",
  );
  const editor = await readFile(
    new URL("../src/app/builder/[testId]/rules/task-outcome-rules-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(route, /accessTokenFromRequest/);
  assert.match(route, /publicSupabaseConfig/);
  assert.match(store, /rpc\/save_task_outcome_rules/);
  assert.doesNotMatch(route + store, /service_role|SUPABASE_SECRET_KEY/i);

  assert.match(editor, /กำหนดเกณฑ์สำเร็จและไม่สำเร็จ/);
  assert.match(editor, /Completion signal/);
  assert.match(editor, /Target:/);
  assert.match(editor, /deterministic rule/);
});
