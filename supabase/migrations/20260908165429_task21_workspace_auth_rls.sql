-- Task 21: Auth, workspace isolation, grants, and RLS.
-- Planning acceptance: workspace isolation + role access must pass authorization tests.
-- Source: docs/roles-permissions.md + Supabase RLS / API security guidance.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Security-definer helpers live outside the exposed public schema so policies can
-- resolve membership without recursive RLS on workspace_members.
create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
    );
$$;

create or replace function private.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.system_role in ('owner', 'admin')
    );
$$;

create or replace function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspaces w
      where w.id = target_workspace_id
        and w.owner_user_id = (select auth.uid())
    );
$$;

create or replace function private.is_research_editor(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.product_persona in ('researcher', 'designer')
    );
$$;

create or replace function private.can_read_sensitive_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_research_editor(target_workspace_id);
$$;

create or replace function private.can_read_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.sessions s
    where s.id = target_session_id
      and private.can_read_sensitive_workspace(s.workspace_id)
  );
$$;

create or replace function private.can_read_finding_evidence(target_finding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.findings f
    where f.id = target_finding_id
      and private.can_read_sensitive_workspace(f.workspace_id)
  );
$$;

create or replace function private.can_edit_finding(target_finding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.findings f
    where f.id = target_finding_id
      and private.is_research_editor(f.workspace_id)
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Explicit Data API surface. Anonymous participants do not receive direct table
-- access; participant writes will go through the later session-bound server/event
-- collector flow. service_role remains server-side only.
revoke all on table
  public.users,
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.tests,
  public.test_versions,
  public.tasks,
  public.participants,
  public.sessions,
  public.task_sessions,
  public.events,
  public.answers,
  public.findings,
  public.finding_evidence,
  public.retests
from anon, authenticated;

grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;
grant select, insert, update, delete on table
  public.projects,
  public.tests,
  public.test_versions,
  public.tasks,
  public.findings,
  public.finding_evidence,
  public.retests
to authenticated;
grant select on table
  public.participants,
  public.sessions,
  public.task_sessions,
  public.events,
  public.answers
to authenticated;

grant select, insert, update, delete on table
  public.users,
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.tests,
  public.test_versions,
  public.tasks,
  public.participants,
  public.sessions,
  public.task_sessions,
  public.events,
  public.answers,
  public.findings,
  public.finding_evidence,
  public.retests
to service_role;

-- User profile: only the authenticated user may access or mutate their row.
create policy users_select_self
on public.users for select
to authenticated
using ((select auth.uid()) = id);

create policy users_insert_self
on public.users for insert
to authenticated
with check ((select auth.uid()) = id);

create policy users_update_self
on public.users for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Workspace visibility and administration.
create policy workspaces_select_member_or_owner
on public.workspaces for select
to authenticated
using (
  private.is_workspace_member(id)
  or owner_user_id = (select auth.uid())
);

create policy workspaces_insert_owner
on public.workspaces for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

create policy workspaces_update_admin
on public.workspaces for update
to authenticated
using (private.is_workspace_admin(id))
with check (private.is_workspace_admin(id));

create policy workspaces_delete_admin
on public.workspaces for delete
to authenticated
using (private.is_workspace_admin(id));

create policy workspace_members_select_self_or_admin
on public.workspace_members for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_workspace_admin(workspace_id)
);

create policy workspace_members_insert_admin_or_owner_bootstrap
on public.workspace_members for insert
to authenticated
with check (
  private.is_workspace_admin(workspace_id)
  or (
    private.is_workspace_owner(workspace_id)
    and user_id = (select auth.uid())
    and system_role = 'owner'
  )
);

create policy workspace_members_update_admin
on public.workspace_members for update
to authenticated
using (private.is_workspace_admin(workspace_id))
with check (private.is_workspace_admin(workspace_id));

create policy workspace_members_delete_admin
on public.workspace_members for delete
to authenticated
using (private.is_workspace_admin(workspace_id));

-- Research model: every member can read non-sensitive workspace data; only
-- researcher/designer personas can mutate it. Product Viewer is therefore
-- database-enforced read-only for these objects.
create policy projects_select_member
on public.projects for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy projects_insert_editor
on public.projects for insert
to authenticated
with check (
  private.is_research_editor(workspace_id)
  and (created_by is null or created_by = (select auth.uid()))
);

create policy projects_update_editor
on public.projects for update
to authenticated
using (private.is_research_editor(workspace_id))
with check (private.is_research_editor(workspace_id));

create policy projects_delete_editor
on public.projects for delete
to authenticated
using (private.is_research_editor(workspace_id));

create policy tests_select_member
on public.tests for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy tests_insert_editor
on public.tests for insert
to authenticated
with check (
  private.is_research_editor(workspace_id)
  and (created_by is null or created_by = (select auth.uid()))
);

create policy tests_update_editor
on public.tests for update
to authenticated
using (private.is_research_editor(workspace_id))
with check (private.is_research_editor(workspace_id));

create policy tests_delete_editor
on public.tests for delete
to authenticated
using (private.is_research_editor(workspace_id));

create policy test_versions_select_member
on public.test_versions for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy test_versions_insert_editor
on public.test_versions for insert
to authenticated
with check (
  private.is_research_editor(workspace_id)
  and (created_by is null or created_by = (select auth.uid()))
);

create policy test_versions_update_editor
on public.test_versions for update
to authenticated
using (private.is_research_editor(workspace_id))
with check (private.is_research_editor(workspace_id));

create policy test_versions_delete_editor
on public.test_versions for delete
to authenticated
using (private.is_research_editor(workspace_id));

create policy tasks_select_member
on public.tasks for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy tasks_insert_editor
on public.tasks for insert
to authenticated
with check (private.is_research_editor(workspace_id));

create policy tasks_update_editor
on public.tasks for update
to authenticated
using (private.is_research_editor(workspace_id))
with check (private.is_research_editor(workspace_id));

create policy tasks_delete_editor
on public.tasks for delete
to authenticated
using (private.is_research_editor(workspace_id));

create policy findings_select_member
on public.findings for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy findings_insert_editor
on public.findings for insert
to authenticated
with check (
  private.is_research_editor(workspace_id)
  and (created_by is null or created_by = (select auth.uid()))
);

create policy findings_update_editor
on public.findings for update
to authenticated
using (private.is_research_editor(workspace_id))
with check (private.is_research_editor(workspace_id));

create policy findings_delete_editor
on public.findings for delete
to authenticated
using (private.is_research_editor(workspace_id));

create policy retests_select_member
on public.retests for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy retests_insert_editor
on public.retests for insert
to authenticated
with check (private.is_research_editor(workspace_id));

create policy retests_update_editor
on public.retests for update
to authenticated
using (private.is_research_editor(workspace_id))
with check (private.is_research_editor(workspace_id));

create policy retests_delete_editor
on public.retests for delete
to authenticated
using (private.is_research_editor(workspace_id));

-- Sensitive participant/session/raw evidence stays unavailable to Product Viewer.
create policy participants_select_research_editor
on public.participants for select
to authenticated
using (private.can_read_sensitive_workspace(workspace_id));

create policy sessions_select_research_editor
on public.sessions for select
to authenticated
using (private.can_read_sensitive_workspace(workspace_id));

create policy events_select_research_editor
on public.events for select
to authenticated
using (private.can_read_sensitive_workspace(workspace_id));

create policy answers_select_research_editor
on public.answers for select
to authenticated
using (private.can_read_sensitive_workspace(workspace_id));

create policy task_sessions_select_research_editor
on public.task_sessions for select
to authenticated
using (private.can_read_session(session_id));

create policy finding_evidence_select_research_editor
on public.finding_evidence for select
to authenticated
using (private.can_read_finding_evidence(finding_id));

create policy finding_evidence_insert_editor
on public.finding_evidence for insert
to authenticated
with check (private.can_edit_finding(finding_id));

create policy finding_evidence_update_editor
on public.finding_evidence for update
to authenticated
using (private.can_edit_finding(finding_id))
with check (private.can_edit_finding(finding_id));

create policy finding_evidence_delete_editor
on public.finding_evidence for delete
to authenticated
using (private.can_edit_finding(finding_id));
