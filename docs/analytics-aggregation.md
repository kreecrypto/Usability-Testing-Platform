# Task 25 — Analytics Aggregation Pipeline

## Purpose

The Task 25 pipeline converts accepted canonical events into reproducible task/session metrics without mutating raw evidence.

Implementation: `src/lib/analytics/aggregation.ts`

Aggregation version: `task25-v1`

## Input boundary

Input is the accepted event contract v2 shape, including collector-owned `receivedAt`.

The aggregator:

- rejects unsupported schema versions,
- deduplicates retried accepted events,
- rejects conflicting event/idempotency identities,
- validates immutable session context (`participantId`, `testId`, `testVersionId`),
- requires derived-event provenance to resolve to accepted raw evidence in the same task context.

It does not accept client-provided metric values.

## Canonical task terminal rule

Task terminal candidates follow `docs/task-outcome-rules.md`.

Raw terminal evidence:

- `task_give_up` → `give_up`
- `task_timeout` → `timeout`
- `task_abandoned` → `abandoned`
- `task_technical_blocked` → `technical_blocked`

Derived terminal evidence:

- `task_success` + versioned `metadata.outcome` → `success_direct` or `success_indirect`
- `task_failed` → `failed`

Derived terminal events are anchored to their referenced raw evidence. The first valid terminal by canonical raw sequence wins. Later terminal signals do not replace it.

## Task metrics

For each exact `(testId, testVersionId, taskId)` cohort the pipeline derives:

- started task sessions,
- eligible task sessions,
- terminal outcome counts,
- completion rate,
- failure rate,
- give-up rate,
- successful-task duration sample size,
- successful-task Median / P75 / P90,
- eligible pointer-interaction count,
- derived misclick count,
- misclick rate.

Eligibility is canonical:

```text
eligible = started - technical_blocked
```

`technical_blocked` never silently becomes a usability failure and is excluded from usability-rate/time denominators.

Successful time on task is derived from:

```text
terminal.occurredAt - task_started.occurredAt
```

Only `success_direct` and `success_indirect` contribute to the headline duration summary.

No eligible denominator remains `null` / No Data rather than being rewritten to `0%`.

## Session aggregate

For each session the pipeline derives:

- session lifecycle terminal state when present,
- task started count,
- task terminal count,
- eligible task count,
- technical-blocked task count,
- successful task count.

All session aggregates remain bound to the session's immutable test version.

## Reproducibility trace

Each metric family carries a `MetricTrace` containing:

- aggregation version,
- accepted event IDs,
- raw event IDs,
- derived event IDs,
- derived rule versions,
- event schema versions,
- test-version IDs,
- preserved metadata for `prototype_adapter` raw evidence.

This is the trace boundary required by Task 25: a result can identify exactly which accepted evidence and rule versions produced it.

### Provider-version boundary

Current source does not yet define a canonical provider-version metadata field; GWD-03/GWD-05 remain responsible for provider adapter/capability/coordinate contracts. Task 25 therefore preserves the full accepted `prototype_adapter` metadata in the trace and does **not** invent a new provider-version key.

When the provider adapter contract defines versioned metadata, the same accepted metadata becomes directly traceable through `providerEvidence` without changing historical event evidence.

## Retry / duplicate safety

Task 23 prevents duplicate accepted primary rows at ingestion. Task 25 additionally deduplicates identical accepted events defensively before aggregation so a repeated in-memory delivery cannot increment a metric twice. Conflicting duplicate identities fail closed rather than being silently merged.

## QA fixtures

`tests/task25-analytics-aggregation.test.ts` proves at minimum:

1. reproducible task and session aggregation,
2. `technical_blocked` exclusion,
3. completion/give-up/failure calculations,
4. successful Median/P75/P90,
5. misclick denominator exclusion,
6. event/rule/provider-evidence traceability,
7. duplicate-delivery safety,
8. first-valid-terminal semantics,
9. fail-closed derived provenance,
10. No Data preservation.

## Dependency / release-gate note

Task 25 depends on Task 23. The implementation branch is intentionally stacked on the Task 23 head until the protected-branch checks allow the Task 22 → Task 23 dependency chain to merge to `main`. Task 25 must not be marked COMPLETE before that dependency gate and Task 25 QA are both evidenced.
