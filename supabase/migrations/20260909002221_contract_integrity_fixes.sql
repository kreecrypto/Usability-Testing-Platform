-- Grill fixes C-02/C-03/C-04: align Event Contract v2 with persistence and
-- structurally prevent cross-workspace / cross-version references.

-- Canonical event contract uses numeric schemaVersion = 2 end-to-end.
alter table public.test_versions
  alter column event_schema_version drop default,
  alter column event_schema_version type smallint
    using case
      when event_schema_version = 'v2' then 2
      else regexp_replace(event_schema_version, '^v', '')::smallint
    end,
  alter column event_schema_version set default 2;

alter table public.test_versions
  add constraint test_versions_event_schema_version_positive
  check (event_schema_version > 0);

alter table public.events
  alter column schema_version drop default,
  alter column schema_version type smallint
    using case
      when schema_version = 'v2' then 2
      else regexp_replace(schema_version, '^v', '')::smallint
    end,
  alter column schema_version set default 2;

alter table public.events
  add constraint events_schema_version_positive
  check (schema_version > 0);

-- Parent composite keys used to enforce tenant consistency.
alter table public.projects
  add constraint projects_workspace_id_id_uq unique (workspace_id, id);

alter table public.tests
  add constraint tests_workspace_id_id_uq unique (workspace_id, id);

alter table public.test_versions
  add constraint test_versions_workspace_id_id_uq unique (workspace_id, id),
  add constraint test_versions_workspace_test_id_id_uq unique (workspace_id, test_id, id);

alter table public.tasks
  add constraint tasks_workspace_id_id_uq unique (workspace_id, id),
  add constraint tasks_workspace_version_id_id_uq unique (workspace_id, test_version_id, id);

alter table public.participants
  add constraint participants_workspace_id_id_uq unique (workspace_id, id),
  add constraint participants_workspace_test_id_id_uq unique (workspace_id, test_id, id);

alter table public.findings
  add constraint findings_workspace_id_id_uq unique (workspace_id, id);

-- Existing duplicated workspace_id columns now have matching composite FKs.
alter table public.tests
  add constraint tests_workspace_project_scope_fk
  foreign key (workspace_id, project_id)
  references public.projects (workspace_id, id);

alter table public.test_versions
  add constraint test_versions_workspace_test_scope_fk
  foreign key (workspace_id, test_id)
  references public.tests (workspace_id, id);

alter table public.tasks
  add constraint tasks_workspace_version_scope_fk
  foreign key (workspace_id, test_version_id)
  references public.test_versions (workspace_id, id);

alter table public.participants
  add constraint participants_workspace_test_scope_fk
  foreign key (workspace_id, test_id)
  references public.tests (workspace_id, id);

-- Persist test_id on sessions so participant + version context is enforceable.
alter table public.sessions add column test_id uuid;

update public.sessions s
set test_id = tv.test_id
from public.test_versions tv
where tv.id = s.test_version_id;

alter table public.sessions
  alter column test_id set not null,
  add constraint sessions_workspace_id_id_uq unique (workspace_id, id),
  add constraint sessions_workspace_context_uq
    unique (workspace_id, id, test_id, test_version_id, participant_id),
  add constraint sessions_workspace_version_scope_fk
    foreign key (workspace_id, test_id, test_version_id)
    references public.test_versions (workspace_id, test_id, id),
  add constraint sessions_workspace_participant_scope_fk
    foreign key (workspace_id, test_id, participant_id)
    references public.participants (workspace_id, test_id, id);

-- Persist the full canonical event identity instead of relying on implicit lookup.
alter table public.events
  add column participant_id uuid,
  add column test_id uuid,
  add column test_version_id uuid,
  add column screen_id text;

update public.events e
set participant_id = s.participant_id,
    test_id = s.test_id,
    test_version_id = s.test_version_id
from public.sessions s
where s.id = e.session_id;

alter table public.events
  alter column participant_id set not null,
  alter column test_id set not null,
  alter column test_version_id set not null,
  add constraint events_workspace_session_context_fk
    foreign key (workspace_id, session_id, test_id, test_version_id, participant_id)
    references public.sessions (workspace_id, id, test_id, test_version_id, participant_id),
  add constraint events_workspace_task_version_scope_fk
    foreign key (workspace_id, test_version_id, task_id)
    references public.tasks (workspace_id, test_version_id, id);

-- Remaining workspace-scoped children must point to parents in the same tenant.
alter table public.answers
  add constraint answers_workspace_session_scope_fk
    foreign key (workspace_id, session_id)
    references public.sessions (workspace_id, id),
  add constraint answers_workspace_task_scope_fk
    foreign key (workspace_id, task_id)
    references public.tasks (workspace_id, id);

alter table public.findings
  add constraint findings_workspace_project_scope_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  add constraint findings_workspace_version_scope_fk
    foreign key (workspace_id, test_version_id)
    references public.test_versions (workspace_id, id);

alter table public.retests
  add constraint retests_workspace_finding_scope_fk
    foreign key (workspace_id, finding_id)
    references public.findings (workspace_id, id),
  add constraint retests_workspace_original_version_scope_fk
    foreign key (workspace_id, original_test_version_id)
    references public.test_versions (workspace_id, id),
  add constraint retests_workspace_retest_version_scope_fk
    foreign key (workspace_id, retest_test_version_id)
    references public.test_versions (workspace_id, id);

create index events_workspace_context_idx
  on public.events (workspace_id, test_id, test_version_id, participant_id, session_id);
