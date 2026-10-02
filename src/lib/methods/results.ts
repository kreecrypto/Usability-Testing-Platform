import { createHash } from "node:crypto";
import { parseCardSortConfig, parseSurveyConfig, parseTreeConfig, type StudyKind } from "./study-contract.ts";

export type MethodBlock = Readonly<{ id: string; ordinal: number; kind: Exclude<StudyKind, "usability_task">; title: string; config: unknown }>;
export type MethodEvidence = Readonly<{ id: string; sessionId: string; blockId: string; response: unknown; submittedAt: string }>;

type Count = Readonly<{ value: string; count: number; evidenceIds: readonly string[] }>;
export type MethodBlockResult = Readonly<{
  blockId: string;
  ordinal: number;
  kind: MethodBlock["kind"];
  title: string;
  comparisonKey: string;
  sampleSize: number;
  availability: "Available" | "No Data";
  questions?: readonly Readonly<{ id: string; prompt: string; sampleSize: number; counts: readonly Count[]; textEvidence: readonly Readonly<{ responseId: string; sessionId: string; value: string }>[] }>[];
  cards?: readonly Readonly<{ cardId: string; label: string; groups: readonly Count[] }>[];
  similarity?: readonly Readonly<{ leftCardId: string; rightCardId: string; together: number; sampleSize: number; percent: number | null; evidenceIds: readonly string[] }>[];
  prompts?: readonly Readonly<{ id: string; title: string; sampleSize: number; successCount: number; directCount: number; successPercent: number | null; directPercent: number | null; paths: readonly Count[] }>[];
}>;

function countValues(entries: readonly { value: string; responseId: string }[]): Count[] {
  const values = new Map<string, string[]>();
  for (const entry of entries) values.set(entry.value, [...(values.get(entry.value) ?? []), entry.responseId]);
  return [...values].map(([value, evidenceIds]) => ({ value, count: evidenceIds.length, evidenceIds }));
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function buildMethodResults(blocks: readonly MethodBlock[], evidence: readonly MethodEvidence[]): MethodBlockResult[] {
  return blocks.map((block) => {
    const rows = evidence.filter((item) => item.blockId === block.id);
    const comparisonKey = createHash("sha256").update(JSON.stringify({ ordinal: block.ordinal, kind: block.kind, config: block.config })).digest("hex");
    const base = { blockId: block.id, ordinal: block.ordinal, kind: block.kind, title: block.title, comparisonKey,
      sampleSize: rows.length, availability: rows.length ? "Available" as const : "No Data" as const };
    if (block.kind === "survey") {
      const config = parseSurveyConfig(block.config);
      const questions = config.questions.map((question) => {
        const answers = rows.map((row) => ({ row, value: object(row.response)?.answers })).map(({ row, value }) => ({ row, value: object(value)?.[question.id] }))
          .filter(({ value }) => value !== undefined && value !== null && value !== "");
        const entries = answers.flatMap(({ row, value }) => (Array.isArray(value) ? value : [value])
          .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
          .map((item) => ({ value: String(item), responseId: row.id })));
        const textEvidence = question.type === "text" ? answers.filter(({ value }) => typeof value === "string")
          .map(({ row, value }) => ({ responseId: row.id, sessionId: row.sessionId, value: String(value) })) : [];
        return { id: question.id, prompt: question.prompt, sampleSize: answers.length,
          counts: question.type === "text" ? [] : countValues(entries), textEvidence };
      });
      return { ...base, questions };
    }
    if (block.kind === "card_sort") {
      const config = parseCardSortConfig(block.config);
      const placementRows = rows.map((row) => ({ row, response: object(row.response) }));
      const cards = config.cards.map((card) => {
        const entries = placementRows.flatMap(({ row, response }) => {
          const placements = Array.isArray(response?.placements) ? response.placements : [];
          const found = placements.map(object).find((item) => item?.cardId === card.id);
          if (!found || typeof found.categoryId !== "string") return [];
          const categories = config.mode === "closed" ? config.categories : (Array.isArray(response?.categories) ? response.categories.map(object) : []);
          const category = categories.find((item) => item?.id === found.categoryId);
          return category && typeof category.label === "string" ? [{ value: category.label, responseId: row.id }] : [];
        });
        return { cardId: card.id, label: card.label, groups: countValues(entries) };
      });
      const similarity = config.cards.flatMap((left, index) => config.cards.slice(index + 1).map((right) => {
        const togetherIds = placementRows.flatMap(({ row, response }) => {
          const placements = Array.isArray(response?.placements) ? response.placements.map(object) : [];
          const a = placements.find((item) => item?.cardId === left.id)?.categoryId;
          const b = placements.find((item) => item?.cardId === right.id)?.categoryId;
          return a && a === b ? [row.id] : [];
        });
        return { leftCardId: left.id, rightCardId: right.id, together: togetherIds.length,
          sampleSize: rows.length, percent: rows.length ? togetherIds.length * 100 / rows.length : null, evidenceIds: togetherIds };
      }));
      return { ...base, cards, similarity };
    }
    const config = parseTreeConfig(block.config);
    const prompts = config.prompts.map((prompt) => {
      const attempts = rows.flatMap((row) => {
        const response = object(row.response);
        const attempt = (Array.isArray(response?.attempts) ? response.attempts.map(object) : []).find((item) => item?.promptId === prompt.id);
        return attempt ? [{ row, attempt }] : [];
      });
      const successCount = attempts.filter(({ attempt }) => attempt.selectedNodeId === prompt.correctNodeId).length;
      const directCount = attempts.filter(({ attempt }) => attempt.selectedNodeId === prompt.correctNodeId &&
        Array.isArray(attempt.path) && Array.isArray(attempt.trace) &&
        JSON.stringify(attempt.path) === JSON.stringify(attempt.trace)).length;
      const paths = countValues(attempts.map(({ row, attempt }) => ({ value: Array.isArray(attempt.path) ? attempt.path.join(" → ") : "", responseId: row.id })));
      return { id: prompt.id, title: prompt.title, sampleSize: attempts.length, successCount, directCount,
        successPercent: attempts.length ? successCount * 100 / attempts.length : null,
        directPercent: attempts.length ? directCount * 100 / attempts.length : null, paths };
    });
    return { ...base, prompts };
  });
}
