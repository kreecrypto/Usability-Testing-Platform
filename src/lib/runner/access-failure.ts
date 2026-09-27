export type AccessFailure = "invalid" | "unavailable" | "temporary";

export function classifyAccessFailure(error: unknown): AccessFailure {
  if (!(error instanceof Error)) return "temporary";
  if (error.message === "invalid_version_id") return "invalid";
  if (error.message === "published_test_not_found") return "unavailable";
  return "temporary";
}
