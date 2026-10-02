import assert from "node:assert/strict";
import test from "node:test";
import {
  StudyContractError,
  parseCardSortConfig,
  parseMethodResponse,
  parseSurveyConfig,
  parseTreeConfig,
  visibleSurveyQuestions,
} from "../src/lib/methods/study-contract.ts";

test("survey conditions require an earlier single-choice answer and hidden answers are rejected", () => {
  const config = parseSurveyConfig({ questions: [
    { id: "visit", prompt: "Visited?", type: "single_choice", required: true,
      options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] },
    { id: "why", prompt: "Why?", type: "text", required: true,
      showIf: { questionId: "visit", equals: "yes" } },
  ] });
  assert.deepEqual(visibleSurveyQuestions(config, { visit: "no" }).map((q) => q.id), ["visit"]);
  assert.deepEqual(parseMethodResponse("survey", config, { answers: { visit: "no" } }), { answers: { visit: "no" } });
  assert.throws(() => parseMethodResponse("survey", config, { answers: { visit: "no", why: "hidden" } }),
    (error: unknown) => error instanceof StudyContractError && error.code === "hidden_or_unknown_answer");
  assert.throws(() => parseMethodResponse("survey", config, { answers: { visit: "yes" } }),
    (error: unknown) => error instanceof StudyContractError && error.code === "required_answer_missing");
  assert.throws(() => parseSurveyConfig({ questions: [
    { id: "bad", prompt: "Invalid", type: "text", required: true,
      showIf: { questionId: "bad", equals: "yes" } },
  ] }), StudyContractError);
});

test("card sort requires each published card exactly once in a valid category", () => {
  const config = parseCardSortConfig({ mode: "closed", cards: [
    { id: "a", label: "A" }, { id: "b", label: "B" },
  ], categories: [{ id: "x", label: "X" }, { id: "y", label: "Y" }] });
  assert.deepEqual(parseMethodResponse("card_sort", config, { placements: [
    { cardId: "a", categoryId: "x" }, { cardId: "b", categoryId: "y" },
  ] }).placements, [{ cardId: "a", categoryId: "x" }, { cardId: "b", categoryId: "y" }]);
  assert.throws(() => parseMethodResponse("card_sort", config, { placements: [
    { cardId: "a", categoryId: "x" }, { cardId: "a", categoryId: "y" },
  ] }), StudyContractError);
});

test("tree path must follow published parent-child edges", () => {
  const config = parseTreeConfig({ nodes: [
    { id: "root", label: "Root", parentId: null },
    { id: "a", label: "A", parentId: "root" },
    { id: "b", label: "B", parentId: "a" },
  ], prompts: [{ id: "find", title: "Find B", correctNodeId: "b" }] });
  assert.deepEqual(parseMethodResponse("tree_test", config, { attempts: [
    { promptId: "find", path: ["root", "a", "b"], trace: ["root", "a", "b"], selectedNodeId: "b", durationMs: 1200 },
  ] }).attempts, [{ promptId: "find", path: ["root", "a", "b"], trace: ["root", "a", "b"], selectedNodeId: "b", durationMs: 1200 }]);
  assert.throws(() => parseMethodResponse("tree_test", config, { attempts: [
    { promptId: "find", path: ["root", "b"], trace: ["root", "b"], selectedNodeId: "b", durationMs: 1200 },
  ] }), StudyContractError);
  assert.throws(() => parseTreeConfig({ nodes: [
    { id: "root", label: "Root", parentId: null },
    { id: "a", label: "A", parentId: "b" },
    { id: "b", label: "B", parentId: "a" },
  ], prompts: [{ id: "find", title: "Find B", correctNodeId: "b" }] }), StudyContractError);
});
