# Task 24 — Event Indexing, Retention & Archiving

## Source-backed requirement

The V1 privacy baseline requires raw session, event, and answer data to be retained for **90 days after session completion** by default. Expiry/deletion must also remove derived or linked evidence that can identify or reconstruct the deleted session.

## Existing state before Task 24

- `sessions` already had `completed_at` and nullable `delete_after`.
- `events`, `answers`, and `task_sessions` already cascade from `sessions` when a session is deleted.
- `finding_evidence` could reference a session, event, or answer and therefore could retain links capable of reconstructing an expired session.
- Session-level indexes existed, but task-scoped event/answer query indexes and an expiry-scan index were missing.

## Implementation

Migration `20260909033000_task24_retention_archiving.sql` adds:

1. `events_session_task_occurred_idx` for ordered event retrieval inside one session/task.
2. `answers_session_task_created_idx` for task-scoped answer retrieval.
3. `sessions_delete_after_idx` for bounded retention scans.
4. indexes on `finding_evidence.session_id`, `event_id`, and `answer_id` for cleanup.
5. `private.set_default_session_delete_after()` + trigger to set `delete_after = completed_at + 90 days` only when `completed_at` is authoritative and no explicit `delete_after` override exists.
6. a one-time backfill for already-completed sessions that have no `delete_after`.
7. `private.purge_expired_sessions(cutoff, max_rows)`, restricted to `service_role`, which:
   - selects expired sessions in deterministic bounded batches with `FOR UPDATE SKIP LOCKED`,
   - deletes `finding_evidence` rows tied directly or indirectly to the target session,
   - deletes the session so existing cascades remove task sessions, raw/derived events, and answers.

## No-guess boundaries

- The migration does **not** invent `completed_at` for abandoned or technically blocked sessions. If a terminal session lacks an authoritative completion timestamp, default 90-day expiry is not inferred.
- It does **not** introduce workspace-configurable retention because V1 only defines the 90-day default; future configurability is explicitly deferred by the privacy baseline.
- It does **not** delete findings themselves. Findings remain research records, while reconstructable session evidence is removed.
- Scheduling frequency for running the purge function is operational configuration and is not defined by Task 24; Task 26 observability/operations work can own that runtime schedule.

## QA contract

`tests/task24-retention-archiving.test.ts` verifies the migration contains the task-scoped indexes, 90-day retention default, evidence-before-session purge order, bounded locking behavior, and service-role-only purge access.
