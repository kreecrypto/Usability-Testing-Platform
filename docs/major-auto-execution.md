# Major-only AUTO execution

## Goal

Prevent scheduled workers from colliding while keeping execution aligned to the current Google Sheet.

The scheduling unit is **MAJOR Task only**. Sub Tasks are internal implementation, dependency, QA, and evidence units. They must never be scheduled as independent AUTO jobs.

## Canonical MAJOR hierarchy

Capability/work domains:

1. MAJOR-01 — Study Setup
2. MAJOR-02 — Participant Experience
3. MAJOR-03 — Behavior & Evidence
4. MAJOR-04 — Analytics
5. MAJOR-05 — Findings & Usability Report
6. MAJOR-06 — Fix & Retest

Release convergence layer:

7. MAJOR-A — Flow Proven
8. MAJOR-B — Evidence Proven
9. MAJOR-C — Adversarial Proven
10. MAJOR-07 — V1 Release Gate

Tasks 61–70 are Future/V2 and are excluded from the V1 AUTO queue unless planning governance explicitly changes.

Task 60 depends directly on MAJOR-A, MAJOR-B, and MAJOR-C. See `docs/proof-gate-execution.md`.

## Authority

- Google Sheet `Task Hierarchy`: planning queue and MAJOR status/priority/dependency authority.
- Google Sheet `Task List` / `Task Detail`: Sub Task requirement, dependency, acceptance, QA, and evidence authority.
- Supabase `internal.auto_major_execution_leases`: concurrency authority only.
- GitHub: implementation source of truth.
- Vercel Production: runtime evidence only.

The lease table does not replace planning data in the Sheet.

## Supported MAJOR IDs

The lease layer accepts:

- `MAJOR-01` through numeric two-digit MAJOR IDs used by the planning model.
- `MAJOR-A`
- `MAJOR-B`
- `MAJOR-C`

The alpha IDs are release proof gates, not aliases for numeric MAJORs.

## MAJOR selection

Each worker reads the current Sheet first and considers only rows with `Auto Eligible = YES`.

Priority:

1. IN PROGRESS
2. QA
3. P0 executable
4. P1 executable
5. P2 executable
6. BLOCKED_SELF_FIXABLE

A MAJOR is executable only when at least one mapped Sub Task can progress. Skip COMPLETE and true BLOCKED_EXTERNAL work.

Proof-gate sequencing still applies:

`MAJOR-A → MAJOR-B → MAJOR-C → MAJOR-07 / Task 60`

Capability MAJORs may progress when they are executable and provide prerequisites/evidence for those gates.

## Atomic claim

Before mutating project work, create a unique run ID and claim one MAJOR:

```sql
select internal.try_claim_auto_major(
  '<MAJOR-ID>',
  '<LEASE-OWNER>',
  '<RUN-ID>',
  4500
) as claimed;
```

- `claimed = true`: worker owns that MAJOR for this run.
- `claimed = false`: do not mutate that MAJOR; try the next executable MAJOR.
- If the lease service cannot be verified, fail closed.

After a successful claim, mirror `Claim Owner`, `Lease Until`, and `Last Run ID` into the Sheet for human visibility. Supabase remains the concurrency authority.

## Work inside the claimed MAJOR

Choose mapped Sub Tasks in this order:

1. IN PROGRESS
2. QA
3. P0 TODO executable
4. P1 TODO executable
5. P2 TODO executable
6. BLOCKED_SELF_FIXABLE

For each Sub Task:

`READ SOURCE → INSPECT → CHECK DEPENDENCY → IMPLEMENT → QA → FIX → RE-QA → RECORD EVIDENCE`

Do not switch to another MAJOR during the same run. Do not redo COMPLETE Sub Tasks unless new regression evidence invalidates previous evidence.

True external blockers are skipped while other executable work in the same MAJOR continues.

## Lease heartbeat

```sql
select internal.refresh_auto_major_lease(
  '<MAJOR-ID>',
  '<LEASE-OWNER>',
  '<RUN-ID>',
  4500
) as refreshed;
```

If refresh fails, stop mutating work because ownership can no longer be proven.

## Release

```sql
select internal.release_auto_major(
  '<MAJOR-ID>',
  '<LEASE-OWNER>',
  '<RUN-ID>'
) as released;
```

Release the lease at the end of the run regardless of COMPLETE, QA, blocked, or failure outcome.

## Status propagation

- COMPLETE: all required mapped Sub Tasks satisfy acceptance/evidence and all relevant MAJOR gates pass.
- QA: implementation exists but MAJOR-level QA/evidence remains.
- IN PROGRESS: at least one mapped executable Sub Task is active.
- TODO_DEPENDENCY_BLOCKED: no mapped Sub Task can progress because prerequisites are not satisfied.
- BLOCKED_EXTERNAL: no mapped Sub Task can progress without genuine external input.

For MAJOR-A/B/C, COMPLETE means the corresponding proof gate in `docs/proof-gate-execution.md` is actually proven. Task-count completion alone is insufficient.

## Logging

Append one `Auto Execution Log` row per MAJOR run.

Use:
- Task ID = MAJOR ID
- Task Name = MAJOR name
- What Changed / Evidence = Sub Task IDs touched in the run

Do not add independent AUTO log rows that imply Sub Tasks were scheduled jobs.

## Collision invariant

At most one unexpired lease may exist for a given `major_id`. Multiple schedules may run concurrently only when they claim different executable MAJORs.
