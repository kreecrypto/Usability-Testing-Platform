export type EvidenceAvailability = "Available" | "Partial" | "Unsupported" | "No Data";

export type ResultsTargetContext = Readonly<{
  provider: string | null;
  sourceUrl: string | null;
  environment: string | null;
  launchMode: string | null;
  snapshotVersion: number | null;
  capabilities: Readonly<Record<string, EvidenceAvailability>>;
}>;

export type ResultsStudyContext = Readonly<{
  testId: string;
  testVersionId: string;
  versionNo: number | null;
  lifecycleStatus: string | null;
  publishedAt: string | null;
  target: ResultsTargetContext;
}>;

type VersionRow = Readonly<{
  id: string;
  test_id: string;
  version_no: number | null;
  lifecycle_status: string | null;
  published_at: string | null;
  target_provider: string | null;
  target_snapshot: unknown;
}>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function availability(value: unknown): EvidenceAvailability | null {
  if (value === "Available" || value === "available") return "Available";
  if (value === "Partial" || value === "partial") return "Partial";
  if (value === "Unsupported" || value === "unsupported") return "Unsupported";
  if (value === "No Data" || value === "no_data") return "No Data";
  return null;
}

export function parseResultsStudyContext(row: VersionRow): ResultsStudyContext {
  const snapshot = record(row.target_snapshot);
  const states: Record<string, EvidenceAvailability> = {};
  for (const [name, value] of Object.entries(record(snapshot.capabilities))) {
    const parsed = availability(value);
    if (parsed) states[name] = parsed;
  }
  const storedProvider = typeof row.target_provider === "string" && row.target_provider.trim() ? row.target_provider.trim() : null;
  const snapshotProvider = typeof snapshot.provider === "string" && snapshot.provider.trim() ? snapshot.provider.trim() : null;
  // Conflicting persisted providers cannot establish an authoritative capability context.
  const provider = storedProvider && snapshotProvider && storedProvider !== snapshotProvider
    ? null : storedProvider ?? snapshotProvider;
  const snapshotVersion = typeof snapshot.snapshotVersion === "number"
    && Number.isSafeInteger(snapshot.snapshotVersion) && snapshot.snapshotVersion > 0
    ? snapshot.snapshotVersion : null;
  return Object.freeze({
    testId: row.test_id,
    testVersionId: row.id,
    versionNo: row.version_no,
    lifecycleStatus: row.lifecycle_status,
    publishedAt: row.published_at,
    target: Object.freeze({
      provider,
      sourceUrl: typeof snapshot.sourceUrl === "string" && snapshot.sourceUrl.trim() ? snapshot.sourceUrl.trim() : null,
      environment: typeof snapshot.environment === "string" && snapshot.environment.trim() ? snapshot.environment.trim() : null,
      launchMode: typeof snapshot.launchMode === "string" && snapshot.launchMode.trim() ? snapshot.launchMode.trim() : null,
      snapshotVersion: provider ? snapshotVersion : null,
      capabilities: Object.freeze(provider ? states : {}),
    }),
  });
}
