# Major-only AUTO execution

## Goal

Prevent scheduled workers from colliding while keeping the Usability Testing Platform execution queue aligned to the product loop.

The scheduling unit is **MAJOR Task only**. Sub Tasks are internal execution, dependency, QA, and evidence units. They must never be scheduled as independent AUTO jobs.

## Canonical MAJOR hierarchy

1. MAJOR-01 — Study Setup
2. MAJOR-02 — Participant Experience
3. MAJOR-03 — Behavior & Evidence
4. MAJOR-04 — Analytics
5. MAJOR-05 — Findings & Usability Report
6. MAJOR-06 — Fix & Retest
7. MAJOR-07 — Release Quality

Tasks 61–70 are Future/V2 and are excluded from the V1 AUTO queue.

## Authority

- Google Sheet `Task Hierarchy`: planning queue and MAJOR status/priority/dependency authority.
- Google Sheet `Task List` / `Task Detail`: mapped Sub Task requirement, dependency, acceptance, QA, and evidence authority.
- Supabase `internal.auto_major_execution_leases`: concurrency authority only.
- GitHub: implementation source of truth.
- Vercel production: runtime evidence only.

The lease table does not replace planning data in the Sheet.

## MAJOR selection

Each worker reads the current Sheet first and considers only MAJOR rows with `Auto Eligible = YES`.

Priority:

1. IN PROGRESS
2. QA
3. P0 executable
4. P1 executable
5. P2 executable
6. BLOCKED_SELF_FIXABLE

A MAJOR is executable only when at least one mapped Sub Task can progress. Skip COMPLETE and true BLOCKED_EXTERNAL work.

## Atomic claim

Before any mutating project work, the worker creates a unique run ID and attempts to claim one MAJOR:

```sql
select internal.try_claim_auto_major(
  '<MAJOR-ID>',
  '<LEASE-OWNER>',
  '<RUN-ID>',
  4500
) as claimed;
```

- `claimed = true`: worker owns that MAJOR for this run.
- `claimed = false`: do not mutate anything for that MAJOR. Try the next executable MAJOR.
- If the lease service cannot be verified, execution fails closed: do not run mutating work without a lock.

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

Do not switch to another MAJOR during the same run. Do not redo COMPLETE Sub Tasks unless new regression evidence invalidates the previous result.

True external blockers are skipped while other executable Sub Tasks in the same MAJOR continue.

## Lease heartbeat

For a long run, refresh ownership before the lease expires:

```sql
select internal.refresh_auto_major_lease(
  '<MAJOR-ID>',
  '<LEASE-OWNER>',
  '<RUN-ID>',
  4500
) as refreshed;
```

If refresh fails, stop mutating work for the MAJOR because ownership can no longer be proven.

## Release

At the end of the run, release the lease regardless of COMPLETE, QA, blocked, or failure outcome:

```sql
select internal.release_auto_major(
  '<MAJOR-ID>',
  '<LEASE-OWNER>',
  '<RUN-ID>'
) as released;
```

Expired leases can be reclaimed atomically by a later worker.

## Status propagation

- COMPLETE: every required mapped Sub Task satisfies acceptance/evidence and all relevant MAJOR gates pass.
- QA: implementation is present but MAJOR-level QA/evidence remains.
- IN PROGRESS: at least one mapped executable Sub Task is active.
- TODO_DEPENDENCY_BLOCKED: no mapped Sub Task can yet progress because prerequisite MAJOR/Sub Tasks are not satisfied.
- BLOCKED_EXTERNAL: no mapped Sub Task can progress without genuine external input.

## Logging

Append one `Auto Execution Log` row per MAJOR run.

Use:
- Task ID = MAJOR ID
- Task Name = MAJOR name
- What Changed / Evidence = Sub Task IDs touched in the run

Do not add independent AUTO log rows that imply Sub Tasks were scheduled jobs.

## Collision invariant

At most one unexpired lease may exist for a given `major_id`. Multiple hourly schedules may run concurrently, but they must either claim different executable MAJORs or skip execution when no claim is available.
