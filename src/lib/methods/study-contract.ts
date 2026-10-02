export type StudyKind = "usability_task" | "survey" | "card_sort" | "tree_test";

export type SurveyQuestion = Readonly<{
  id: string;
  prompt: string;
  type: "single_choice" | "multi_choice" | "scale" | "text";
  required: boolean;
  options?: readonly Readonly<{ id: string; label: string }>[];
  min?: number;
  max?: number;
  showIf?: Readonly<{ questionId: string; equals: string }>;
}>;

export type SurveyConfig = Readonly<{ questions: readonly SurveyQuestion[] }>;
export type CardSortConfig = Readonly<{
  mode: "open" | "closed";
  cards: readonly Readonly<{ id: string; label: string }>[];
  categories: readonly Readonly<{ id: string; label: string }>[];
}>;
export type TreeNode = Readonly<{ id: string; label: string; parentId: string | null }>;
export type TreeConfig = Readonly<{
  nodes: readonly TreeNode[];
  prompts: readonly Readonly<{ id: string; title: string; correctNodeId: string }>[];
}>;
export type MethodConfig = SurveyConfig | CardSortConfig | TreeConfig;
export type ScreenerConfig = Readonly<{ questions: readonly Readonly<{
  id: string; prompt: string; options: readonly Readonly<{ id: string; label: string }>[]; accept: readonly string[];
}>[] }>;

export class StudyContractError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "StudyContractError";
    this.code = code;
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new StudyContractError("invalid_config");
  return value as Record<string, unknown>;
}

function text(value: unknown, max = 240): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new StudyContractError("invalid_text");
  }
  return value.trim();
}

function id(value: unknown): string {
  const result = text(value, 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new StudyContractError("invalid_id");
  return result;
}

function array(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new StudyContractError("invalid_list");
  }
  return value;
}

function unique(items: readonly { id: string }[]): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new StudyContractError("duplicate_id");
}

export function parseSurveyConfig(value: unknown): SurveyConfig {
  const source = object(value);
  const questions = array(source.questions, 1, 30).map((raw): SurveyQuestion => {
    const question = object(raw);
    if (!["single_choice", "multi_choice", "scale", "text"].includes(String(question.type))) {
      throw new StudyContractError("invalid_question_type");
    }
    if (typeof question.required !== "boolean") throw new StudyContractError("invalid_required");
    const type = question.type as SurveyQuestion["type"];
    let options: SurveyQuestion["options"];
    let min: number | undefined;
    let max: number | undefined;
    if (type === "single_choice" || type === "multi_choice") {
      options = array(question.options, 2, 20).map((rawOption) => {
        const option = object(rawOption);
        return { id: id(option.id), label: text(option.label) };
      });
      unique(options);
    }
    if (type === "scale") {
      min = Number(question.min);
      max = Number(question.max);
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || max - min < 1) {
        throw new StudyContractError("invalid_scale");
      }
    }
    const showIf = question.showIf === undefined ? undefined : (() => {
      const condition = object(question.showIf);
      return { questionId: id(condition.questionId), equals: id(condition.equals) };
    })();
    return { id: id(question.id), prompt: text(question.prompt, 500), type, required: question.required, options, min, max, showIf };
  });
  unique(questions);
  for (let index = 0; index < questions.length; index++) {
    const condition = questions[index].showIf;
    if (!condition) continue;
    const sourceIndex = questions.findIndex((question) => question.id === condition.questionId);
    const parent = questions[sourceIndex];
    if (sourceIndex < 0 || sourceIndex >= index || parent.type !== "single_choice" ||
      !parent.options?.some((option) => option.id === condition.equals)) {
      throw new StudyContractError("invalid_condition");
    }
  }
  return { questions };
}

export function parseCardSortConfig(value: unknown): CardSortConfig {
  const source = object(value);
  if (source.mode !== "open" && source.mode !== "closed") throw new StudyContractError("invalid_card_mode");
  const cards = array(source.cards, 2, 100).map((raw) => {
    const item = object(raw);
    return { id: id(item.id), label: text(item.label) };
  });
  const categories = array(source.categories, source.mode === "closed" ? 2 : 0, 30).map((raw) => {
    const item = object(raw);
    return { id: id(item.id), label: text(item.label) };
  });
  unique(cards);
  unique(categories);
  return { mode: source.mode, cards, categories };
}

export function parseTreeConfig(value: unknown): TreeConfig {
  const source = object(value);
  const nodes = array(source.nodes, 2, 200).map((raw): TreeNode => {
    const node = object(raw);
    return { id: id(node.id), label: text(node.label), parentId: node.parentId === null ? null : id(node.parentId) };
  });
  const prompts = array(source.prompts, 1, 30).map((raw) => {
    const prompt = object(raw);
    return { id: id(prompt.id), title: text(prompt.title, 500), correctNodeId: id(prompt.correctNodeId) };
  });
  unique(nodes);
  unique(prompts);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const roots = nodes.filter((node) => node.parentId === null);
  if (roots.length !== 1) throw new StudyContractError("invalid_tree_root");
  for (const node of nodes) {
    if (node.parentId !== null && !nodeById.has(node.parentId)) throw new StudyContractError("invalid_tree_parent");
    const seen = new Set<string>();
    let cursor: TreeNode | undefined = node;
    while (cursor) {
      if (seen.has(cursor.id)) throw new StudyContractError("tree_cycle");
      seen.add(cursor.id);
      cursor = cursor.parentId ? nodeById.get(cursor.parentId) : undefined;
    }
  }
  if (prompts.some((prompt) => !nodeById.has(prompt.correctNodeId))) throw new StudyContractError("invalid_tree_destination");
  return { nodes, prompts };
}

export function parseMethodConfig(kind: StudyKind, value: unknown): MethodConfig {
  if (kind === "survey") return parseSurveyConfig(value);
  if (kind === "card_sort") return parseCardSortConfig(value);
  if (kind === "tree_test") return parseTreeConfig(value);
  throw new StudyContractError("not_a_method_block");
}

export function visibleSurveyQuestions(config: SurveyConfig, answers: Record<string, unknown>): readonly SurveyQuestion[] {
  return config.questions.filter((question) => !question.showIf || answers[question.showIf.questionId] === question.showIf.equals);
}

export function parseMethodResponse(kind: StudyKind, config: MethodConfig, value: unknown): Record<string, unknown> {
  const source = object(value);
  if (kind === "survey") {
    const survey = config as SurveyConfig;
    const answers = object(source.answers);
    const visible = visibleSurveyQuestions(survey, answers);
    const visibleIds = new Set(visible.map((question) => question.id));
    if (Object.keys(answers).some((key) => !visibleIds.has(key))) throw new StudyContractError("hidden_or_unknown_answer");
    for (const question of visible) {
      const answer = answers[question.id];
      if (answer === undefined || answer === null || answer === "") {
        if (question.required) throw new StudyContractError("required_answer_missing");
        continue;
      }
      if (question.type === "single_choice" &&
        (typeof answer !== "string" || !question.options?.some((option) => option.id === answer))) {
        throw new StudyContractError("invalid_answer");
      }
      if (question.type === "multi_choice" &&
        (!Array.isArray(answer) || (question.required && answer.length === 0) ||
          new Set(answer).size !== answer.length ||
          answer.some((option) => typeof option !== "string" || !question.options?.some((item) => item.id === option)))) {
        throw new StudyContractError("invalid_answer");
      }
      if (question.type === "scale" &&
        (typeof answer !== "number" || !Number.isInteger(answer) || answer < (question.min ?? 0) || answer > (question.max ?? 0))) {
        throw new StudyContractError("invalid_answer");
      }
      if (question.type === "text" && (typeof answer !== "string" || answer.length > 5000)) {
        throw new StudyContractError("invalid_answer");
      }
    }
    return { answers };
  }

  if (kind === "card_sort") {
    const sort = config as CardSortConfig;
    const categories = sort.mode === "open"
      ? array(source.categories, 1, 30).map((raw) => {
        const category = object(raw);
        return { id: id(category.id), label: text(category.label) };
      })
      : sort.categories;
    unique(categories);
    const categoryIds = new Set(categories.map((item) => item.id));
    const cardIds = new Set(sort.cards.map((item) => item.id));
    const placements = array(source.placements, sort.cards.length, sort.cards.length).map((raw) => {
      const placement = object(raw);
      return { cardId: id(placement.cardId), categoryId: id(placement.categoryId) };
    });
    if (new Set(placements.map((item) => item.cardId)).size !== sort.cards.length ||
      placements.some((item) => !cardIds.has(item.cardId) || !categoryIds.has(item.categoryId))) {
      throw new StudyContractError("invalid_placements");
    }
    return { categories, placements };
  }

  if (kind === "tree_test") {
    const tree = config as TreeConfig;
    const nodes = new Map(tree.nodes.map((node) => [node.id, node]));
    const prompts = new Set(tree.prompts.map((prompt) => prompt.id));
    const root = tree.nodes.find((node) => node.parentId === null);
    const attempts = array(source.attempts, tree.prompts.length, tree.prompts.length).map((raw) => {
      const attempt = object(raw);
      const promptId = id(attempt.promptId);
      const path = array(attempt.path, 1, tree.nodes.length).map(id);
      const trace = array(attempt.trace, 1, 1000).map(id);
      const selectedNodeId = id(attempt.selectedNodeId);
      const durationMs = Number(attempt.durationMs);
      if (!prompts.has(promptId) || path[0] !== root?.id || path.at(-1) !== selectedNodeId ||
        path.some((nodeId, index) => !nodes.has(nodeId) ||
          (index > 0 && nodes.get(nodeId)?.parentId !== path[index - 1])) ||
        trace[0] !== root?.id || trace.at(-1) !== selectedNodeId ||
        trace.some((nodeId, index) => !nodes.has(nodeId) || (index > 0 &&
          nodes.get(nodeId)?.parentId !== trace[index - 1] &&
          nodes.get(trace[index - 1])?.parentId !== nodeId)) ||
        !Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs > 86_400_000) {
        throw new StudyContractError("invalid_tree_attempt");
      }
      return { promptId, path, trace, selectedNodeId, durationMs };
    });
    if (new Set(attempts.map((item) => item.promptId)).size !== prompts.size) {
      throw new StudyContractError("invalid_tree_attempt");
    }
    return { attempts };
  }
  throw new StudyContractError("not_a_method_block");
}

export function publicMethodConfig(kind: StudyKind, config: MethodConfig): unknown {
  if (kind !== "tree_test") return config;
  const tree = config as TreeConfig;
  return {
    nodes: tree.nodes,
    prompts: tree.prompts.map(({ id, title }) => ({ id, title })),
  };
}

export function parseScreenerConfig(value: unknown): ScreenerConfig {
  const source = object(value);
  const questions = array(source.questions, 0, 10).map((raw) => {
    const question = object(raw);
    const options = array(question.options, 2, 10).map((rawOption) => {
      const option = object(rawOption);
      return { id: id(option.id), label: text(option.label) };
    });
    unique(options);
    const accepted = array(question.accept, 1, options.length).map(id);
    if (new Set(accepted).size !== accepted.length || accepted.some((value) => !options.some((option) => option.id === value))) {
      throw new StudyContractError("invalid_screener_acceptance");
    }
    return { id: id(question.id), prompt: text(question.prompt, 500), options, accept: accepted };
  });
  unique(questions);
  return { questions };
}

export function publicScreenerConfig(config: ScreenerConfig) {
  return { questions: config.questions.map(({ id, prompt, options }) => ({ id, prompt, options })) };
}
