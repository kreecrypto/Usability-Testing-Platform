# V1 Database Schema Baseline

Task 20 establishes the relational baseline for the Usability Testing Platform. The migration source of truth is `supabase/migrations/20260908141723_initial_v1_schema.sql`, created by the Supabase CLI.

## Tenant and identity model

- `users` mirrors the minimum application profile keyed to `auth.users.id`; email/phone are not duplicated into the research schema.
- `workspaces` are the tenant boundary.
- `workspace_members` separates system authorization role (`owner`, `admin`, `member`) from product persona (`researcher`, `designer`, `product_viewer`).
- Participant identity is separate from workspace membership and uses an opaque UUID in `participants`.

## Research hierarchy

`workspaces → projects → tests → test_versions → tasks`

Published test execution always references a `test_versions` row, not the mutable test draft. Figma publish evidence is stored as file key + immutable version ID + start node ID, alongside mapping/rule versions.

## Session and evidence model

- `sessions` bind participant, published test version, consent, lifecycle, and retention timestamp.
- `task_sessions` store exactly one canonical terminal outcome per session/task pair.
- `events` implement Event Contract v2 identity/ordering fields, including `event_id`, `idempotency_key`, raw/derived layer, `occurred_at`, server `received_at`, raw `sequence`, and derived evidence references.
- `answers` store structured SEQ/question responses without adding name/email/phone fields.
- `findings` + `finding_evidence` connect UX findings to session/event/answer evidence.
- `retests` connect original and retest versions and hold before/after metric snapshots.

## Integrity gates

- `(session_id, idempotency_key)` is unique so duplicate collector deliveries cannot create a second event row.
- Raw `(session_id, sequence)` is unique.
- Derived events require evidence IDs and `rule_version`.
- Published Figma versions require `published_at`, file key, immutable Figma version ID, and start node ID.
- Test version numbers and task ordinals are unique within their parent scope.
- Retest original/retest versions must differ.

## Security handoff

Every `public` table has RLS enabled in the baseline migration and therefore fails closed until policies exist. Task 21 owns workspace membership policies, participant access, grants, viewer restrictions, cross-workspace denial tests, and field/view exposure. No `service_role` credential belongs in client code or database rows.

## Retention handoff

`sessions.delete_after` is the enforcement timestamp hook for the Task 07 default 90-day raw research-data retention policy. A later retention job must propagate deletion through session events, task sessions, answers, participant identifiers, finding evidence availability, and recomputable analytics.

## QA

- `tests/database-schema.test.ts` verifies structural invariants in the committed migration.
- `.github/workflows/task20-schema-qa.yml` applies the migration to PostgreSQL with a minimal Supabase `auth.users` fixture and fails on SQL errors.
- The global GWD-11 gate also runs all Node contract tests on every push to `main`.
