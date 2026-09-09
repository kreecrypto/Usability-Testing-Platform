# Task 57 — Privacy & Security QA

Date: 2026-09-09

This release-QA artifact is grounded in the V1 privacy baseline, current GitHub implementation, exact-head CI, and the connected Supabase production project `usability-testing-platform` (`qryvrcwbsehrzpersuoc`). It does not replace legal/compliance review.

## Acceptance coverage

### Consent before tracking — PASS

- Participant runtime starts in access/consent state before a runtime/outbox/lifecycle exists.
- `POST /api/public/tests/[testVersionId]/session` rejects unless `accepted === true` and a non-empty `consentVersion` is supplied.
- The browser configures the event runtime only after the consent-gated session API returns a session-bound ingestion credential.
- If secure session creation fails, the UI enters technical-blocked state and explicitly states that no task interaction was started.

### Delete propagation / retention — PASS

- V1 raw retention is 90 days after authoritative session completion.
- `private.purge_expired_sessions` removes reconstructable `finding_evidence` before deleting the session, and cascading FKs remove session/task/event/answer evidence.
- The purge function is bounded and executable only by `service_role`.

### Workspace isolation / cross-workspace deny — PASS (production transactional QA)

A temporary two-workspace fixture was created and fully deleted within the production QA run. With role `authenticated` and JWT subject set to user A:

- visible workspaces: `1`
- `private.is_workspace_member(workspace A)`: `true`
- `private.is_workspace_member(workspace B)`: `false`
- attempted update to workspace B: did not change the row
- post-QA fixture residue: `0` QA workspaces and `0` QA auth users

This verifies the active production RLS path, not only static SQL.

### Grants + RLS — PASS

Production verification:

- `findings`, `finding_evidence`, and `retests`: RLS enabled and FORCE RLS enabled.
- `anon`: no table access to these research objects.
- `authenticated`: explicit RLS-backed CRUD only where the product role allows it.
- Task 50 evidence FKs structurally scope finding/session/event/answer references by `workspace_id`.

Supabase security advisor reports two informational `RLS Enabled No Policy` notices for `event_ingestion_dlq` and `ingestion_token_uses`. Production grant inspection confirms both tables are service-role-only and have no `anon` or `authenticated` table privileges, so these are not exposed Data API paths.

### Exposed views / functions — PASS

Production currently exposes no public views. Public function privilege inspection shows:

- `anon` has no EXECUTE access on V1 public functions.
- `consume_ingestion_token`, `create_anonymous_participant_session`, and `save_post_task_feedback` are executable by `service_role` only.
- researcher mutation functions such as publish/reorder/frame-map remain authenticated-only and are RLS-backed.

### Public link / session token — PASS

- Public snapshot excludes `expected_path`, `success_rule`, and `failure_rule`.
- Anonymous participant sessions are created server-side.
- Event ingestion uses a short-lived (300 second), session/test-version-bound signed credential.
- Refresh checks that the bound session is still active.
- Runner proof is stored as `HttpOnly; SameSite=Lax` and `Secure` on HTTPS.
- No global ingestion secret is shipped in the participant payload.

### Service-role / secret handling — PASS

- Server-only runner configuration reads `SUPABASE_SECRET_KEY` and `EVENT_INGESTION_TOKEN_SECRET` without a `NEXT_PUBLIC_` prefix.
- Participant client uses only session-bound credentials returned from same-origin APIs.
- Database migrations and authorization tests reject embedded service-role/JWT secret material.

## Official Supabase verification

Current Supabase guidance confirms that exposed tables should combine explicit grants with RLS; service-role credentials bypass RLS and must not be exposed to browser clients. The implementation follows that model and keeps elevated credentials server-only.

## Release result

Task 57 privacy/security engineering gate: **PASS**, subject to separate project-wide release dependencies such as cross-device QA, pilot/UAT, performance/load, and external Figma seed evidence.