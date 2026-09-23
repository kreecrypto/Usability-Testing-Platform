export const taskOutcomeRuleTypes = [
  "screen",
  "url",
  "route",
  "element",
  "completion_signal",
] as const;

export type TaskOutcomeRuleType = (typeof taskOutcomeRuleTypes)[number];
export type TaskOutcomeRule = Readonly<{
  version: 2;
  type: TaskOutcomeRuleType;
  values: readonly string[];
}>;

export type LegacyPresentedNodeRule = Readonly<{
  type: "presented_node";
  nodeIds: readonly string[];
}>;

export type StoredTaskOutcomeRule = TaskOutcomeRule | LegacyPresentedNodeRule;

export type RuleTargetSnapshot = Readonly<{
  provider: "figma_prototype" | "first_party_web" | "external_web";
  capabilities: Readonly<Record<string, unknown>>;
}>;

export type TaskOutcomeRuleValidation = Readonly<{
  ok: boolean;
  reason: string | null;
}>;

export class TaskOutcomeRuleValidationError extends Error {
  readonly code:
    | "invalid_rule_type"
    | "invalid_rule_values"
    | "unsupported_rule"
    | "conflicting_terminal_rules"
    | "invalid_expected_path";

  constructor(code: TaskOutcomeRuleValidationError["code"], message: string = code) {
    super(message);
    this.name = "TaskOutcomeRuleValidationError";
    this.code = code;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isRuleType(value: unknown): value is TaskOutcomeRuleType {
  return typeof value === "string" && (taskOutcomeRuleTypes as readonly string[]).includes(value);
}

function normalizeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TaskOutcomeRuleValidationError("invalid_rule_values", "URL rule values must be valid URLs.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TaskOutcomeRuleValidationError("invalid_rule_values", "URL rule values must use HTTP or HTTPS.");
  }
  url.hash = "";
  return url.toString();
}

function normalizeRoute(value: string): string {
  const route = value.trim();
  if (!route.startsWith("/") || route.length > 1024) {
    throw new TaskOutcomeRuleValidationError("invalid_rule_values", "Route rule values must start with /.");
  }
  if (/\s/.test(route)) {
    throw new TaskOutcomeRuleValidationError("invalid_rule_values", "Route rule values cannot contain whitespace.");
  }
  return route;
}

function normalizeOpaque(value: string): string {
  const result = value.trim();
  if (!result || result.length > 512) {
    throw new TaskOutcomeRuleValidationError("invalid_rule_values");
  }
  return result;
}

function normalizedRuleValue(type: TaskOutcomeRuleType, value: string): string {
  if (type === "url") return normalizeUrl(value);
  if (type === "route") return normalizeRoute(value);
  return normalizeOpaque(value);
}

export function buildTaskOutcomeRule(input: Readonly<{ type: unknown; values: unknown }>): TaskOutcomeRule {
  if (!isRuleType(input.type)) {
    throw new TaskOutcomeRuleValidationError("invalid_rule_type");
  }
  const type = input.type;
  if (!Array.isArray(input.values)) {
    throw new TaskOutcomeRuleValidationError("invalid_rule_values");
  }
  const values = input.values.map((value) => {
    if (typeof value !== "string") throw new TaskOutcomeRuleValidationError("invalid_rule_values");
    return normalizedRuleValue(type, value);
  });
  const unique = [...new Set(values)];
  if (unique.length === 0) throw new TaskOutcomeRuleValidationError("invalid_rule_values");
  return Object.freeze({
    version: 2 as const,
    type,
    values: Object.freeze(unique),
  });
}

export function parseStoredTaskOutcomeRule(value: unknown): StoredTaskOutcomeRule | null {
  const rule = record(value);
  if (!rule || Object.keys(rule).length === 0) return null;
  if (rule.type === "presented_node") {
    if (!Array.isArray(rule.nodeIds) || rule.nodeIds.length === 0) return null;
    const nodeIds = rule.nodeIds.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
    if (nodeIds.length !== rule.nodeIds.length || new Set(nodeIds).size !== nodeIds.length) return null;
    return Object.freeze({ type: "presented_node" as const, nodeIds: Object.freeze(nodeIds) });
  }
  if (rule.version !== 2 || !isRuleType(rule.type)) return null;
  try {
    return buildTaskOutcomeRule({ type: rule.type, values: rule.values });
  } catch {
    return null;
  }
}

function capability(target: RuleTargetSnapshot, key: string): string | null {
  const value = target.capabilities[key];
  return typeof value === "string" ? value : null;
}

export function availableTaskOutcomeRuleTypes(target: RuleTargetSnapshot): readonly TaskOutcomeRuleType[] {
  const available: TaskOutcomeRuleType[] = [];
  if (capability(target, "screen") === "Available") available.push("screen");
  if (
    target.provider !== "figma_prototype" &&
    capability(target, "instrumentation") === "Available"
  ) {
    available.push("url", "route", "completion_signal");
    if (capability(target, "pointer") === "Available") available.push("element");
  }
  return Object.freeze(available);
}

export function taskOutcomeRuleSupported(
  rule: StoredTaskOutcomeRule,
  target: RuleTargetSnapshot,
): boolean {
  if (rule.type === "presented_node") {
    return target.provider === "figma_prototype" && capability(target, "screen") === "Available";
  }
  return availableTaskOutcomeRuleTypes(target).includes(rule.type);
}

function eventChannel(rule: StoredTaskOutcomeRule): "screen_view" | "pointer_interaction" | "completion_signal" {
  if (rule.type === "element") return "pointer_interaction";
  if (rule.type === "completion_signal") return "completion_signal";
  return "screen_view";
}

function values(rule: StoredTaskOutcomeRule): readonly string[] {
  return rule.type === "presented_node" ? rule.nodeIds : rule.values;
}

function screenDomain(rule: StoredTaskOutcomeRule): boolean {
  return rule.type === "screen" || rule.type === "presented_node";
}

export function taskOutcomeRulesConflict(
  success: StoredTaskOutcomeRule,
  failure: StoredTaskOutcomeRule,
): boolean {
  if (eventChannel(success) !== eventChannel(failure)) return false;
  if (success.type !== failure.type && !(screenDomain(success) && screenDomain(failure))) {
    // Different predicates on the same raw event can both be true. V1 fails closed
    // instead of inventing precedence semantics.
    return true;
  }
  const successValues = new Set(values(success));
  return values(failure).some((value) => successValues.has(value));
}

export function validateStoredTaskOutcomeRules(input: Readonly<{
  target: RuleTargetSnapshot;
  successRule: unknown;
  failureRule: unknown;
}>): TaskOutcomeRuleValidation {
  const success = parseStoredTaskOutcomeRule(input.successRule);
  const failure = parseStoredTaskOutcomeRule(input.failureRule);
  if (!success || !failure) return Object.freeze({ ok: false, reason: "terminal_rules_required" });
  if (!taskOutcomeRuleSupported(success, input.target) || !taskOutcomeRuleSupported(failure, input.target)) {
    return Object.freeze({ ok: false, reason: "unsupported_rule_for_target" });
  }
  if (taskOutcomeRulesConflict(success, failure)) {
    return Object.freeze({ ok: false, reason: "conflicting_terminal_rules" });
  }
  return Object.freeze({ ok: true, reason: null });
}

export function normalizeExpectedPath(value: unknown): readonly string[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TaskOutcomeRuleValidationError("invalid_expected_path");
  const path = value.map((item) => {
    if (typeof item !== "string") throw new TaskOutcomeRuleValidationError("invalid_expected_path");
    return normalizeOpaque(item);
  });
  if (new Set(path).size !== path.length) throw new TaskOutcomeRuleValidationError("invalid_expected_path");
  return Object.freeze(path);
}
