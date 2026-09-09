-- GWD-08: Harden Supabase grants, RLS and exposed objects.
-- Planning acceptance: grant + RLS coverage for anon/authenticated operations,
-- cross-workspace deny, exposed view/function review, and server-only service role.
-- Source: docs/roles-permissions.md + Supabase RLS/API security guidance.

-- All V1 application tables must stay behind RLS even if table ownership changes.
alter table public.users force row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members force row level security;
alter table public.projects force row level security;
alter table public.tests force row level security;
alter table public.test_versions force row level security;
alter table public.tasks force row level security;
alter table public.participants force row level security;
alter table public.sessions force row level security;
alter table public.task_sessions force row level security;
alter table public.events force row level security;
alter table public.answers force row level security;
alter table public.findings force row level security;
alter table public.finding_evidence force row level security;
alter table public.retests force row level security;

-- Anonymous clients have no direct workspace/data table surface. Participant
-- access is intentionally mediated by the server/session-bound flow.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- Do not let newly-created public objects silently become an anonymous API.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Private authorization helpers are policy implementation details. Revoke first,
-- then grant authenticated only the helpers used by RLS. This intentionally does
-- not grant future/private maintenance functions (for example retention purge).
revoke all on schema private from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.is_workspace_admin(uuid) to authenticated, service_role;
grant execute on function private.is_workspace_owner(uuid) to authenticated, service_role;
grant execute on function private.is_research_editor(uuid) to authenticated, service_role;
grant execute on function private.can_read_sensitive_workspace(uuid) to authenticated, service_role;
grant execute on function private.can_read_session(uuid) to authenticated, service_role;
grant execute on function private.can_edit_finding(uuid) to authenticated, service_role;
grant execute on function private.can_read_finding_evidence(uuid) to authenticated, service_role;

-- Keep service-role use explicit and server-only at the database grant boundary.
-- There is intentionally no service-role credential, token, or secret in SQL.
-- Application secrets remain environment/server concerns.

-- Exposed-object review guard: GWD-08 introduces no public view/materialized
-- view/function. Any future exposed object must receive an explicit grant and
-- RLS/security-invoker review rather than inheriting anonymous access.
