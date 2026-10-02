import assert from "node:assert/strict";
import test from "node:test";
import { buildMethodResults } from "../src/lib/methods/results.ts";

const blocks = [
  { id: "survey", ordinal: 1, kind: "survey" as const, title: "Survey", config: { questions: [
    { id: "q1", prompt: "Best?", type: "single_choice", required: true, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
  ] } },
  { id: "sort", ordinal: 2, kind: "card_sort" as const, title: "Sort", config: { mode: "closed", cards: [{ id: "a", label: "A" }, { id: "b", label: "B" }], categories: [{ id: "x", label: "X" }, { id: "y", label: "Y" }] } },
  { id: "tree", ordinal: 3, kind: "tree_test" as const, title: "Tree", config: { nodes: [{ id: "root", label: "Root", parentId: null }, { id: "a", label: "A", parentId: "root" }, { id: "b", label: "B", parentId: "a" }], prompts: [{ id: "find", title: "Find B", correctNodeId: "b" }] } },
];

test("method results preserve No Data instead of a numeric zero", () => {
  const results = buildMethodResults(blocks, []);
  assert.equal(results[0].availability, "No Data");
  assert.equal(results[0].sampleSize, 0);
  assert.equal(results[2].prompts?.[0].successPercent, null);
  assert.equal(results[1].similarity?.[0].percent, null);
});

test("counts and similarity are recomputable from response IDs", () => {
  const results = buildMethodResults(blocks, [
    { id: "r1", sessionId: "s1", blockId: "survey", response: { answers: { q1: "a" } }, submittedAt: "2026-01-01" },
    { id: "r2", sessionId: "s1", blockId: "sort", response: { placements: [{ cardId: "a", categoryId: "x" }, { cardId: "b", categoryId: "x" }] }, submittedAt: "2026-01-01" },
    { id: "r3", sessionId: "s2", blockId: "sort", response: { placements: [{ cardId: "a", categoryId: "x" }, { cardId: "b", categoryId: "y" }] }, submittedAt: "2026-01-01" },
  ]);
  assert.deepEqual(results[0].questions?.[0].counts, [{ value: "a", count: 1, evidenceIds: ["r1"] }]);
  assert.equal(results[1].similarity?.[0].percent, 50);
  assert.deepEqual(results[1].similarity?.[0].evidenceIds, ["r2"]);
});

test("tree success and directness differ when participant backtracks", () => {
  const results = buildMethodResults(blocks, [
    { id: "r1", sessionId: "s1", blockId: "tree", response: { attempts: [{ promptId: "find", path: ["root", "a", "b"], trace: ["root", "a", "root", "a", "b"], selectedNodeId: "b", durationMs: 900 }] }, submittedAt: "2026-01-01" },
  ]);
  assert.equal(results[2].prompts?.[0].successPercent, 100);
  assert.equal(results[2].prompts?.[0].directPercent, 0);
});
